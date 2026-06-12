import type { Metadata } from "next";

import "./globals.css";
import { APP_DESCRIPTION, APP_NAME } from "@/lib/constants";
import { QueryProvider } from "@/providers/query-provider";
import GoogleAnalytics from "@/components/AnalyticsTracking";

export const metadata: Metadata = {
  title: APP_NAME,
  description: APP_DESCRIPTION,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Google Ads Conversion Tracking */}
        <GoogleAnalytics />
      </head>

      <body className="antialiased">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
