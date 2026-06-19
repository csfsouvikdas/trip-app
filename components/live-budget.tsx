"use client";

import * as React from "react";
import { useDashboard } from "@/components/providers";
import { DollarSign, Wallet, ArrowUpRight, TrendingDown } from "lucide-react";
import { cn } from "@/components/ui/button";

export function LiveBudget() {
  const { activeTrip, expenses, remainingBudget } = useDashboard();

  // Format currency helper
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(val);
  };

  // Calculate stats
  const totalSpent = React.useMemo(() => {
    return expenses.reduce((sum, exp) => sum + Number(exp.amount), 0);
  }, [expenses]);

  const spentPercentage = React.useMemo(() => {
    if (!activeTrip || activeTrip.total_budget === 0) return 0;
    return Math.min(Math.round((totalSpent / activeTrip.total_budget) * 100), 100);
  }, [activeTrip, totalSpent]);

  return (
    <header className="sticky top-0 z-20 w-full border-b border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 transition-apple">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
          Dashboard
        </h2>
        <p className="text-xs text-neutral-400">
          {activeTrip ? `Managing: ${activeTrip.name}` : "Please select or create a trip to get started"}
        </p>
      </div>

      {activeTrip && (
        <div className="flex items-center gap-6">
          {/* Live Remaining Budget Indicator */}
          <div className="flex flex-col items-end text-right">
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Remaining Budget
            </span>
            <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[hsl(var(--accent))] transition-apple">
              {formatCurrency(remainingBudget)}
            </span>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-neutral-500">
              <span>Total: {formatCurrency(activeTrip.total_budget)}</span>
              <span>•</span>
              <span className={cn(
                "font-medium",
                spentPercentage > 85 ? "text-red-500" : "text-neutral-500"
              )}>
                {spentPercentage}% spent
              </span>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
