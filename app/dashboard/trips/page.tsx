"use client";

import * as React from "react";
import { useDashboard, type Trip } from "@/components/providers";
import { createClient } from "@/lib/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Check, MapPin, Wallet, Calendar, Trash2, Loader2, Compass, Pencil, X } from "lucide-react";
import { WeatherWidget } from "@/components/weather-widget";

export default function TripsPage() {
  const { trips, activeTrip, setActiveTrip, user, isLoadingTrips, profile } = useDashboard();
  const supabase = createClient();
  const queryClient = useQueryClient();

  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [tripName, setTripName] = React.useState("");
  const [tripLocation, setTripLocation] = React.useState("");
  const [totalBudget, setTotalBudget] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // Budget Editing States
  const [isEditingBudget, setIsEditingBudget] = React.useState(false);
  const [editBudgetValue, setEditBudgetValue] = React.useState("");
  const [isUpdatingBudget, setIsUpdatingBudget] = React.useState(false);

  const handleUpdateBudget = async () => {
    if (!activeTrip) return;
    const budgetNum = Number(editBudgetValue);
    if (isNaN(budgetNum) || budgetNum < 0) {
      alert("Please enter a valid positive budget number");
      return;
    }

    setIsUpdatingBudget(true);
    try {
      const { error } = await supabase
        .from("trips")
        .update({ total_budget: budgetNum })
        .eq("id", activeTrip.id);

      if (error) throw error;

      // Invalidate React Query cache to trigger refetch
      queryClient.invalidateQueries({ queryKey: ["trips", user?.id] });
      setIsEditingBudget(false);
    } catch (err: any) {
      alert(err.message || "Failed to update budget");
    } finally {
      setIsUpdatingBudget(false);
    }
  };

  // Formatting helper
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(val);
  };

  const handleCreateTrip = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const budgetNum = Number(totalBudget);
      if (isNaN(budgetNum) || budgetNum < 0) {
        throw new Error("Please enter a valid positive budget number");
      }

      const { data, error } = await supabase
        .from("trips")
        .insert({
          name: tripName,
          location: tripLocation.trim() || "Delhi",
          total_budget: budgetNum,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Invalidate queries to reload trips
      queryClient.invalidateQueries({ queryKey: ["trips", user.id] });

      // Automatically set the newly created trip as active
      if (data) {
        setActiveTrip(data as Trip);
      }

      // Reset state and close modal
      setTripName("");
      setTripLocation("");
      setTotalBudget("");
      setIsCreateOpen(false);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to create trip");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTrip = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // Avoid triggering trip select
    if (!confirm("Are you sure you want to delete this trip and all its associated data?")) return;

    try {
      const { error } = await supabase.from("trips").delete().eq("id", id);
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["trips", user?.id] });
      
      if (activeTrip?.id === id) {
        setActiveTrip(null);
      }
    } catch (err: any) {
      alert(err.message || "Failed to delete trip");
    }
  };

  if (isLoadingTrips) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
        <p className="text-xs text-neutral-400 mt-2">Loading trips...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Active Trip Info & Weather Header */}
      {activeTrip && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="md:col-span-2 p-6 bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 rounded-2xl flex flex-col justify-between space-y-4 shadow-sm">
            <div className="space-y-2">
              <span className="text-[10px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 px-2 py-0.5 rounded-full font-bold">
                Active Workspace
              </span>
              <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-50 tracking-tight mt-2 flex items-center gap-1.5">
                <MapPin className="h-5 w-5 text-neutral-400" />
                {activeTrip.name}
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Destination: <span className="font-semibold text-neutral-700 dark:text-neutral-300">{activeTrip.location || "Delhi"}</span>
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm border-t border-neutral-100 dark:border-neutral-800/60 pt-3">
              <Wallet className="h-4.5 w-4.5 text-neutral-400" />
              <span className="font-semibold text-neutral-500 dark:text-neutral-400">Trip Budget:</span>
              {isEditingBudget ? (
                <div className="flex items-center gap-1.5">
                  <Input
                    type="number"
                    value={editBudgetValue}
                    onChange={(e) => setEditBudgetValue(e.target.value)}
                    className="w-28 h-7 text-xs px-2"
                    placeholder="Enter budget"
                    disabled={isUpdatingBudget}
                    autoFocus
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-emerald-600 hover:text-emerald-700 cursor-pointer shrink-0"
                    onClick={handleUpdateBudget}
                    disabled={isUpdatingBudget}
                  >
                    {isUpdatingBudget ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-red-500 hover:text-red-700 cursor-pointer shrink-0"
                    onClick={() => setIsEditingBudget(false)}
                    disabled={isUpdatingBudget}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="font-bold text-neutral-800 dark:text-neutral-200">
                    {formatCurrency(activeTrip.total_budget)}
                  </span>
                  {(profile?.is_admin || user?.id === activeTrip.user_id) && (
                    <button
                      onClick={() => {
                        setEditBudgetValue(activeTrip.total_budget.toString());
                        setIsEditingBudget(true);
                      }}
                      className="p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-apple cursor-pointer"
                      title="Edit trip budget"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="md:col-span-1">
            <WeatherWidget location={activeTrip.location || "Delhi"} />
          </div>
        </div>
      )}

      {/* Header Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50 flex items-center gap-2">
            <Compass className="h-6 w-6 text-neutral-800 dark:text-neutral-200" />
            Your Trips
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            Manage your itineraries, budgets, and track expenses.
          </p>
        </div>

        {/* Create Trip Trigger Modal */}
        {profile?.is_admin && (
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="h-10 cursor-pointer text-xs" variant="accent">
                <Plus className="h-4 w-4 mr-1.5" />
                New Trip
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[420px]">
              <form onSubmit={handleCreateTrip}>
                <DialogHeader>
                  <DialogTitle>Create New Trip</DialogTitle>
                  <DialogDescription>
                    Enter the details of your upcoming adventure.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  {errorMsg && (
                    <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/40 text-red-600 dark:text-red-400 rounded-lg text-xs">
                      {errorMsg}
                    </div>
                  )}
                  
                  <div className="space-y-1.5">
                    <Label htmlFor="tripName">Trip Name / Destination</Label>
                    <Input
                      id="tripName"
                      placeholder="e.g. Kyoto Summer 2026, Paris Weekend"
                      value={tripName}
                      onChange={(e) => setTripName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="tripLocation">Destination City / Location</Label>
                    <Input
                      id="tripLocation"
                      placeholder="e.g. Goa, Manali, Paris"
                      value={tripLocation}
                      onChange={(e) => setTripLocation(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="totalBudget">Total Budget (₹)</Label>
                    <Input
                      id="totalBudget"
                      type="number"
                      step="0.01"
                      placeholder="e.g. 25000"
                      value={totalBudget}
                      onChange={(e) => setTotalBudget(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateOpen(false)}
                    disabled={isSubmitting}
                    className="cursor-pointer"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting} className="cursor-pointer" variant="default">
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      "Create Trip"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Trips list grid */}
      {trips.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-2xl bg-white dark:bg-neutral-900/30 text-center">
          <div className="h-10 w-10 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-400 flex items-center justify-center mb-3">
            <MapPin className="h-5 w-5" />
          </div>
          <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-50">No Trips Created Yet</h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 max-w-[280px]">
            {profile?.is_admin
              ? 'Scaffold your first travel itinerary by tapping the "New Trip" button above.'
              : 'You do not have any trips assigned to your profile yet. Please contact the administrator to create and configure a trip workspace for you.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {trips.map((trip) => {
            const isActive = activeTrip?.id === trip.id;
            return (
              <Card
                key={trip.id}
                onClick={() => setActiveTrip(trip)}
                className={`transition-apple cursor-pointer hover:shadow-md select-none group border-theme relative flex flex-col justify-between ${
                  isActive
                    ? "border-[hsl(var(--accent))] dark:border-[hsl(var(--accent))] ring-1 ring-[hsl(var(--accent))]"
                    : "hover:border-neutral-300 dark:hover:border-neutral-700"
                }`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 overflow-hidden">
                      <CardTitle className="text-base font-semibold tracking-tight truncate group-hover:text-[hsl(var(--accent))] transition-colors">
                        {trip.name}
                      </CardTitle>
                      <CardDescription className="text-xs flex items-center gap-1">
                        <Calendar className="h-3 w-3 shrink-0" />
                        Created {new Date(trip.created_at).toLocaleDateString()}
                      </CardDescription>
                    </div>
                    {isActive ? (
                      <span className="h-6 w-6 rounded-full bg-[hsl(var(--accent))] text-white flex items-center justify-center shrink-0">
                        <Check className="h-3.5 w-3.5 stroke-[3]" />
                      </span>
                    ) : (
                      <span className="text-[10px] bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400 px-2 py-0.5 rounded font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                        Activate
                      </span>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="pb-3 flex-1 flex flex-col justify-end">
                  <div className="flex items-center gap-2 text-sm">
                    <Wallet className="h-4 w-4 text-neutral-400" />
                    <span className="font-medium text-neutral-500 dark:text-neutral-400">Budget:</span>
                    <span className="font-bold text-neutral-800 dark:text-neutral-200">
                      {formatCurrency(trip.total_budget)}
                    </span>
                  </div>
                </CardContent>

                <CardFooter className="pt-2 border-t border-neutral-100 dark:border-neutral-800/50 flex justify-between items-center text-xs">
                  <span className="text-neutral-400">
                    {isActive ? "Active Workspace" : "Click to select"}
                  </span>
                  {profile?.is_admin && (
                    <button
                      onClick={(e) => handleDeleteTrip(e, trip.id)}
                      className="p-1.5 text-neutral-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-apple cursor-pointer opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100"
                      title="Delete Trip"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
