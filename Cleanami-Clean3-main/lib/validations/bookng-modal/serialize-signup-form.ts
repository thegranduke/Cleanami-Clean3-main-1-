import { SignupFormData } from "./index";

/** JSON-safe booking form payload for API routes and server actions. */
export type SerializableSignupFormData = Omit<
  SignupFormData,
  "checklistFile" | "firstCleanDate"
> & {
  firstCleanDate?: string;
};

export function serializeSignupFormDataForServer(
  formData: SignupFormData
): SerializableSignupFormData {
  const { checklistFile, firstCleanDate, ...rest } = formData;
  void checklistFile;

  return {
    ...rest,
    firstCleanDate:
      firstCleanDate instanceof Date
        ? firstCleanDate.toISOString()
        : typeof firstCleanDate === "string"
          ? firstCleanDate
          : undefined,
  };
}

export function deserializeSignupFormDataFromServer(
  data: SerializableSignupFormData
): SignupFormData {
  const { firstCleanDate, ...rest } = data;

  return {
    ...rest,
    firstCleanDate: firstCleanDate ? new Date(firstCleanDate) : undefined,
    checklistFile: undefined,
  };
}
