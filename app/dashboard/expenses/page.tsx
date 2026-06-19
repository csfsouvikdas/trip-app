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
import { Plus, Trash2, Calendar, CreditCard, Tag, ArrowRight, Wallet, CheckSquare, AlertTriangle, Users, ArrowUpRight } from "lucide-react";
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

  const [description, setDescription] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [category, setCategory] = React.useState(categories[0]);
  const [date, setDate] = React.useState(new Date().toISOString().split("T")[0]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // Formatting currency
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(val);
  };

  // Fetch profiles for the splitter
  const { data: travelers = [] } = useQuery<any[]>({
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

  const totalSpent = React.useMemo(() => {
    return expenses.reduce((sum, exp) => sum + Number(exp.amount), 0);
  }, [expenses]);

  const spentPercentage = React.useMemo(() => {
    if (!activeTrip || activeTrip.total_budget === 0) return 0;
    return Math.min(Math.round((totalSpent / activeTrip.total_budget) * 100), 100);
  }, [activeTrip, totalSpent]);

  const splitterDetails = React.useMemo(() => {
    if (travelers.length === 0) return { balances: [], settlements: [], sharePerPerson: 0 };

    const sharePerPerson = totalSpent / travelers.length;

    // Track how much each traveler paid
    const paidMap: Record<string, number> = {};
    travelers.forEach((t) => {
      paidMap[t.username] = 0;
    });

    expenses.forEach((exp) => {
      const creator = exp.created_by || "unknown";
      if (paidMap[creator] !== undefined) {
        paidMap[creator] += Number(exp.amount);
      } else {
        const owner = activeTrip?.user_id;
        const ownerProfile = travelers.find((t) => t.id === owner);
        if (ownerProfile && paidMap[ownerProfile.username] !== undefined) {
          paidMap[ownerProfile.username] += Number(exp.amount);
        } else {
          paidMap[travelers[0].username] += Number(exp.amount);
        }
      }
    });

    // Calculate balances (Paid - Share)
    const balances = travelers.map((t) => {
      const paid = paidMap[t.username] || 0;
      const balance = paid - sharePerPerson;
      return {
        id: t.id,
        fullName: t.full_name,
        username: t.username,
        paid,
        balance,
      };
    });

    // Settle debts using greedy algorithm
    const debtors = balances
      .filter((b) => b.balance < -0.01)
      .map((b) => ({ ...b, balance: Math.abs(b.balance) }));
    const creditors = balances
      .filter((b) => b.balance > 0.01)
      .map((b) => ({ ...b }));

    debtors.sort((a, b) => b.balance - a.balance);
    creditors.sort((a, b) => b.balance - a.balance);

    const settlements: { from: string; to: string; amount: number }[] = [];
    let i = 0;
    let j = 0;

    while (i < debtors.length && j < creditors.length) {
      const debtor = debtors[i];
      const creditor = creditors[j];

      const amountToSettle = Math.min(debtor.balance, creditor.balance);
      settlements.push({
        from: debtor.fullName,
        to: creditor.fullName,
        amount: amountToSettle,
      });

      debtor.balance -= amountToSettle;
      creditor.balance -= amountToSettle;

      if (debtor.balance < 0.01) i++;
      if (creditor.balance < 0.01) j++;
    }

    return { balances, settlements, sharePerPerson };
  }, [travelers, expenses, activeTrip, totalSpent]);

  // Calculate expenses stats by category
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

      // Invalidate queries to refresh expenses list and trigger realtime sync recalculations
      queryClient.invalidateQueries({ queryKey: ["expenses", activeTrip.id] });

      // Reset form states
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
    try {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["expenses", activeTrip.id] });
    } catch (err: any) {
      alert(err.message || "Failed to delete expense");
    }
  };

  // If no active trip is selected
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

      {/* Main Expenses Area Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Form & category breakdown */}
        <div className="lg:col-span-1 space-y-6">
          {/* Add Expense Form Card */}
          <Card className="border border-neutral-100 dark:border-neutral-800">
            <form onSubmit={handleAddExpense}>
              <CardHeader>
                <CardTitle className="text-base font-semibold">Log Travel Expense</CardTitle>
                <CardDescription>Records are deducted from total budget.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {errorMsg && (
                  <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/40 text-red-600 dark:text-red-400 rounded-lg text-xs">
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

          {/* Category Breakdown list */}
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
                        {/* Background track */}
                        <circle
                          cx="50"
                          cy="50"
                          r="35"
                          fill="transparent"
                          stroke="currentColor"
                          className="text-neutral-100 dark:text-neutral-800"
                          strokeWidth="10"
                        />
                        {/* Segments */}
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
                      {/* Hole text */}
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

                    {/* Color legends list */}
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

                  {/* Progress bars list */}
                  {categorySummary.map((item) => (
                    <div key={item.category} className="space-y-1.5">
                      <div className="flex justify-between text-xs font-medium text-neutral-700 dark:text-neutral-300">
                        <span className="truncate">{item.category}</span>
                        <span>
                          {formatCurrency(item.amount)} ({item.percentage}%)
                        </span>
                      </div>
                      {/* Visual Progress Bar */}
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

          {/* Group Expense Splitter Card */}
          <Card className="border border-neutral-100 dark:border-neutral-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-1.5">
                <Users className="h-4.5 w-4.5 text-neutral-400" />
                Traveler Split & Debts
              </CardTitle>
              <CardDescription>Split expenses evenly among all trip group members.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-xs text-neutral-500 dark:text-neutral-400 font-semibold flex justify-between items-center bg-neutral-50 dark:bg-neutral-900/40 p-2.5 rounded-lg border border-neutral-100 dark:border-neutral-850">
                <span>Group size: {travelers.length} travelers</span>
                <span>Share: {formatCurrency(splitterDetails.sharePerPerson)}/person</span>
              </div>

              {/* Balances List */}
              <div className="space-y-2 pt-1">
                <h4 className="text-xs uppercase font-bold tracking-wider text-neutral-400">Traveler Balance Summary</h4>
                <div className="divide-y divide-neutral-100 dark:divide-neutral-800/60">
                  {splitterDetails.balances.map((b) => {
                    const isCreditor = b.balance > 0.01;
                    const isDebtor = b.balance < -0.01;
                    return (
                      <div key={b.username} className="py-2 flex justify-between items-center text-xs font-semibold">
                        <div className="space-y-0.5">
                          <p className="text-neutral-800 dark:text-neutral-200">{b.fullName}</p>
                          <p className="text-[10px] text-neutral-400 font-normal">Paid: {formatCurrency(b.paid)}</p>
                        </div>
                        <span className={
                          isCreditor ? "text-emerald-600 dark:text-emerald-500" :
                          isDebtor ? "text-red-500" : "text-neutral-400"
                        }>
                          {isCreditor ? `+${formatCurrency(b.balance)}` : 
                           isDebtor ? `-${formatCurrency(Math.abs(b.balance))}` : 
                           "Settled"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Settlement Actions */}
              <div className="space-y-2 pt-2 border-t border-neutral-100 dark:border-neutral-800/80">
                <h4 className="text-xs uppercase font-bold tracking-wider text-neutral-400">Suggested Settle Actions</h4>
                {splitterDetails.settlements.length === 0 ? (
                  <p className="text-xs text-neutral-400 text-center py-2">Everyone is settled! No transactions needed.</p>
                ) : (
                  <div className="space-y-1.5">
                    {splitterDetails.settlements.map((s, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs p-2 bg-neutral-50 dark:bg-neutral-900/30 border border-neutral-100/80 dark:border-neutral-850 rounded-lg">
                        <div className="flex items-center gap-1.5 text-neutral-700 dark:text-neutral-300 font-medium">
                          <span className="font-bold text-neutral-800 dark:text-neutral-200">{s.from}</span>
                          <span className="text-[10px] text-neutral-400">owes</span>
                          <span className="font-bold text-neutral-800 dark:text-neutral-200">{s.to}</span>
                        </div>
                        <span className="font-bold text-neutral-900 dark:text-neutral-50 flex items-center gap-1">
                          {formatCurrency(s.amount)}
                          <ArrowUpRight className="h-3.5 w-3.5 text-neutral-400" />
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
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
                <div className="py-20 text-center">
                  <span className="text-xs text-neutral-400">Loading log...</span>
                </div>
              ) : expenses.length === 0 ? (
                <div className="py-20 text-center text-neutral-400 text-xs border border-dashed border-neutral-100 dark:border-neutral-800 rounded-xl">
                  Log is currently empty.
                </div>
              ) : (
                <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
                  {expenses.map((exp) => (
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
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-sm font-bold text-red-500">
                          -{formatCurrency(Number(exp.amount))}
                        </span>
                        <button
                          onClick={() => handleDeleteExpense(exp.id)}
                          className="p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded transition-apple cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100"
                          title="Delete Transaction"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
