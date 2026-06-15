"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

export function CleanerRouteGuard({
  portalUnlocked,
  children,
}: {
  portalUnlocked: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const onOnboarding = pathname.startsWith("/cleaner/onboarding");

  useEffect(() => {
    if (!portalUnlocked && !onOnboarding) {
      router.replace("/cleaner/onboarding");
      return;
    }
    if (portalUnlocked && onOnboarding) {
      router.replace("/cleaner/jobs");
    }
  }, [portalUnlocked, onOnboarding, router]);

  if (!portalUnlocked && !onOnboarding) {
    return null;
  }

  return <>{children}</>;
}
