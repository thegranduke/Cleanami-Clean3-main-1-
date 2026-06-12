'use server';

import Stripe from 'stripe';
import { PricingService } from '../services/pricing.service';
import { SignupFormData } from '../validations/bookng-modal';
import { customers } from '@/db/schemas';
import { db } from '@/db';
import { eq } from 'drizzle-orm';


const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const pricingService = new PricingService();

export async function createValidatedPaymentIntent(
  formData: SignupFormData,
  clientSideAmount: number
): Promise<{ clientSecret?: string | null; error?: string }> {
  try {
    const serverPriceDetails = await pricingService.calculatePrice(formData);
    const serverAmountInCents = Math.round(serverPriceDetails.totalPerClean * 100);

    if (serverAmountInCents !== clientSideAmount) {
      console.error(`SECURITY ALERT: Price mismatch. Client: ${clientSideAmount}, Server: ${serverAmountInCents}`);
      return { error: 'Price validation failed. Please refresh and try again.' };
    }
    
    if (serverAmountInCents <= 0) {
        return { error: 'Invalid amount for payment.' };
    }

    let stripeCustomerId: string | null = null;
    
    if (formData.email) {
      const existingCustomer = await db.query.customers.findFirst({
        where: eq(customers.email, formData.email),
        columns: { stripeCustomerId: true }
      });
      
      if (existingCustomer?.stripeCustomerId) {
        stripeCustomerId = existingCustomer.stripeCustomerId;
      }
    }

    let stripeCustomer: Stripe.Customer;
    
    if (stripeCustomerId) {
      
      stripeCustomer = await stripe.customers.retrieve(stripeCustomerId) as Stripe.Customer;
      
      await stripe.customers.update(stripeCustomer.id, {
        name: formData.name,
        phone: formData.phoneNumber,
      });
    } else {
      
      const existingStripeCustomers = await stripe.customers.list({
        email: formData.email,
        limit: 1,
      });

      if (existingStripeCustomers.data.length > 0) {
        
        stripeCustomer = existingStripeCustomers.data[0];
        
        await stripe.customers.update(stripeCustomer.id, {
          name: formData.name,
          phone: formData.phoneNumber,
        });
      } else {
        
        stripeCustomer = await stripe.customers.create({
          email: formData.email,
          name: formData.name,
          phone: formData.phoneNumber,
        });
      }
    }

    const metadata: Stripe.MetadataParam = {
        customer_name: formData.name ?? 'N/A',
        customer_email: formData.email ?? 'N/A',
        property_address: formData.address ?? 'N/A',
        property_details: `${formData.bedrooms} bed, ${formData.bathrooms} bath, ${formData.sqft ?? 'N/A'} sqft`,
        laundry_service: `${formData.laundryService} (${formData.laundryLoads ?? 0} loads)`,
        hot_tub_service: formData.hasHotTub && "has hot tub" || '', 
        hot_tub_drain: formData.hotTubDrain && "drain hot tub" || '',
        hotTub_drain_cadence: formData.hotTubDrainCadence || '',
        subscription_term: `${formData.subscriptionMonths} month(s)`,
    };

    const paymentIntent = await stripe.paymentIntents.create({
      amount: serverAmountInCents,
      currency: 'usd',
      customer: stripeCustomer.id, 
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: metadata,
    });

    return { clientSecret: paymentIntent.client_secret };

  } catch (error) {
    console.error("Error creating Payment Intent:", error);
    return { error: 'Could not initialize payment. Please contact support.' };
  }
}