import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { ZodError } from "zod";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const hasEnvVars =
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
export function formatError(error: any) {
  if (error instanceof ZodError) {
    const fieldErrors = error.issues.map(
      (issue) => issue.message
    );
    return fieldErrors.join('. ');
  } else if (
    error.code === '23505'
  ) {
    const constraintName = error.constraint || '';
    if (constraintName.includes('email')) {
      return 'Email already exists';
    }
    return 'Record already exists';
  } else {
    
    return typeof error?.message === 'string'
      ? error.message
      : JSON.stringify(error?.message || error);
  }
}