import { z } from 'zod';

export const signInFormSchema = z.object({
  email: z.email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const signUpFormSchema = z
  .object({
    email: z.email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z
      .string()
      .min(6, 'Confirm password must be at least 6 characters'),
    role: z.enum(['user', 'admin', 'super_admin']).default('user'),
  })
  .refine((data: { 
    password: string;
    confirmPassword: string;
  }) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });