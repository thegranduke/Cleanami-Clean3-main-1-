"use server";

import { getDbOrNull } from "@/db";
import { createAdminClient } from "@/lib/supabase/server";
import {
  customers,
  properties,
  subscriptions,
  checklistFiles,
  jobs,
} from "@/db/schema";
import { SignupFormData, signupFormSchema } from "../validations/bookng-modal";
import { ICalService } from "../services/iCal/ical.service";
import { eq } from "drizzle-orm";
import { getStripe } from "@/lib/stripe/get-stripe";
import { SERVICE_UNAVAILABLE } from "@/lib/env/messages";

async function geocodeAddress(address: string): Promise<{ latitude: string; longitude: string } | null> {
  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!googleMapsApiKey) {
    console.warn("Geocoding skipped: NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not configured");
    return null;
  }

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
        address
      )}&key=${googleMapsApiKey}`
    );

    const data = await response.json();

    if (data.status === 'OK' && data.results.length > 0) {
      const location = data.results[0].geometry.location;
      return {
        latitude: location.lat.toString(),
        longitude: location.lng.toString(),
      };
    }

    console.warn('Geocoding failed during onboarding:', data.status, address);
    return null;
  } catch (error) {
    console.error('Geocoding error during onboarding:', error);
    return null;
  }
}

async function uploadFileWithRetry(
  supabase: any, 
  storagePath: string, 
  file: File, 
  maxRetries = 3
): Promise<{ success: boolean; error?: any }> {
  for (let i = 0; i < maxRetries; i++) {
    const { error } = await supabase.storage
      .from("checklists")
      .upload(storagePath, file);
    
    if (!error) return { success: true };
    
    if (i === maxRetries - 1) return { success: false, error };
    
    await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
  }
  
  return { success: false, error: new Error('Max retries exceeded') };
}

export async function completeOnboarding(
  formData: SignupFormData,
  paymentIntentId: string
) {
  try {
    const stripe = getStripe();
    if (!stripe) {
      return { success: false, error: SERVICE_UNAVAILABLE.stripe };
    }

    const db = getDbOrNull();
    if (!db) {
      return { success: false, error: SERVICE_UNAVAILABLE.database };
    }

    const validatedData = signupFormSchema.parse(formData);

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    const stripeCustomerId = typeof paymentIntent.customer === 'string' ? paymentIntent.customer : null;

    if (!stripeCustomerId) {
      throw new Error("Critical: Could not find a Stripe Customer ID associated with this payment.");
    }

    const {
      name,
      email,
      phoneNumber,
      address,
      sqft,
      bedrooms,
      bathrooms,
      hasHotTub,
      laundryService,
      laundryLoads,
      hotTubService,
      hotTubDrain,
      hotTubDrainCadence,
      subscriptionMonths,
      checklistFile,
      useDefaultChecklist,
      iCalUrl,
      defaultCheckInTime,
      defaultCheckOutTime,
      firstCleanDate,
    } = validatedData;

    if (checklistFile && checklistFile.length > 0) {
      for (const file of checklistFile) {
        if (file.size > 10 * 1024 * 1024) { // 10MB limit
          throw new Error(`File ${file.name} is too large. Maximum size is 10MB.`);
        }
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv', 'application/vnd.ms-excel', 'application/vnd.oasis.opendocument.spreadsheet'];
        if (!allowedTypes.includes(file.type)) {
          throw new Error(`File ${file.name} has an unsupported format. Please use PDF, JPEG, or PNG files.`);
        }
      }
    }

    const coordinates = await geocodeAddress(address);

    const result = await db.transaction(async (tx) => {
      const [customer] = await tx
        .insert(customers)
        .values({ 
          name, 
          email, 
          phone: phoneNumber,
          stripeCustomerId
        })
        .onConflictDoUpdate({
          target: customers.email,
          set: { 
            name, 
            phone: phoneNumber, 
            stripeCustomerId, 
            updatedAt: new Date() 
          },
        })
        .returning();

      const propertyValues: any = {
        customerId: customer.id,
        address,
        sqFt: sqft,
        bedCount: bedrooms,
        bathCount: String(bathrooms),
        hasHotTub,
        laundryType: laundryService,
        laundryLoads,
        hotTubServiceLevel: hotTubService,
        hotTubDrain: hotTubDrain,
        hotTubDrainCadence,
        useDefaultChecklist: useDefaultChecklist,
        iCalUrl,
        defaultCheckInTime: validatedData.defaultCheckInTime,
        defaultCheckOutTime: validatedData.defaultCheckOutTime,
      };

      if (coordinates) {
        propertyValues.latitude = coordinates.latitude;
        propertyValues.longitude = coordinates.longitude;
        propertyValues.geocodedAt = new Date();
      }

      const [property] = await tx
        .insert(properties)
        .values(propertyValues)
        .returning()
        .catch((err) => {
          console.error('DETAILED INSERT ERROR:', {
            message: err.message,
            code: err.code,
            detail: err.detail,
            hint: err.hint,
            constraint: err.constraint,
            table: err.table,
            column: err.column,
            dataType: err.dataType,
            values: propertyValues
          });
          throw err;
        });

      const startDate = new Date(firstCleanDate);
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + subscriptionMonths);

      const [subscription] = await tx
        .insert(subscriptions)
        .values({
          customerId: customer.id,
          propertyId: property.id,
          stripeSubscriptionId: null,
          durationMonths: subscriptionMonths,
          firstCleanPaymentId: paymentIntentId,
          isFirstCleanPrepaid: true,
          status: "active",
          startDate: firstCleanDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
        })
        .returning();

      return { customer, property, subscription };
    });

    console.log("Database transaction completed successfully:", result);

    const fileUploadResults: Array<{ fileName: string; success: boolean; error?: string }> = [];
    
    if (checklistFile && checklistFile.length > 0) {
      const supabase = await createAdminClient();
      
      for (const file of checklistFile) {
        try {
          const storagePath = `checklists/${result.property.id}/${file.name}`;
          
          console.log(`Uploading file: ${file.name} to ${storagePath}`);
          
          const uploadResult = await uploadFileWithRetry(supabase, storagePath, file);
          
          if (uploadResult.success) {
            await db.insert(checklistFiles).values({
              propertyId: result.property.id,
              fileName: file.name,
              storagePath: storagePath,
              fileSize: file.size,
            });
            
            fileUploadResults.push({ fileName: file.name, success: true });
            console.log(`Successfully uploaded and recorded: ${file.name}`);
          } else {
            fileUploadResults.push({ 
              fileName: file.name, 
              success: false, 
              error: uploadResult.error?.message || 'Unknown upload error'
            });
            console.error(`Failed to upload ${file.name}:`, uploadResult.error);
          }
        } catch (fileError) {
          fileUploadResults.push({ 
            fileName: file.name, 
            success: false, 
            error: fileError instanceof Error ? fileError.message : 'Unknown error'
          });
          console.error(`Error processing file ${file.name}:`, fileError);
        }
      }
      
      const successfulUploads = fileUploadResults.filter(r => r.success).length;
      const failedUploads = fileUploadResults.filter(r => !r.success);
      
      console.log(`File upload summary: ${successfulUploads}/${fileUploadResults.length} successful`);
      
      if (failedUploads.length > 0) {
        console.warn('Failed file uploads:', failedUploads);
      }
    }

    if (result.subscription && iCalUrl) {
      console.log(`Onboarding successful. Triggering initial calendar sync for subscription: ${result.subscription.id}`);
      try {
        const icalService = new ICalService(db);
        await icalService.syncCalendar({ subscriptionId: result.subscription.id });
        console.log("Initial calendar sync completed successfully.");

        if (paymentIntentId) {
          const firstJob = await db.query.jobs.findFirst({
            where: eq(jobs.subscriptionId, result.subscription.id),
            orderBy: (jobs, { asc }) => [asc(jobs.checkOutTime), asc(jobs.createdAt)],
          });

          if (firstJob) {
            await db
              .update(jobs)
              .set({
                paymentIntentId: paymentIntentId,
                paymentStatus: 'captured',
              })
              .where(eq(jobs.id, firstJob.id));
            console.log(`First job ${firstJob.id} marked as paid with payment intent ${paymentIntentId}`);
          } else {
            console.warn(`No jobs found for subscription ${result.subscription.id} after sync`);
          }
        }
      } catch (syncError) {
        console.error(
          `CRITICAL: Initial calendar sync failed for new subscription ${result.subscription.id}`,
          syncError
        );
      
      }
    }

    console.log("Successfully completed onboarding:", {
      subscriptionId: result.subscription.id,
      customerId: result.customer.id,
      propertyId: result.property.id,
      fileUploadResults
    });

    return { 
      success: true, 
      data: {
        ...result,
        fileUploadResults
      }
    };

  } catch (error) {
    console.error("CRITICAL: Onboarding failed after successful payment.", {
      paymentIntentId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      formData: {
        ...formData,
        checklistFile: formData.checklistFile ? `${formData.checklistFile.length} files` : 'none'
      }
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to save subscription details. Please contact support.",
    };
  }
}
