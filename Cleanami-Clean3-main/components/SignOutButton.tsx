import { signOut } from "@/lib/actions/auth.actions";
import Form from "next/form";

export const SignOutButton = () => {

  return (
    <Form action={signOut}>
      <button className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
        Sign Out
      </button>
    </Form>
  );
};
