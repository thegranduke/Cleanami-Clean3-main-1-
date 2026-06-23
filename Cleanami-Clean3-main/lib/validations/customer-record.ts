import { z } from "zod";

export const adminCustomerUpdateSchema = z
  .object({
    name: z.string().min(1, "Name is required").optional(),
    email: z.string().email("Invalid email").optional(),
    phone: z.string().nullable().optional(),
  })
  .refine((data) => data.name ?? data.email ?? data.phone !== undefined, {
    message: "At least one field is required",
  });

export const customerSelfUpdateSchema = z
  .object({
    email: z.string().email("Invalid email").optional(),
    phone: z.string().nullable().optional(),
  })
  .refine((data) => data.email !== undefined || data.phone !== undefined, {
    message: "At least one field is required",
  });

export const mergePropertiesSchema = z.object({
  sourcePropertyId: z.string().uuid(),
  targetPropertyId: z.string().uuid(),
});
