import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CleanerBottomNav } from "@/components/cleaner/CleanerBottomNav";
import { CleanerHeader } from "@/components/cleaner/CleanerHeader";

export default async function CleanerLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;
  const userRole = user?.user_metadata?.role;

  if (!user || userRole !== "cleaner") {
    redirect("/sign-in");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <CleanerHeader />
      <main className="mx-auto max-w-lg px-4 py-6 pb-24">{children}</main>
      <CleanerBottomNav />
    </div>
  );
}
