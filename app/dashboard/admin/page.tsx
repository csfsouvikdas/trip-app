"use client";

import * as React from "react";
import { useDashboard, type Profile, type Trip } from "@/components/providers";
import { createClient } from "@/lib/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select } from "@/components/ui/select";
import { Shield, Plus, Trash2, Users, Map, Wallet, ShieldAlert, Loader2, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";

interface AdminTrip extends Trip {
  profiles?: {
    full_name: string;
    username: string;
  } | null;
}

export default function AdminPanelPage() {
  const { profile } = useDashboard();
  const supabase = createClient();
  const queryClient = useQueryClient();
  const router = useRouter();

  const [activeTab, setActiveTab] = React.useState<"users" | "trips" | "expenses">("users");

  // Form states for creating/assigning a new trip
  const [newTripName, setNewTripName] = React.useState("");
  const [newTripBudget, setNewTripBudget] = React.useState("");
  const [newTripUserId, setNewTripUserId] = React.useState("");
  const [isSubmittingTrip, setIsSubmittingTrip] = React.useState(false);
  const [tripErrorMsg, setTripErrorMsg] = React.useState<string | null>(null);

  // Form states for creating a new user
  const [newFullName, setNewFullName] = React.useState("");
  const [newUsername, setNewUsername] = React.useState("");
  const [newEmail, setNewEmail] = React.useState("");
  const [newIsAdmin, setNewIsAdmin] = React.useState(false);
  const [isSubmittingUser, setIsSubmittingUser] = React.useState(false);
  const [userErrorMsg, setUserErrorMsg] = React.useState<string | null>(null);

  // Redirect if not an admin
  React.useEffect(() => {
    if (profile && !profile.is_admin) {
      router.replace("/dashboard");
    }
  }, [profile, router]);

  // Fetch all profiles
  const { data: users = [], isLoading: isLoadingUsers } = useQuery<Profile[]>({
    queryKey: ["admin_users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("full_name", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.is_admin,
  });

  // Fetch all trips with owners
  const { data: trips = [], isLoading: isLoadingTrips } = useQuery<AdminTrip[]>({
    queryKey: ["admin_trips"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trips")
        .select("*, profiles (full_name, username)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as AdminTrip[];
    },
    enabled: !!profile?.is_admin,
  });

  // Fetch global stats (all expenses for summing)
  const { data: expenses = [] } = useQuery<{ amount: number }[]>({
    queryKey: ["admin_expenses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("expenses").select("amount");
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.is_admin,
  });

  // Fetch all expenses with user/trip details for global log
  const { data: globalExpenses = [], isLoading: isLoadingGlobalExpenses } = useQuery<any[]>({
    queryKey: ["admin_global_expenses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*, trips (name, user_id, profiles (full_name, username))")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.is_admin,
  });

  const handleCreateUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newFullName.trim() || !newUsername.trim()) return;
    setIsSubmittingUser(true);
    setUserErrorMsg(null);

    try {
      const cleanedUsername = newUsername.trim().toLowerCase();

      // Check if username already exists
      const { data: existingUser } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", cleanedUsername)
        .maybeSingle();

      if (existingUser) {
        throw new Error("Username already taken.");
      }

      const { error } = await supabase.from("profiles").insert({
        full_name: newFullName.trim(),
        username: cleanedUsername,
        email: newEmail.trim() || null,
        is_admin: newIsAdmin,
      });

      if (error) throw error;

      // Invalidate queries to refresh lists
      queryClient.invalidateQueries({ queryKey: ["admin_users"] });
      
      // Clear form
      setNewFullName("");
      setNewUsername("");
      setNewEmail("");
      setNewIsAdmin(false);
    } catch (err: any) {
      setUserErrorMsg(err.message || "Failed to create user");
    } finally {
      setIsSubmittingUser(false);
    }
  };

  const handleDeleteUser = async (userId: string, username: string) => {
    if (username === "souvik") {
      alert("Cannot delete the primary administrator account.");
      return;
    }

    if (!confirm(`Are you sure you want to delete the user "${username}"? This will delete all of their trips, checklists, and expenses permanently.`)) {
      return;
    }

    try {
      const { error } = await supabase.from("profiles").delete().eq("id", userId);
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["admin_users"] });
      queryClient.invalidateQueries({ queryKey: ["admin_trips"] });
    } catch (err: any) {
      alert(err.message || "Failed to delete user");
    }
  };

  const handleDeleteTrip = async (tripId: string, tripName: string) => {
    if (!confirm(`Are you sure you want to delete the trip "${tripName}" and all of its logged expenses?`)) {
      return;
    }

    try {
      const { error } = await supabase.from("trips").delete().eq("id", tripId);
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["admin_trips"] });
    } catch (err: any) {
      alert(err.message || "Failed to delete trip");
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(val);
  };

  const handleCreateTrip = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newTripName.trim() || !newTripUserId || !newTripBudget.trim()) return;
    setIsSubmittingTrip(true);
    setTripErrorMsg(null);

    try {
      const budgetNum = Number(newTripBudget);
      if (isNaN(budgetNum) || budgetNum < 0) {
        throw new Error("Please enter a valid positive budget number");
      }

      const { error } = await supabase.from("trips").insert({
        name: newTripName.trim(),
        total_budget: budgetNum,
        user_id: newTripUserId,
      });

      if (error) throw error;

      // Invalidate queries to refresh lists
      queryClient.invalidateQueries({ queryKey: ["admin_trips"] });
      
      // Reset form
      setNewTripName("");
      setNewTripBudget("");
      setNewTripUserId("");
    } catch (err: any) {
      setTripErrorMsg(err.message || "Failed to create trip");
    } finally {
      setIsSubmittingTrip(false);
    }
  };

  const handleDeleteExpense = async (expenseId: string, description: string) => {
    if (!confirm(`Are you sure you want to delete the expense "${description}"?`)) {
      return;
    }

    try {
      const { error } = await supabase.from("expenses").delete().eq("id", expenseId);
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["admin_global_expenses"] });
      queryClient.invalidateQueries({ queryKey: ["admin_expenses"] }); // Refresh stats count
    } catch (err: any) {
      alert(err.message || "Failed to delete expense");
    }
  };

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (!profile.is_admin) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center max-w-md mx-auto">
        <div className="h-12 w-12 rounded-full bg-red-50 dark:bg-red-950/20 text-red-500 flex items-center justify-center mb-4">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-50">Access Denied</h3>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-2">
          You do not have administrative privileges to access this area.
        </p>
        <Button onClick={() => router.push("/dashboard")} className="mt-5">
          Return to Dashboard
        </Button>
      </div>
    );
  }

  const totalSpent = expenses.reduce((sum, exp) => sum + Number(exp.amount), 0);
  const totalBudget = trips.reduce((sum, trip) => sum + Number(trip.total_budget), 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50 flex items-center gap-2">
          <Shield className="h-6 w-6 text-neutral-800 dark:text-neutral-200" />
          Admin Panel
        </h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
          Manage system users and monitor global travel planning metrics.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border border-neutral-200 dark:border-neutral-800">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase font-bold tracking-wider text-neutral-400 flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" /> Total Users
            </CardDescription>
            <CardTitle className="text-2xl font-bold">{users.length}</CardTitle>
          </CardHeader>
        </Card>

        <Card className="border border-neutral-200 dark:border-neutral-800">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase font-bold tracking-wider text-neutral-400 flex items-center gap-1.5">
              <Map className="h-3.5 w-3.5" /> Active Trips
            </CardDescription>
            <CardTitle className="text-2xl font-bold">{trips.length}</CardTitle>
          </CardHeader>
        </Card>

        <Card className="border border-neutral-200 dark:border-neutral-800">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase font-bold tracking-wider text-neutral-400 flex items-center gap-1.5">
              <Wallet className="h-3.5 w-3.5" /> Aggregate Budgets
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-neutral-800 dark:text-neutral-200">
              {formatCurrency(totalBudget)}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="border border-neutral-200 dark:border-neutral-800">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase font-bold tracking-wider text-neutral-400 flex items-center gap-1.5">
              <Wallet className="h-3.5 w-3.5" /> Total Funds Logged
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-[hsl(var(--accent))]">
              {formatCurrency(totalSpent)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-neutral-200 dark:border-neutral-800 gap-4">
        <button
          onClick={() => setActiveTab("users")}
          className={`pb-3 text-sm font-semibold relative cursor-pointer ${
            activeTab === "users"
              ? "text-neutral-900 dark:text-neutral-100 border-b-2 border-neutral-900 dark:border-neutral-50"
              : "text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
          }`}
        >
          Users & Profiles
        </button>
        <button
          onClick={() => setActiveTab("trips")}
          className={`pb-3 text-sm font-semibold relative cursor-pointer ${
            activeTab === "trips"
              ? "text-neutral-900 dark:text-neutral-100 border-b-2 border-neutral-900 dark:border-neutral-50"
              : "text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
          }`}
        >
          Global Trip Roster
        </button>
        <button
          onClick={() => setActiveTab("expenses")}
          className={`pb-3 text-sm font-semibold relative cursor-pointer ${
            activeTab === "expenses"
              ? "text-neutral-900 dark:text-neutral-100 border-b-2 border-neutral-900 dark:border-neutral-50"
              : "text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
          }`}
        >
          Global Expenses
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === "users" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-200">
          {/* Create User Form */}
          <div className="lg:col-span-1">
            <Card className="border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-sm">
              <form onSubmit={handleCreateUser}>
                <CardHeader>
                  <CardTitle className="text-base font-semibold">Register User</CardTitle>
                  <CardDescription>Directly provision a new travel planner profile.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {userErrorMsg && (
                    <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/40 text-red-600 dark:text-red-400 rounded-lg text-xs">
                      {userErrorMsg}
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label htmlFor="newFullName">Full Name</Label>
                    <Input
                      id="newFullName"
                      placeholder="e.g. John Doe"
                      value={newFullName}
                      onChange={(e) => setNewFullName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="newUsername">Username</Label>
                    <Input
                      id="newUsername"
                      placeholder="e.g. johndoe (only lowercase)"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="newEmail">Email address</Label>
                    <Input
                      id="newEmail"
                      type="email"
                      placeholder="e.g. john@example.com"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                    />
                  </div>

                  <div className="flex items-center space-x-2 pt-2">
                    <Checkbox
                      id="newIsAdmin"
                      checked={newIsAdmin}
                      onCheckedChange={(checked) => setNewIsAdmin(!!checked)}
                    />
                    <label
                      htmlFor="newIsAdmin"
                      className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 cursor-pointer select-none"
                    >
                      Administrator Access
                    </label>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button type="submit" disabled={isSubmittingUser} className="w-full cursor-pointer text-xs">
                    {isSubmittingUser ? (
                      <>
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        Provisioning...
                      </>
                    ) : (
                      <>
                        <Plus className="mr-1.5 h-3.5 w-3.5" />
                        Add User
                      </>
                    )}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </div>

          {/* Users List */}
          <div className="lg:col-span-2">
            <Card className="border border-neutral-200 dark:border-neutral-800 shadow-sm rounded-xl">
              <CardHeader>
                <CardTitle className="text-base font-semibold">User Directory</CardTitle>
                <CardDescription>Roster of all registered trip organizers.</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingUsers ? (
                  <div className="py-10 text-center flex justify-center items-center">
                    <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
                  </div>
                ) : (
                  <>
                    {/* Desktop table view */}
                    <table className="hidden sm:table w-full text-sm text-left">
                      <thead>
                        <tr className="border-b border-neutral-200 dark:border-neutral-800 text-neutral-400 text-xs uppercase font-bold">
                          <th className="pb-3 pt-1 pl-2">Name</th>
                          <th className="pb-3 pt-1">Username</th>
                          <th className="pb-3 pt-1">Email</th>
                          <th className="pb-3 pt-1">Privileges</th>
                          <th className="pb-3 pt-1 pr-2 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                        {users.map((u) => (
                          <tr key={u.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/10 group">
                            <td className="py-3 pl-2 font-medium text-neutral-800 dark:text-neutral-200">
                              {u.full_name}
                            </td>
                            <td className="py-3 text-neutral-600 dark:text-neutral-400">@{u.username}</td>
                            <td className="py-3 text-neutral-500 dark:text-neutral-400">{u.email || "N/A"}</td>
                            <td className="py-3">
                              {u.is_admin ? (
                                <span className="text-[10px] bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400 border border-red-200 dark:border-red-900/50 px-2 py-0.5 rounded-full font-bold">
                                  Admin
                                </span>
                              ) : (
                                <span className="text-[10px] bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-800 px-2 py-0.5 rounded-full font-medium">
                                  Planner
                                </span>
                              )}
                            </td>
                            <td className="py-3 pr-2 text-right">
                              {u.username !== "souvik" && (
                                <button
                                  onClick={() => handleDeleteUser(u.id, u.username || "")}
                                  className="p-1.5 text-neutral-400 hover:text-red-500 dark:hover:text-red-400 rounded transition-apple cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100"
                                  title="Delete User"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Mobile list view */}
                    <div className="block sm:hidden space-y-3.5">
                      {users.length === 0 ? (
                        <p className="text-xs text-neutral-400 text-center py-4">No users found.</p>
                      ) : (
                        users.map((u) => (
                          <div
                            key={u.id}
                            className="p-3.5 rounded-xl border border-neutral-150 dark:border-neutral-850 hover:bg-neutral-50/50 dark:hover:bg-neutral-900/10 transition-apple space-y-2 relative"
                          >
                            <div className="flex justify-between items-start gap-2">
                              <div>
                                <p className="font-semibold text-neutral-800 dark:text-neutral-200 text-sm">{u.full_name}</p>
                                <p className="text-xs text-neutral-400">@{u.username}</p>
                              </div>
                              {u.username !== "souvik" && (
                                <button
                                  onClick={() => handleDeleteUser(u.id, u.username || "")}
                                  className="p-1 text-neutral-400 hover:text-red-500 rounded cursor-pointer"
                                  title="Delete User"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                            <div className="flex items-center justify-between text-xs pt-1 border-t border-neutral-100 dark:border-neutral-800/40">
                              <span className="text-neutral-450 dark:text-neutral-400 truncate max-w-[150px]">{u.email || "No Email"}</span>
                              {u.is_admin ? (
                                <span className="text-[9px] bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400 border border-red-200 px-2 py-0.5 rounded font-bold">Admin</span>
                              ) : (
                                <span className="text-[9px] bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400 border border-neutral-200 px-2 py-0.5 rounded font-medium">Planner</span>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {activeTab === "trips" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-200">
          {/* Create & Assign Trip Form */}
          <div className="lg:col-span-1">
            <Card className="border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-sm">
              <form onSubmit={handleCreateTrip}>
                <CardHeader>
                  <CardTitle className="text-base font-semibold">Create & Assign Trip</CardTitle>
                  <CardDescription>Configure a destination and budget for a user.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {tripErrorMsg && (
                    <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/40 text-red-600 dark:text-red-400 rounded-lg text-xs">
                      {tripErrorMsg}
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label htmlFor="tripUser">Assign to User</Label>
                    <Select
                      id="tripUser"
                      value={newTripUserId}
                      onChange={(e) => setNewTripUserId(e.target.value)}
                      required
                    >
                      <option value="">Select a user...</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.full_name} (@{u.username})
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="tripName">Trip / Destination Name</Label>
                    <Input
                      id="tripName"
                      placeholder="e.g. Hawaii Summer 2026"
                      value={newTripName}
                      onChange={(e) => setNewTripName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="tripBudget">Total Budget (₹)</Label>
                    <Input
                      id="tripBudget"
                      type="number"
                      step="0.01"
                      placeholder="e.g. 30000"
                      value={newTripBudget}
                      onChange={(e) => setNewTripBudget(e.target.value)}
                      required
                    />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button type="submit" disabled={isSubmittingTrip} className="w-full cursor-pointer text-xs">
                    {isSubmittingTrip ? (
                      <>
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Plus className="mr-1.5 h-3.5 w-3.5" />
                        Create & Assign
                      </>
                    )}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </div>

          {/* Global Trips List */}
          <div className="lg:col-span-2">
            <Card className="border border-neutral-200 dark:border-neutral-800 shadow-sm rounded-xl">
              <CardHeader>
                <CardTitle className="text-base font-semibold">Global Trips List</CardTitle>
                <CardDescription>Review all destinations, budgets, and planners.</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingTrips ? (
                  <div className="py-10 text-center flex justify-center items-center">
                    <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
                  </div>
                ) : trips.length === 0 ? (
                  <div className="py-10 text-center text-xs text-neutral-400">
                    No trips have been planned yet.
                  </div>
                ) : (
                  <>
                    {/* Desktop table view */}
                    <div className="overflow-x-auto hidden sm:block">
                      <table className="w-full min-w-[500px] text-sm text-left">
                        <thead>
                          <tr className="border-b border-neutral-200 dark:border-neutral-800 text-neutral-400 text-xs uppercase font-bold">
                            <th className="pb-3 pt-1 pl-2">Destination / Trip</th>
                            <th className="pb-3 pt-1">Trip Planner</th>
                            <th className="pb-3 pt-1">Budget</th>
                            <th className="pb-3 pt-1">Created Date</th>
                            <th className="pb-3 pt-1 pr-2 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                          {trips.map((t) => (
                            <tr key={t.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/10 group">
                              <td className="py-3 pl-2 font-medium text-neutral-800 dark:text-neutral-200">
                                {t.name}
                              </td>
                              <td className="py-3 text-neutral-600 dark:text-neutral-400">
                                {t.profiles ? `${t.profiles.full_name} (@${t.profiles.username})` : "Unknown Owner"}
                              </td>
                              <td className="py-3 font-semibold text-neutral-800 dark:text-neutral-200">
                                {formatCurrency(t.total_budget)}
                              </td>
                              <td className="py-3 text-neutral-500 dark:text-neutral-400">
                                {new Date(t.created_at).toLocaleDateString()}
                              </td>
                              <td className="py-3 pr-2 text-right">
                                <button
                                  onClick={() => handleDeleteTrip(t.id, t.name)}
                                  className="p-1.5 text-neutral-400 hover:text-red-500 dark:hover:text-red-400 rounded transition-apple cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100"
                                  title="Delete Trip"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile list view */}
                    <div className="block sm:hidden space-y-3.5">
                      {trips.map((t) => (
                        <div
                          key={t.id}
                          className="p-3.5 rounded-xl border border-neutral-150 dark:border-neutral-850 hover:bg-neutral-50/50 dark:hover:bg-neutral-900/10 transition-apple space-y-2 relative"
                        >
                          <div className="flex justify-between items-start gap-2">
                            <div>
                              <p className="font-semibold text-neutral-800 dark:text-neutral-200 text-sm">{t.name}</p>
                              <p className="text-xs text-neutral-400">
                                By {t.profiles ? `${t.profiles.full_name} (@${t.profiles.username})` : "Unknown Owner"}
                              </p>
                            </div>
                            <button
                              onClick={() => handleDeleteTrip(t.id, t.name)}
                              className="p-1 text-neutral-400 hover:text-red-500 rounded cursor-pointer"
                              title="Delete Trip"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                          <div className="flex items-center justify-between text-xs pt-1 border-t border-neutral-100 dark:border-neutral-800/40">
                            <span className="font-bold text-neutral-850 dark:text-neutral-200">{formatCurrency(t.total_budget)}</span>
                            <span className="text-[10px] text-neutral-400">{new Date(t.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {activeTab === "expenses" && (
        <Card className="border border-neutral-200 dark:border-neutral-800 shadow-sm rounded-xl animate-in fade-in duration-200">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Global Expense Audit Trail</CardTitle>
            <CardDescription>Log of all expenditures incurred across the platform.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingGlobalExpenses ? (
              <div className="py-10 text-center flex justify-center items-center">
                <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
              </div>
            ) : globalExpenses.length === 0 ? (
              <div className="py-10 text-center text-xs text-neutral-400">
                No expenses have been logged yet.
              </div>
            ) : (
              <>
                {/* Desktop table view */}
                <div className="overflow-x-auto hidden sm:block">
                  <table className="w-full min-w-[650px] text-sm text-left">
                    <thead>
                      <tr className="border-b border-neutral-200 dark:border-neutral-800 text-neutral-400 text-xs uppercase font-bold">
                        <th className="pb-3 pt-1 pl-2">User (Planner)</th>
                        <th className="pb-3 pt-1">Trip Workspace</th>
                        <th className="pb-3 pt-1">Description</th>
                        <th className="pb-3 pt-1">Category</th>
                        <th className="pb-3 pt-1">Date</th>
                        <th className="pb-3 pt-1">Amount</th>
                        <th className="pb-3 pt-1 pr-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                      {globalExpenses.map((exp) => {
                        const plannerName = exp.trips?.profiles?.full_name || "Unknown";
                        const plannerUsername = exp.trips?.profiles?.username || "unknown";
                        const tripName = exp.trips?.name || "Deleted Trip";
                        return (
                          <tr key={exp.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/10 group">
                            <td className="py-3 pl-2 font-medium text-neutral-800 dark:text-neutral-200">
                              <div>
                                {plannerName} <span className="text-xs font-normal text-neutral-400">(@{plannerUsername})</span>
                              </div>
                              {exp.created_by && (
                                <div className="text-[10px] text-neutral-450 dark:text-neutral-400 font-medium mt-0.5">
                                  Logged by: <span className="font-semibold text-neutral-600 dark:text-neutral-300">@{exp.created_by}</span>
                                </div>
                              )}
                            </td>
                            <td className="py-3 text-neutral-600 dark:text-neutral-400">{tripName}</td>
                            <td className="py-3 text-neutral-800 dark:text-neutral-200 font-medium">{exp.description}</td>
                            <td className="py-3 text-neutral-500 dark:text-neutral-400">{exp.category}</td>
                            <td className="py-3 text-neutral-500 dark:text-neutral-400">{exp.date}</td>
                            <td className="py-3 font-bold text-red-500">{formatCurrency(Number(exp.amount))}</td>
                            <td className="py-3 pr-2 text-right">
                              <button
                                onClick={() => handleDeleteExpense(exp.id, exp.description)}
                                className="p-1.5 text-neutral-400 hover:text-red-500 dark:hover:text-red-400 rounded cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100"
                                title="Delete Expense"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile list view */}
                <div className="block sm:hidden space-y-3.5">
                  {globalExpenses.map((exp) => {
                    const plannerName = exp.trips?.profiles?.full_name || "Unknown";
                    const plannerUsername = exp.trips?.profiles?.username || "unknown";
                    const tripName = exp.trips?.name || "Deleted Trip";
                    return (
                      <div
                        key={exp.id}
                        className="p-3.5 rounded-xl border border-neutral-150 dark:border-neutral-850 hover:bg-neutral-50/50 dark:hover:bg-neutral-900/10 transition-apple space-y-2 relative"
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <p className="font-semibold text-neutral-800 dark:text-neutral-200 text-sm">{exp.description}</p>
                            <p className="text-xs text-neutral-450 dark:text-neutral-400">
                              {plannerName} (@{plannerUsername}) • <span className="font-medium">{tripName}</span>
                            </p>
                            {exp.created_by && (
                              <p className="text-[10px] text-neutral-400 mt-0.5">
                                Logged by: <span className="font-semibold">@{exp.created_by}</span>
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => handleDeleteExpense(exp.id, exp.description)}
                            className="p-1 text-neutral-400 hover:text-red-500 rounded cursor-pointer"
                            title="Delete Expense"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="flex items-center justify-between text-xs pt-1 border-t border-neutral-100 dark:border-neutral-800/40">
                          <span className="text-[10px] text-neutral-400">{exp.category} • {exp.date}</span>
                          <span className="font-bold text-red-500">{formatCurrency(Number(exp.amount))}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
