"use client";

import * as React from "react";
import { useDashboard } from "@/components/providers";
import { createClient } from "@/lib/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, Calendar, CreditCard, Tag, ArrowRight, Wallet, CheckSquare, AlertTriangle, User, Users, ArrowUpRight, Loader2, Sparkles, AlertCircle } from "lucide-react";
import Link from "next/link";

const categories = [
  "Food & Dining",
  "Lodging & Hotels",
  "Transit & Flights",
  "Activities & Tours",
  "Shopping & Souvenirs",
  "Entertainment",
  "Miscellaneous",
];

const CATEGORY_COLORS: Record<string, string> = {
  "Food & Dining": "#f59e0b",       // Amber
  "Lodging & Hotels": "#3b82f6",     // Blue
  "Transit & Flights": "#6366f1",     // Indigo
  "Activities & Tours": "#10b981",    // Emerald
  "Shopping & Souvenirs": "#ec4899", // Pink
  "Entertainment": "#a855f7",        // Purple
  "Miscellaneous": "#737373",        // Neutral
};

export default function ExpensesPage() {
  const { activeTrip, expenses, remainingBudget, isLoadingExpenses, profile } = useDashboard();
  const supabase = createClient();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = React.useState<"log" | "splitter">("log");
  const [description, setDescription] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [category, setCategory] = React.useState(categories[0]);
  const [date, setDate] = React.useState(new Date().toISOString().split("T")[0]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // Manual settlement state
  const [settleFrom, setSettleFrom] = React.useState("");
  const [settleTo, setSettleTo] = React.useState("");
  const [settleAmount, setSettleAmount] = React.useState("");
  const [settleSubmitting, setSettleSubmitting] = React.useState(false);

  // Fetch travelers for splitter calculations
  const { data: travelers = [], isLoading: isLoadingTravelers } = useQuery<any[]>({
    queryKey: ["splitter_travelers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, username")
        .order("full_name", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Fetch settlements logged
  const { data: settlements = [], isLoading: isLoadingSettlements, refetch: refetchSettlements } = useQuery<any[]>({
    queryKey: ["settlements", activeTrip?.id],
    queryFn: async () => {
      if (!activeTrip?.id) return [];
      const { data, error } = await supabase
        .from("settlements")
        .select("*")
        .eq("trip_id", activeTrip.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!activeTrip?.id,
  });

  const displayedExpenses = React.useMemo(() => {
    if (!expenses) return [];
    if (profile?.is_admin) return expenses;
    return expenses.filter((exp) => exp.created_by === profile?.username);
  }, [expenses, profile]);

  const totalSpent = React.useMemo(() => {
    return expenses.reduce((sum, exp) => sum + Number(exp.amount), 0);
  }, [expenses]);

  const spentPercentage = React.useMemo(() => {
    if (!activeTrip || activeTrip.total_budget === 0) return 0;
    return Math.min(Math.round((totalSpent / activeTrip.total_budget) * 100), 100);
  }, [activeTrip, totalSpent]);

  // Advanced Splitter calculations
  const splitterDetails = React.useMemo(() => {
    if (travelers.length === 0) return { balances: [], settlements: [], sharePerPerson: 0 };

    const sharePerPerson = totalSpent / travelers.length;

    // Calculate sum paid in expenses by each traveler
    const paidMap: Record<string, number> = {};
    travelers.forEach((t) => {
      paidMap[t.id] = 0;
    });

    expenses.forEach((exp) => {
      const creator = exp.created_by;
      const traveler = travelers.find((t) => t.username === creator);
      if (traveler) {
        paidMap[traveler.id] += Number(exp.amount);
      } else {
        const owner = activeTrip?.user_id;
        const ownerProfile = travelers.find((t) => t.id === owner);
        if (ownerProfile) {
          paidMap[ownerProfile.id] += Number(exp.amount);
        } else {
          paidMap[travelers[0].id] += Number(exp.amount);
        }
      }
    });

    // Calculate direct settlements sent/received
    const sentMap: Record<string, number> = {};
    const receivedMap: Record<string, number> = {};
    travelers.forEach((t) => {
      sentMap[t.id] = 0;
      receivedMap[t.id] = 0;
    });

    settlements.forEach((s) => {
      const amt = Number(s.amount);
      if (sentMap[s.from_profile_id] !== undefined) {
        sentMap[s.from_profile_id] += amt;
      }
      if (receivedMap[s.to_profile_id] !== undefined) {
        receivedMap[s.to_profile_id] += amt;
      }
    });

    // Adjusted Balances: ExpensesPaid + SettlementsSent - SettlementsReceived
    const balances = travelers.map((t) => {
      const expPaid = paidMap[t.id] || 0;
      const sent = sentMap[t.id] || 0;
      const received = receivedMap[t.id] || 0;
      const adjustedPaid = expPaid + sent - received;
      const balance = adjustedPaid - sharePerPerson;
      return {
        id: t.id,
        fullName: t.full_name,
        username: t.username,
        expPaid,
        adjustedPaid,
        balance,
      };
    });

    // Calculate suggested transactions to settle remaining balances using greedy matcher
    const debtors = balances
      .filter((b) => b.balance < -0.01)
      .map((b) => ({ ...b, balance: Math.abs(b.balance) }));
    const creditors = balances
      .filter((b) => b.balance > 0.01)
      .map((b) => ({ ...b }));

    debtors.sort((a, b) => b.balance - a.balance);
    creditors.sort((a, b) => b.balance - a.balance);

    const suggestions: { fromId: string; fromName: string; toId: string; toName: string; amount: number }[] = [];
    let i = 0;
    let j = 0;

    while (i < debtors.length && j < creditors.length) {
      const debtor = debtors[i];
      const creditor = creditors[j];
      const amountToSettle = Math.min(debtor.balance, creditor.balance);

      suggestions.push({
        fromId: debtor.id,
        fromName: debtor.fullName,
        toId: creditor.id,
        toName: creditor.fullName,
        amount: amountToSettle,
      });

      debtor.balance -= amountToSettle;
      creditor.balance -= amountToSettle;

      if (debtor.balance < 0.01) i++;
      if (creditor.balance < 0.01) j++;
    }

    return { balances, settlements: suggestions, sharePerPerson };
  }, [travelers, expenses, settlements, totalSpent, activeTrip]);

  // Formatting currency helper
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(val);
  };

  // Category breakdown summary list
  const categorySummary = React.useMemo(() => {
    const sumMap: Record<string, number> = {};
    categories.forEach((cat) => {
      sumMap[cat] = 0;
    });

    let total = 0;
    expenses.forEach((exp) => {
      const amt = Number(exp.amount);
      if (sumMap[exp.category] !== undefined) {
        sumMap[exp.category] += amt;
      } else {
        sumMap[exp.category] = amt;
      }
      total += amt;
    });

    return Object.entries(sumMap)
      .map(([cat, amt]) => ({
        category: cat,
        amount: amt,
        percentage: total > 0 ? Math.round((amt / total) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [expenses]);

  const handleAddExpense = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!activeTrip) return;
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const amtNum = Number(amount);
      if (isNaN(amtNum) || amtNum <= 0) {
        throw new Error("Please enter a valid expense amount greater than 0");
      }

      const { error } = await supabase.from("expenses").insert({
        trip_id: activeTrip.id,
        description,
        amount: amtNum,
        category,
        date,
        created_by: profile?.username || "unknown",
      });

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["expenses", activeTrip.id] });
      setDescription("");
      setAmount("");
      setCategory(categories[0]);
      setDate(new Date().toISOString().split("T")[0]);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to add expense");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (!activeTrip) return;
    if (!profile?.is_admin) {
      alert("Only administrators are permitted to delete expense records.");
      return;
    }
    try {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["expenses", activeTrip.id] });
    } catch (err: any) {
      alert(err.message || "Failed to delete expense");
    }
  };

  // Direct settlement recordings
  const handleRecordSettlement = async (fromId: string, toId: string, amt: number) => {
    if (!activeTrip) return;
    try {
      const { error } = await supabase.from("settlements").insert({
        trip_id: activeTrip.id,
        from_profile_id: fromId,
        to_profile_id: toId,
        amount: amt,
      });

      if (error) throw error;
      refetchSettlements();
    } catch (err: any) {
      alert(err.message || "Failed to record settlement payment");
    }
  };

  const handleManualSettlementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTrip || !settleFrom || !settleTo || !settleAmount) return;
    if (settleFrom === settleTo) {
      alert("Payer and receiver cannot be the same traveler!");
      return;
    }

    const amt = Number(settleAmount);
    if (isNaN(amt) || amt <= 0) {
      alert("Please enter a valid positive settlement amount.");
      return;
    }

    setSettleSubmitting(true);
    try {
      const { error } = await supabase.from("settlements").insert({
        trip_id: activeTrip.id,
        from_profile_id: settleFrom,
        to_profile_id: settleTo,
        amount: amt,
      });

      if (error) throw error;
      setSettleAmount("");
      refetchSettlements();
    } catch (err: any) {
      alert(err.message || "Failed to record manual settlement");
    } finally {
      setSettleSubmitting(false);
    }
  };

  const handleDeleteSettlement = async (settlementId: string) => {
    if (!profile?.is_admin) {
      alert("Only administrators can delete recorded settlements.");
      return;
    }
    if (!confirm("Are you sure you want to delete this settlement record?")) return;

    try {
      const { error } = await supabase.from("settlements").delete().eq("id", settlementId);
      if (error) throw error;
      refetchSettlements();
    } catch (err: any) {
      alert(err.message || "Failed to delete settlement record");
    }
  };

  // Get traveler details by ID
  const getTravelerName = (id: string) => {
    const t = travelers.find((x) => x.id === id);
    return t ? t.full_name : "Unknown User";
  };

  if (!activeTrip) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center max-w-md mx-auto">
        <div className="h-12 w-12 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-400 flex items-center justify-center mb-4">
          <CreditCard className="h-6 w-6" />
        </div>
        <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-50">No Active Trip Workspace</h3>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-2">
          You must activate a trip workspace before managing travel expenses.
        </p>
        <Link href="/dashboard/trips" className="mt-5">
          <Button variant="default" className="cursor-pointer">
            Go to Trips
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Alert banner if spent > 85% */}
      {spentPercentage >= 85 && (
        <div className="p-4 rounded-xl border border-red-200/60 dark:border-red-950/40 bg-red-50/70 dark:bg-red-950/10 text-red-700 dark:text-red-400 glass flex items-start gap-3 transition-apple animate-in fade-in slide-in-from-top-4 duration-300">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-sm">Warning: Budget Almost Depleted</h4>
            <p className="text-xs mt-0.5 opacity-90 leading-normal font-medium">
              You have spent {spentPercentage}% of your total trip budget. Only {formatCurrency(remainingBudget)} remains. Please coordinate group spending.
            </p>
          </div>
        </div>
      )}

      {/* Header and Sub-Tab Navigator */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-100 dark:border-neutral-800/80 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50 flex items-center gap-2">
            <CreditCard className="h-6 w-6 text-neutral-800 dark:text-neutral-200" />
            Group Expenses & Splitter
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            Track category spending and coordinate settlements among travel gang members.
          </p>
        </div>

        <div className="flex gap-1.5 p-1 bg-neutral-100 dark:bg-neutral-950 rounded-xl border border-neutral-200/30 dark:border-neutral-800/50 self-start md:self-auto">
          <button
            onClick={() => setActiveTab("log")}
            className={`px-4 py-2 text-xs font-semibold rounded-lg cursor-pointer transition-all ${
              activeTab === "log"
                ? "bg-white text-neutral-950 shadow-sm dark:bg-neutral-900 dark:text-white"
                : "text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-350"
            }`}
          >
            Expense Log
          </button>
          <button
            onClick={() => setActiveTab("splitter")}
            className={`px-4 py-2 text-xs font-semibold rounded-lg cursor-pointer transition-all ${
              activeTab === "splitter"
                ? "bg-white text-neutral-950 shadow-sm dark:bg-neutral-900 dark:text-white"
                : "text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-350"
            }`}
          >
            Splitter & Settlements
          </button>
        </div>
      </div>

      {/* Tab content rendering */}
      {activeTab === "log" ? (
        <>
          {/* Overview header stats card */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="border border-neutral-100 dark:border-neutral-800">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs flex items-center gap-1.5 uppercase font-bold tracking-wider text-neutral-400">
                  <Wallet className="h-3.5 w-3.5" />
                  Total Budget
                </CardDescription>
                <CardTitle className="text-2xl font-bold tracking-tight text-neutral-800 dark:text-neutral-200">
                  {formatCurrency(activeTrip.total_budget)}
                </CardTitle>
              </CardHeader>
            </Card>

            <Card className="border border-neutral-100 dark:border-neutral-800">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs flex items-center gap-1.5 uppercase font-bold tracking-wider text-neutral-400">
                  <CreditCard className="h-3.5 w-3.5" />
                  Total Spent
                </CardDescription>
                <CardTitle className="text-2xl font-bold tracking-tight text-neutral-800 dark:text-neutral-200">
                  {formatCurrency(totalSpent)}
                </CardTitle>
              </CardHeader>
            </Card>

            <Card className="border border-neutral-100 dark:border-neutral-800">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs flex items-center gap-1.5 uppercase font-bold tracking-wider text-neutral-400">
                  <CheckSquare className="h-3.5 w-3.5" />
                  Remaining Funds
                </CardDescription>
                <CardTitle className="text-2xl font-bold tracking-tight text-[hsl(var(--accent))]">
                  {formatCurrency(remainingBudget)}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Form & category breakdown */}
            <div className="lg:col-span-1 space-y-6">
              <Card className="border border-neutral-100 dark:border-neutral-800">
                <form onSubmit={handleAddExpense}>
                  <CardHeader>
                    <CardTitle className="text-base font-semibold">Log Travel Expense</CardTitle>
                    <CardDescription>Records are deducted from total budget.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {errorMsg && (
                      <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/40 text-red-600 dark:text-red-400 rounded-lg text-xs animate-shake">
                        {errorMsg}
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <Label htmlFor="description">Description</Label>
                      <Input
                        id="description"
                        placeholder="e.g. Dinner at Ramen shop"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="amount">Amount (₹)</Label>
                      <Input
                        id="amount"
                        type="number"
                        step="0.01"
                        placeholder="e.g. 500"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="category">Category</Label>
                      <Select
                        id="category"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                      >
                        {categories.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="date">Date</Label>
                      <Input
                        id="date"
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        required
                      />
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button type="submit" disabled={isSubmitting} className="w-full cursor-pointer text-xs" variant="default">
                      {isSubmitting ? "Logging..." : "Log Expense"}
                    </Button>
                  </CardFooter>
                </form>
              </Card>

              {/* Spending Breakdown */}
              <Card className="border border-neutral-100 dark:border-neutral-800">
                <CardHeader>
                  <CardTitle className="text-base font-semibold">Spending Breakdown</CardTitle>
                  <CardDescription>Grouped category distribution.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {expenses.length === 0 ? (
                    <p className="text-xs text-neutral-400 text-center py-4">No categories recorded.</p>
                  ) : (
                    <>
                      {/* SVG Donut Chart */}
                      <div className="flex flex-col sm:flex-row items-center gap-6 justify-center py-2 border-b border-neutral-100 dark:border-neutral-800 pb-6 mb-4">
                        <div className="relative h-28 w-28 shrink-0">
                          <svg width="100%" height="100%" viewBox="0 0 100 100" className="transform -rotate-90">
                            <circle
                              cx="50"
                              cy="50"
                              r="35"
                              fill="transparent"
                              stroke="currentColor"
                              className="text-neutral-100 dark:text-neutral-800"
                              strokeWidth="10"
                            />
                            {(() => {
                              let accumulatedOffset = 0;
                              const rVal = 35;
                              const circ = 2 * Math.PI * rVal;
                              return categorySummary.map((item) => {
                                if (item.amount === 0) return null;
                                const strokeLength = (item.percentage / 100) * circ;
                                const offset = accumulatedOffset;
                                accumulatedOffset += strokeLength;
                                const color = CATEGORY_COLORS[item.category] || "#737373";

                                return (
                                  <circle
                                    key={item.category}
                                    cx="50"
                                    cy="50"
                                    r={rVal}
                                    fill="transparent"
                                    stroke={color}
                                    strokeWidth="10"
                                    strokeDasharray={`${strokeLength} ${circ}`}
                                    strokeDashoffset={-offset}
                                    strokeLinecap="round"
                                    className="transition-all duration-500 ease-out"
                                  />
                                );
                              });
                            })()}
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Spent</span>
                            <span className="text-xs font-black text-neutral-800 dark:text-neutral-200">
                              {new Intl.NumberFormat("en-IN", {
                                style: "currency",
                                currency: "INR",
                                maximumFractionDigits: 0,
                              }).format(totalSpent)}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[10px] font-semibold text-neutral-500 w-full sm:w-auto">
                          {categorySummary.slice(0, 4).map((item) => (
                            <div key={item.category} className="flex items-center gap-1.5 truncate">
                              <span
                                className="h-2 w-2 rounded-full shrink-0"
                                style={{ backgroundColor: CATEGORY_COLORS[item.category] || "#737373" }}
                              />
                              <span className="truncate">{item.category}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {categorySummary.map((item) => (
                        <div key={item.category} className="space-y-1.5">
                          <div className="flex justify-between text-xs font-medium text-neutral-700 dark:text-neutral-300">
                            <span className="truncate">{item.category}</span>
                            <span>
                              {formatCurrency(item.amount)} ({item.percentage}%)
                            </span>
                          </div>
                          <div className="w-full bg-neutral-100 dark:bg-neutral-800 h-1.5 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-apple"
                              style={{
                                width: `${item.percentage}%`,
                                backgroundColor: CATEGORY_COLORS[item.category] || "#737373"
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right Column: Transaction history list */}
            <div className="lg:col-span-2">
              <Card className="border border-neutral-100 dark:border-neutral-800 h-full flex flex-col">
                <CardHeader>
                  <CardTitle className="text-base font-semibold">Expense Log</CardTitle>
                  <CardDescription>Chronological list of all expenses incurred.</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto max-h-[600px] space-y-4">
                  {isLoadingExpenses ? (
                    <div className="py-20 text-center flex justify-center items-center">
                      <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
                    </div>
                  ) : displayedExpenses.length === 0 ? (
                    <div className="py-20 text-center text-neutral-400 text-xs border border-dashed border-neutral-100 dark:border-neutral-800 rounded-xl">
                      Log is currently empty.
                    </div>
                  ) : (
                    <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
                      {displayedExpenses.map((exp) => (
                        <div
                          key={exp.id}
                          className="py-3.5 flex items-center justify-between gap-4 group transition-colors hover:bg-neutral-50/50 dark:hover:bg-neutral-900/20 px-2 rounded-lg"
                        >
                          <div className="space-y-1 overflow-hidden">
                            <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 truncate">
                              {exp.description}
                            </p>
                            <div className="flex items-center gap-3 text-xs text-neutral-400">
                              <span className="flex items-center gap-1">
                                <Tag className="h-3.5 w-3.5" />
                                {exp.category}
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3.5 w-3.5" />
                                {exp.date}
                              </span>
                              {exp.created_by && (
                                <span className="flex items-center gap-1 text-neutral-600 dark:text-neutral-400 font-medium">
                                  <User className="h-3.5 w-3.5 text-neutral-400" />
                                  by @{exp.created_by}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-sm font-bold text-red-500">
                              -{formatCurrency(Number(exp.amount))}
                            </span>
                            {profile?.is_admin && (
                              <button
                                onClick={() => handleDeleteExpense(exp.id)}
                                className="p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded transition-apple cursor-pointer opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100"
                                title="Delete Transaction"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      ) : (
        /* Tab 2: Splitter & Settlements tab content rendering */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Balances overview */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="border border-neutral-100 dark:border-neutral-800">
              <CardHeader className="pb-3 border-b border-neutral-100 dark:border-neutral-800/80 mb-4">
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-base font-semibold flex items-center gap-1.5">
                      <Users className="h-4.5 w-4.5 text-neutral-400" />
                      Adjusted Traveler Balances
                    </CardTitle>
                    <CardDescription>Expenses paid + settlements sent - settlements received.</CardDescription>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider block">Target Share</span>
                    <span className="text-base font-bold text-neutral-800 dark:text-neutral-200">
                      {formatCurrency(splitterDetails.sharePerPerson)} <span className="text-[10px] text-neutral-400 font-normal">/ person</span>
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {isLoadingTravelers || isLoadingExpenses || isLoadingSettlements ? (
                  <div className="py-12 text-center text-xs text-neutral-400 flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />
                    Calculating balances roster...
                  </div>
                ) : travelers.length === 0 ? (
                  <div className="py-12 text-center text-xs text-neutral-400">
                    No active traveler profiles found.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {splitterDetails.balances.map((b) => {
                      const isCreditor = b.balance > 0.01;
                      const isDebtor = b.balance < -0.01;
                      return (
                        <div
                          key={b.id}
                          className={`p-4 rounded-xl border flex flex-col justify-between space-y-3 transition-apple hover:shadow-sm ${
                            isCreditor ? "bg-emerald-50/10 border-emerald-100/60 dark:border-emerald-950/20" :
                            isDebtor ? "bg-red-50/10 border-red-100/60 dark:border-red-950/20" :
                            "bg-neutral-50/30 border-neutral-100 dark:border-neutral-850"
                          }`}
                        >
                          <div className="flex justify-between items-start gap-2">
                            <div>
                              <p className="text-sm font-bold text-neutral-800 dark:text-neutral-200">{b.fullName}</p>
                              <p className="text-[10px] text-neutral-400">@{b.username}</p>
                            </div>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-bold uppercase tracking-wider text-[9px] ${
                              isCreditor ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" :
                              isDebtor ? "bg-red-500/10 text-red-500 border border-red-500/20" :
                              "bg-neutral-500/15 text-neutral-500 border border-neutral-500/10"
                            }`}>
                              {isCreditor ? "Is Owed" : isDebtor ? "Owes" : "Settled"}
                            </span>
                          </div>

                          <div className="space-y-1.5 border-t border-neutral-100 dark:border-neutral-800/40 pt-2.5 text-[11px] font-medium text-neutral-500 dark:text-neutral-450">
                            <div className="flex justify-between">
                              <span>Initial Spent (Expenses):</span>
                              <span className="font-semibold text-neutral-800 dark:text-neutral-300">{formatCurrency(b.expPaid)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Settlements Adjusted:</span>
                              <span className="font-semibold text-neutral-800 dark:text-neutral-300">{formatCurrency(b.adjustedPaid - b.expPaid)}</span>
                            </div>
                            <div className="flex justify-between border-t border-neutral-100/60 dark:border-neutral-800/20 pt-1.5 font-bold text-xs">
                              <span>Final Balance:</span>
                              <span className={
                                isCreditor ? "text-emerald-500" :
                                isDebtor ? "text-red-500" : "text-neutral-400"
                              }>
                                {isCreditor ? `+${formatCurrency(b.balance)}` : 
                                 isDebtor ? `-${formatCurrency(Math.abs(b.balance))}` : 
                                 "Settled"}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* suggested settlements panel */}
            <Card className="border border-neutral-100 dark:border-neutral-800">
              <CardHeader>
                <CardTitle className="text-base font-semibold flex items-center gap-1.5">
                  <ArrowUpRight className="h-4.5 w-4.5 text-neutral-400" />
                  Suggested Settlements
                </CardTitle>
                <CardDescription>Clearest transactions to settle all debts in the gang.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {splitterDetails.settlements.length === 0 ? (
                  <div className="py-8 text-center text-xs text-neutral-400 border border-dashed border-neutral-100 dark:border-neutral-850 rounded-xl">
                    🎉 Everyone is settled! No transactions needed.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {splitterDetails.settlements.map((s, idx) => (
                      <div
                        key={idx}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-neutral-50/40 dark:bg-neutral-950/20 border border-neutral-100/80 dark:border-neutral-850 rounded-xl"
                      >
                        <div className="flex items-center gap-2 text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                          <span className="font-bold text-neutral-900 dark:text-neutral-100">{s.fromName}</span>
                          <span className="text-[10px] text-neutral-400 font-normal uppercase tracking-wider px-1">owes</span>
                          <span className="font-bold text-neutral-900 dark:text-neutral-100">{s.toName}</span>
                          <span className="text-base font-bold text-neutral-900 dark:text-neutral-50 ml-2">
                            {formatCurrency(s.amount)}
                          </span>
                        </div>
                        <Button
                          onClick={() => handleRecordSettlement(s.fromId, s.toId, s.amount)}
                          size="sm"
                          variant="accent"
                          className="text-[10px] h-8 px-3 cursor-pointer self-end sm:self-auto font-bold"
                        >
                          Record Payment Done ✔️
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* settlements history log */}
            <Card className="border border-neutral-100 dark:border-neutral-800">
              <CardHeader>
                <CardTitle className="text-base font-semibold">Settlement Ledger</CardTitle>
                <CardDescription>History of logged member direct payments.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {isLoadingSettlements ? (
                  <div className="py-8 text-center text-xs text-neutral-400">Loading ledger...</div>
                ) : settlements.length === 0 ? (
                  <div className="py-8 text-center text-xs text-neutral-400 border border-dashed border-neutral-100 dark:border-neutral-850 rounded-xl">
                    Ledger is currently empty.
                  </div>
                ) : (
                  <div className="divide-y divide-neutral-100 dark:divide-neutral-800/60 max-h-[300px] overflow-y-auto pr-1">
                    {settlements.map((s) => (
                      <div key={s.id} className="py-2.5 flex items-center justify-between text-xs font-medium group transition-colors">
                        <div className="space-y-0.5">
                          <p className="text-neutral-800 dark:text-neutral-200">
                            <span className="font-semibold">{getTravelerName(s.from_profile_id)}</span> paid{" "}
                            <span className="font-semibold">{getTravelerName(s.to_profile_id)}</span>
                          </p>
                          <p className="text-[10px] text-neutral-400">{new Date(s.created_at).toLocaleDateString()}</p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="font-bold text-emerald-500">
                            {formatCurrency(Number(s.amount))}
                          </span>
                          {profile?.is_admin && (
                            <button
                              onClick={() => handleDeleteSettlement(s.id)}
                              className="p-1 text-neutral-400 hover:text-red-500 dark:hover:text-red-400 rounded transition-apple cursor-pointer opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                              title="Delete Settlement Record"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Custom Settlement Logger Form */}
          <div className="lg:col-span-1">
            <Card className="border border-neutral-100 dark:border-neutral-800 sticky top-24">
              <form onSubmit={handleManualSettlementSubmit}>
                <CardHeader>
                  <CardTitle className="text-base font-semibold">Log Custom Settlement</CardTitle>
                  <CardDescription>Manually record direct transfers between travel members.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="settleFrom">Payer (Who Paid)</Label>
                    <Select
                      id="settleFrom"
                      value={settleFrom}
                      onChange={(e) => setSettleFrom(e.target.value)}
                      required
                    >
                      <option value="">-- Choose Payer --</option>
                      {travelers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.full_name} (@{t.username})
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="settleTo">Receiver (Who Received)</Label>
                    <Select
                      id="settleTo"
                      value={settleTo}
                      onChange={(e) => setSettleTo(e.target.value)}
                      required
                    >
                      <option value="">-- Choose Receiver --</option>
                      {travelers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.full_name} (@{t.username})
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="settleAmount">Amount Paid (₹)</Label>
                    <Input
                      id="settleAmount"
                      type="number"
                      step="0.01"
                      placeholder="e.g. 1000"
                      value={settleAmount}
                      onChange={(e) => setSettleAmount(e.target.value)}
                      required
                    />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button type="submit" disabled={settleSubmitting} className="w-full cursor-pointer text-xs" variant="default">
                    {settleSubmitting ? (
                      <>
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        Logging...
                      </>
                    ) : (
                      <>
                        <Plus className="mr-1.5 h-3.5 w-3.5" />
                        Log Settlement Payment
                      </>
                    )}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
