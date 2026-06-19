"use client";

import * as React from "react";
import { Sidebar } from "@/components/sidebar";
import { LiveBudget } from "@/components/live-budget";
import { useDashboard } from "@/components/providers";
import { Loader2 } from "lucide-react";

import { useRouter } from "next/navigation";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile } = useDashboard();
  const router = useRouter();

  React.useEffect(() => {
    if (user && profile && profile.onboarded === false) {
      router.replace("/onboarding");
    }
  }, [user, profile, router]);

  // If user state is not loaded yet, render a premium loading screen
  if (!user) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center bg-neutral-50 dark:bg-neutral-950">
        <Loader2 className="h-8 w-8 animate-spin text-neutral-800 dark:text-neutral-200" />
        <p className="text-xs text-neutral-400 mt-2 font-medium tracking-wide">
          Syncing session...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 transition-apple">
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="md:pl-64 flex flex-col min-h-screen">
        {/* Top Sticky Budget Header */}
        <LiveBudget />

        {/* Dynamic Page Views */}
        <main className="flex-1 p-6 pb-24 md:pb-8 max-w-7xl w-full mx-auto animate-in fade-in duration-200">
          {children}
        </main>
      </div>
    </div>
  );
}
