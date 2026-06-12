"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { signInFormSchema, signUpFormSchema } from "@/lib/validations/auth";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { formatError } from "@/lib/utils";
import { AuthService } from "@/lib/services/auth/auth.service";
import { AuthUserForm } from "@/lib/types/auth";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return redirect("/");
}

export async function signUpUser(
  prevState: AuthUserForm | undefined,
  formData: FormData
) {
  const validation = signUpFormSchema.safeParse({
    email: formData.get("email") as string,
    password: formData.get("password") as string,
    confirmPassword: formData.get("confirm-password") as string,
  });

  if (!validation.success) {
    return {
      success: false,
      data: {
        email: formData.get("email") as string,
      },
      error: {
        message: formatError(validation.error),
      },
    };
  }

  const validatedFields = validation.data;

  const supabase = await createClient();
  const authService = new AuthService(supabase, db);

  const result = await authService.signUpUser(validatedFields);

  if (!result.success) {
    return {
      success: result.success,
      data: {
        email: validatedFields.email,
      },
      error: {
        message: "Invalid email or password",
      },
    };
  }

  const userRole = result.data?.user_metadata.role || "user";
  

  if (userRole === "user") {
    revalidatePath("/customer/dashboard");
    return redirect("/customer/dashboard");
  }

  if (userRole === "admin") {
    revalidatePath("/admin/dashboard");
    return redirect("/admin/dashboard");
  }
}

export async function signInUser(
  prevState: AuthUserForm | undefined,
  formData: FormData
) {
  const validation = signInFormSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });


  if (!validation.success) {
    return {
      success: false,
      data: {
        email: formData.get("email") as string,
      },
      error: {
        message: `validation: ${formatError(validation.error)}`,
      },
    };
  }

  const validatedFields = validation.data;

  const supabase = await createClient();
  const authService = new AuthService(supabase, db);

  const result = await authService.signInUser(validatedFields);

  if (!result.success) {
    return {
      success: result.success,
      data: {
        email: validatedFields.email,
      },
      error: {
        message: "Invalid email or password",
      },
    };
  }

  const userRole = result.data?.user_metadata.role || "user";

  if (userRole === "user") {
    revalidatePath("/customer/dashboard");
    return redirect("/customer/dashboard");
  }

  if (userRole === "admin" || userRole === "super_admin") {
    revalidatePath("/admin/dashboard");
    return redirect("/admin/dashboard");
  }
}
