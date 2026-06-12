
import type { User as AuthUser, SupabaseClient } from "@supabase/supabase-js";
import { signInFormSchema, signUpFormSchema } from "@/lib/validations/auth";
import { z } from "zod";
import { NewUser } from "@/lib/validations/schemas";
import type { db } from "@/db";
import { users } from "@/db/schemas";
import { createAdminClient } from "@/lib/supabase/server";
import { formatError } from "@/lib/utils";

type DrizzleClient = typeof db;
type ServiceRespnse<T> =
  | {
      success: boolean;
      data: T;
    }
  | {
      success: boolean;
      data?: T;
      error: {
        message: string;
      };
    };

export class AuthService {
  private supabase: SupabaseClient;
  private db: DrizzleClient;

  constructor(supabase: SupabaseClient, db: DrizzleClient) {
    this.supabase = supabase;
    this.db = db;
  }

  public async signUpUser(
    input: z.infer<typeof signUpFormSchema>
  ): Promise<ServiceRespnse<AuthUser>> {
    try {
      const validation = signUpFormSchema.safeParse(input);
      if (!validation.success) {
        return {
          success: false,
          error: { message: formatError(validation.error) },
        };
      }

      const { email, password, role } = validation.data;
      const { data: authData, error: authError } =
        await this.supabase.auth.signUp({
          email,
          password,
        });

      if (authError) {
        return {
          success: false,
          data: authData.user!,
          error: { message: authError.message },
        };
      }

      if (!authData.user) {
        return {
          success: false,
          data: authData.user!,
          error: { message: "An unexpected Error occured during sign-up." },
        };
      }

      const authUser = authData.user;

      try {
        const newUser: NewUser = {
          supabaseUserId: authUser.id,
          email: authUser.email!,
        };

        await this.db.insert(users).values(newUser);
        return { success: true, data: authUser };
      } catch (dbError) {
        console.error(
          "Failed to create userProfile, attempting to roll back auth user...",
          dbError
        );

        const supabaseAdmin = createAdminClient();

        const { error: deleteError } =
          await supabaseAdmin.auth.admin.deleteUser(authUser.id);

        if (deleteError) {
          console.error(
            "CRITICAL ERROR: Failed to roll back auth user after profile creation failure."
          );
          return {
            success: false,
            data: authUser,
            error: {
              message: "A critical error occured. Please contact support.",
            },
          };
        }
        console.log(`Successfully rolled back auth user: ${authUser.id}`);
        return {
          success: false,
          data: authUser,
          error: {
            message: formatError(dbError),
          },
        };
      }
    } catch (err) {
      console.error("Unexpected error in signUp:", formatError(err));
      return {
        success: false,
        error: {
          message: "An internal server error occurred.",
        },
      };
    }
  }

  public async signInUser(
    input: z.infer<typeof signInFormSchema>
  ): Promise<ServiceRespnse<AuthUser>> {
    try {
      const validation = signInFormSchema.safeParse(input);
      if (!validation.success) {
        return {
          success: false,
          error: {
            message: formatError(validation.error),
          },
        };
      }

      const { email, password } = validation.data;

      const { data, error } = await this.supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return {
          success: false,
          data: data.user!,
          error: {
            message: error.message,
          },
        };
      }
      return {
        success: true,
        data: data.user,
      };
    } catch (err) {
      console.error("Unexpected error in signIn:", formatError(err));
      return {
        success: false,
        error: {
          message: "An internal server error occurred.",
        },
      };
    }
  }
}
