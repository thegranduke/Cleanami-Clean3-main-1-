import type { User as AuthUser, SupabaseClient } from "@supabase/supabase-js";
import { signInFormSchema, signUpFormSchema } from "@/lib/validations/auth";
import { z } from "zod";
import { NewUser } from "@/lib/validations/schemas";
import type { db } from "@/db";
import { cleaners, users } from "@/db/schemas";
import { createAdminClient } from "@/lib/supabase/server";
import { formatError } from "@/lib/utils";
import { getDbOrNull } from "@/db";
import type { SignUpRole } from "@/lib/validations/auth";

type DrizzleClient = typeof import("@/db").db;
type ServiceRespnse<T> =
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      data?: T;
      error: {
        message: string;
      };
    };

async function syncUserMetadata(
  userId: string,
  role: SignUpRole,
  displayName: string
) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return;

  try {
    const supabaseAdmin = createAdminClient();
    await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: {
        role,
        full_name: displayName,
        name: displayName,
      },
    });
  } catch (metadataError) {
    console.warn("Could not sync user metadata via admin client:", metadataError);
  }
}

async function rollbackAuthUser(userId: string): Promise<boolean> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error(
      "Cannot roll back auth user: SUPABASE_SERVICE_ROLE_KEY is not configured."
    );
    return false;
  }

  try {
    const supabaseAdmin = createAdminClient();
    const { error: deleteError } =
      await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteError) {
      console.error(
        "CRITICAL ERROR: Failed to roll back auth user after profile creation failure."
      );
      return false;
    }

    console.log(`Successfully rolled back auth user: ${userId}`);
    return true;
  } catch (error) {
    console.error("Failed to roll back auth user:", error);
    return false;
  }
}

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

      const { email, password, role, name } = validation.data;
      const displayName = name?.trim() || email.split("@")[0];

      const { data: authData, error: authError } =
        await this.supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              role,
              full_name: displayName,
              name: displayName,
            },
          },
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
      const authUserWithRole: AuthUser = {
        ...authUser,
        user_metadata: {
          ...authUser.user_metadata,
          role,
          full_name: displayName,
          name: displayName,
        },
      };

      const database = getDbOrNull();
      if (!database) {
        console.warn(
          "DATABASE_URL not configured — created Supabase auth user only. Add DATABASE_URL to enable full app features."
        );

        await syncUserMetadata(authUser.id, role, displayName);

        return { success: true, data: authUserWithRole };
      }

      try {
        await database.transaction(async (tx) => {
          const newUser: NewUser = {
            supabaseUserId: authUser.id,
            email: authUser.email!,
            role,
            name: displayName,
          };

          const [insertedUser] = await tx
            .insert(users)
            .values(newUser)
            .returning();

          if (role === "cleaner") {
            await tx.insert(cleaners).values({
              userId: insertedUser.id,
              email: authUser.email!,
              fullName: displayName,
            });
          }
        });

        await syncUserMetadata(authUser.id, role, displayName);

        return { success: true, data: authUserWithRole };
      } catch (dbError) {
        console.error(
          "Failed to create user profile, attempting to roll back auth user...",
          dbError
        );

        const rolledBack = await rollbackAuthUser(authUser.id);
        if (!rolledBack) {
          return {
            success: false,
            data: authUser,
            error: {
              message: "A critical error occurred. Please contact support.",
            },
          };
        }

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
