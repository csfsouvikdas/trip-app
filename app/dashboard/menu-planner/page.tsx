"use client";

import * as React from "react";
import { useDashboard } from "@/components/providers";
import { createClient } from "@/lib/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Utensils, Plus, Trash2, Calendar, Clock, ArrowRight, Loader2, Salad, Pencil } from "lucide-react";
import Link from "next/link";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

interface MenuItem {
  id: string;
  trip_id: string;
  meal_name: string;
  day: string; // date string
  time: string; // Breakfast, Lunch, Dinner, Snack
  youtube_url?: string | null;
  created_at: string;
}

const mealTimes = ["Breakfast", "Lunch", "Dinner", "Snack"];

const getYoutubeEmbedUrl = (url: string | null | undefined) => {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  if (match && match[2].length === 11) {
    return `https://www.youtube.com/embed/${match[2]}`;
  }
  return null;
};

export default function MenuPlannerPage() {
  const { activeTrip, profile } = useDashboard();
  const supabase = createClient();
  const queryClient = useQueryClient();

  const [mealName, setMealName] = React.useState("");
  const [mealTime, setMealTime] = React.useState(mealTimes[0]);
  const [mealDate, setMealDate] = React.useState(new Date().toISOString().split("T")[0]);
  const [youtubeUrl, setYoutubeUrl] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // Edit Meal states
  const [editingMeal, setEditingMeal] = React.useState<MenuItem | null>(null);
  const [editMealName, setEditMealName] = React.useState("");
  const [editMealTime, setEditMealTime] = React.useState("");
  const [editMealDate, setEditMealDate] = React.useState("");
  const [editYoutubeUrl, setEditYoutubeUrl] = React.useState("");
  const [isSavingMeal, setIsSavingMeal] = React.useState(false);
  const [editErrorMsg, setEditErrorMsg] = React.useState<string | null>(null);

  // Fetch menu items
  const { data: items = [], isLoading } = useQuery<MenuItem[]>({
    queryKey: ["menu_plan", activeTrip?.id],
    queryFn: async () => {
      if (!activeTrip?.id) return [];
      const { data, error } = await supabase
        .from("menu_plan")
        .select("*")
        .eq("trip_id", activeTrip.id)
        .order("day", { ascending: true })
        .order("time", { ascending: true })
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!activeTrip?.id,
  });

  // Group items by day
  const groupedItems = React.useMemo(() => {
    const groups: Record<string, MenuItem[]> = {};
    items.forEach((item) => {
      if (!groups[item.day]) {
        groups[item.day] = [];
      }
      groups[item.day].push(item);
    });
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, [items]);

  const handleAddMeal = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!activeTrip || !mealName.trim()) return;
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const { error } = await supabase.from("menu_plan").insert({
        trip_id: activeTrip.id,
        meal_name: mealName.trim(),
        day: mealDate,
        time: mealTime,
        youtube_url: youtubeUrl.trim() || null,
      });

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["menu_plan", activeTrip.id] });
      setMealName("");
      setMealTime(mealTimes[0]);
      setYoutubeUrl("");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to add meal");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteMeal = async (id: string) => {
    if (!activeTrip) return;
    try {
      const { error } = await supabase.from("menu_plan").delete().eq("id", id);
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["menu_plan", activeTrip.id] });
    } catch (err: any) {
      alert(err.message || "Failed to delete meal");
    }
  };

  const handleEditMealSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!activeTrip || !editingMeal || !editMealName.trim()) return;
    setIsSavingMeal(true);
    setEditErrorMsg(null);

    try {
      const { error } = await supabase
        .from("menu_plan")
        .update({
          meal_name: editMealName.trim(),
          day: editMealDate,
          time: editMealTime,
          youtube_url: editYoutubeUrl.trim() || null,
        })
        .eq("id", editingMeal.id);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["menu_plan", activeTrip.id] });
      setEditingMeal(null);
    } catch (err: any) {
      setEditErrorMsg(err.message || "Failed to update meal");
    } finally {
      setIsSavingMeal(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const options: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric", year: "numeric" };
    return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", options);
  };

  const getTimeBadgeStyle = (time: string) => {
    switch (time) {
      case "Breakfast":
        return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/50";
      case "Lunch":
        return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/50";
      case "Dinner":
        return "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/20 dark:text-purple-400 dark:border-purple-900/50";
      default:
        return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50";
    }
  };

  if (!activeTrip) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center max-w-md mx-auto">
        <div className="h-12 w-12 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-400 flex items-center justify-center mb-4">
          <Utensils className="h-6 w-6" />
        </div>
        <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-50">No Active Trip Workspace</h3>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-2">
          You must activate a trip workspace before managing menu plans.
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
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50 flex items-center gap-2">
            <Salad className="h-6 w-6 text-neutral-800 dark:text-neutral-200" />
            Menu Planner
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            Plan your daily breakfast, lunch, dinner, and snacks for a well-fed trip.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Add Meal Form */}
        {profile?.is_admin && (
          <div className="lg:col-span-1">
            <Card className="border border-neutral-200 dark:border-neutral-800 shadow-sm rounded-xl">
              <form onSubmit={handleAddMeal}>
                <CardHeader>
                  <CardTitle className="text-base font-semibold">Add Meal Plan</CardTitle>
                  <CardDescription>Schedule a culinary event for your trip itinerary.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {errorMsg && (
                    <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/40 text-red-600 dark:text-red-400 rounded-lg text-xs">
                      {errorMsg}
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label htmlFor="mealName" className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">
                      Meal Name / Dish / Restaurant
                    </label>
                    <Input
                      id="mealName"
                      placeholder="e.g. Sushi at Tsukiji, Hotel Breakfast"
                      value={mealName}
                      onChange={(e) => setMealName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="mealTime" className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">
                      Meal Time
                    </label>
                    <Select
                      id="mealTime"
                      value={mealTime}
                      onChange={(e) => setMealTime(e.target.value)}
                    >
                      {mealTimes.map((time) => (
                        <option key={time} value={time}>
                          {time}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="mealDate" className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">
                      Date
                    </label>
                    <Input
                      id="mealDate"
                      type="date"
                      value={mealDate}
                      onChange={(e) => setMealDate(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="youtubeUrl" className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">
                      YouTube Video Link (Recipe / Vlog / Preview)
                    </label>
                    <Input
                      id="youtubeUrl"
                      type="url"
                      placeholder="e.g. https://www.youtube.com/watch?v=..."
                      value={youtubeUrl}
                      onChange={(e) => setYoutubeUrl(e.target.value)}
                    />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button type="submit" disabled={isSubmitting || !mealName.trim()} className="w-full cursor-pointer text-xs">
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      <>
                        <Plus className="mr-1.5 h-3.5 w-3.5" />
                        Add to Plan
                      </>
                    )}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </div>
        )}

        {/* Meal Schedule List */}
        <div className={`${profile?.is_admin ? "lg:col-span-2" : "lg:col-span-3"} space-y-4`}>
          <Card className="border border-neutral-200 dark:border-neutral-800 shadow-sm rounded-xl h-full flex flex-col">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Your Menu Timeline</CardTitle>
              <CardDescription>Chronological overview of scheduled meals.</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto max-h-[600px] space-y-6">
              {isLoading ? (
                <div className="py-20 text-center flex flex-col justify-center items-center">
                  <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
                  <span className="text-xs text-neutral-400 mt-2">Loading menu plan...</span>
                </div>
              ) : items.length === 0 ? (
                <div className="py-20 text-center text-neutral-400 text-xs border border-dashed border-neutral-200 dark:border-neutral-800 rounded-xl">
                  Timeline is empty. Start planning meals by logging dishes on the left!
                </div>
              ) : (
                <div className="space-y-6">
                  {groupedItems.map(([dateString, dayMeals]) => (
                    <div key={dateString} className="space-y-3">
                      <h4 className="text-xs font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5 sticky top-0 bg-white dark:bg-neutral-900 py-1.5 z-10 border-b border-neutral-100 dark:border-neutral-800">
                        <Calendar className="h-3.5 w-3.5 text-neutral-400" />
                        {formatDate(dateString)}
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {dayMeals.map((meal) => (
                          <div
                            key={meal.id}
                            className="flex flex-col justify-between gap-3 p-3.5 bg-neutral-50/50 dark:bg-neutral-900/10 border border-neutral-100 dark:border-neutral-800/50 rounded-lg group transition-colors relative"
                          >
                            <div className="flex justify-between items-start w-full gap-3">
                              <div className="space-y-1 overflow-hidden flex-1">
                                <div className="flex items-center gap-2">
                                  <span className={`text-[9px] px-2 py-0.5 border rounded-full font-bold uppercase tracking-wider ${getTimeBadgeStyle(meal.time)}`}>
                                    {meal.time}
                                  </span>
                                </div>
                                <p className="text-sm font-bold text-neutral-800 dark:text-neutral-200 truncate">
                                  {meal.meal_name}
                                </p>
                              </div>
                              {profile?.is_admin && (
                                <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-apple shrink-0">
                                  <button
                                    onClick={() => {
                                      setEditingMeal(meal);
                                      setEditMealName(meal.meal_name);
                                      setEditMealTime(meal.time);
                                      setEditMealDate(meal.day);
                                      setEditYoutubeUrl(meal.youtube_url || "");
                                      setEditErrorMsg(null);
                                    }}
                                    type="button"
                                    className="p-1.5 text-neutral-400 hover:text-[hsl(var(--accent))] hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-md cursor-pointer transition-apple"
                                    title="Edit meal"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteMeal(meal.id)}
                                    type="button"
                                    className="p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-md cursor-pointer transition-apple"
                                    title="Delete meal"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* YouTube Preview Player */}
                            {meal.youtube_url && (
                              <div className="w-full mt-1">
                                {getYoutubeEmbedUrl(meal.youtube_url) ? (
                                  <div className="rounded-lg overflow-hidden border border-neutral-150 dark:border-neutral-800 aspect-video w-full bg-black shadow-sm">
                                    <iframe
                                      src={getYoutubeEmbedUrl(meal.youtube_url)!}
                                      title={meal.meal_name}
                                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                      allowFullScreen
                                      className="w-full h-full border-0"
                                    />
                                  </div>
                                ) : (
                                  <Link
                                    href={meal.youtube_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 text-xs text-[hsl(var(--accent))] hover:underline font-semibold"
                                  >
                                    <span className="shrink-0">🔗</span>
                                    <span className="truncate max-w-[220px]">{meal.youtube_url}</span>
                                  </Link>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit Meal Modal */}
      <Dialog open={editingMeal !== null} onOpenChange={(open) => { if (!open) setEditingMeal(null); }}>
        <DialogContent className="sm:max-w-[425px] border border-neutral-200 dark:border-neutral-800 shadow-sm rounded-xl">
          <form onSubmit={handleEditMealSubmit}>
            <DialogHeader>
              <DialogTitle>Edit Meal Plan</DialogTitle>
              <DialogDescription>
                Modify details for this scheduled meal.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {editErrorMsg && (
                <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/40 text-red-600 dark:text-red-400 rounded-lg text-xs">
                  {editErrorMsg}
                </div>
              )}

              <div className="space-y-1.5">
                <label htmlFor="editMealName" className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">
                  Meal Name / Dish / Restaurant
                </label>
                <Input
                  id="editMealName"
                  placeholder="e.g. Sushi at Tsukiji, Hotel Breakfast"
                  value={editMealName}
                  onChange={(e) => setEditMealName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="editMealTime" className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">
                  Meal Time
                </label>
                <Select
                  id="editMealTime"
                  value={editMealTime}
                  onChange={(e) => setEditMealTime(e.target.value)}
                >
                  {mealTimes.map((time) => (
                    <option key={time} value={time}>
                      {time}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="editMealDate" className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">
                  Date
                </label>
                <Input
                  id="editMealDate"
                  type="date"
                  value={editMealDate}
                  onChange={(e) => setEditMealDate(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="editYoutubeUrl" className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">
                  YouTube Video Link (Recipe / Vlog / Preview)
                </label>
                <Input
                  id="editYoutubeUrl"
                  type="url"
                  placeholder="e.g. https://www.youtube.com/watch?v=..."
                  value={editYoutubeUrl}
                  onChange={(e) => setEditYoutubeUrl(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingMeal(null)} className="cursor-pointer text-xs">
                Cancel
              </Button>
              <Button type="submit" disabled={isSavingMeal || !editMealName.trim()} className="cursor-pointer text-xs">
                {isSavingMeal ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
