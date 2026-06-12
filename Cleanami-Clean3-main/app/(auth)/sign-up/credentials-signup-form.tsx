"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { signUpUser } from "@/lib/actions/auth.actions";
import Form from "next/form";
import { LockIcon, MailIcon } from "lucide-react";
import { AuthUserForm } from "@/lib/types/auth";

const CredentialsSignUpForm = () => {

const initialState: AuthUserForm = {
    success: false,
      data: {
        email: "",
      },
      error: {
        message: "",
    },
  }

  const [ data, action] = useActionState(signUpUser, initialState)

  const { pending } = useFormStatus();

  return (
    <Form action={action} className="space-y-6">
      

      <div>
        <label htmlFor="email" className="sr-only">
          Email address
        </label>
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <MailIcon className="h-5 w-5 text-gray-400" />
          </div>
          <input
            id="email"
            name="email"
            type="email"
            required
            defaultValue={data?.data.email}
            className="block w-full rounded-md border-gray-300 py-3 pl-10 pr-3 text-gray-900 shadow-sm focus:border-brand focus:ring-brand"
            placeholder="Email address"
          />
        </div>
      </div>
      <div>
        <label htmlFor="password" className="sr-only">
          Password
        </label>
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <LockIcon />
          </div>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="password"
            placeholder="Enter your password"
            required
            className="block w-full rounded-md border-gray-300 py-3 pl-10 pr-3 text-gray-900 shadow-sm focus:border-brand focus:ring-brand"
          />
        </div>
      </div>

      <div>
        <label htmlFor="confirm-password" className="sr-only">
          Confirm Password
        </label>
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <LockIcon />
          </div>
          <input
            id="confirm-password"
            name="confirm-password"
            type="password"
            autoComplete="password"
            required
            className="block w-full rounded-md border-gray-300 py-3 pl-10 pr-3 text-gray-900 shadow-sm focus:border-brand focus:ring-brand"
            placeholder="Confirm Password"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full justify-center rounded-lg bg-brand px-3 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand/60 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        {pending ? "Authenticating..." : "Sign up"}
      </button>
      {data && !data.success && (
        <div className="text-center text-red-700">{data?.error.message}</div>
      )}
    </Form>
  );
};

export default CredentialsSignUpForm;
