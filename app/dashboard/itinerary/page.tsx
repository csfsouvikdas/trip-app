"use client";

import * as React from "react";
import { useDashboard } from "@/components/providers";
import { createClient } from "@/lib/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, MapPin, Plus, Trash2, ArrowRight, Image as ImageIcon, Sparkles, Loader2, Compass, Pencil } from "lucide-react";
import Link from "next/link";
import { WeatherWidget } from "@/components/weather-widget";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

interface ItineraryItem {
  id: string;
  trip_id: string;
  date: string;
  location: string;
  description: string;
  image_url: string;
  created_at: string;
}

const PRESET_IMAGES = [
  { label: "🏖️ Beach & Resort", url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80" },
  { label: "⛰️ Mountains & Nature", url: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=600&q=80" },
  { label: "🌆 City Nightlife", url: "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=600&q=80" },
  { label: "🏨 Luxury Hotel", url: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=600&q=80" },
  { label: "🍜 Local Dining", url: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=600&q=80" },
  { label: "🏛️ Sightseeing", url: "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=600&q=80" },
];

export default function ItineraryPage() {
  const { activeTrip, profile } = useDashboard();
  const supabase = createClient();
  const queryClient = useQueryClient();

  const [date, setDate] = React.useState(new Date().toISOString().split("T")[0]);
  const [location, setLocation] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [imageUrl, setImageUrl] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // Edit Itinerary states
  const [editingStop, setEditingStop] = React.useState<ItineraryItem | null>(null);
  const [editStopDate, setEditStopDate] = React.useState("");
  const [editLocation, setEditLocation] = React.useState("");
  const [editDescription, setEditDescription] = React.useState("");
  const [editImageUrl, setEditImageUrl] = React.useState("");
  const [isSavingStop, setIsSavingStop] = React.useState(false);
  const [editErrorMsg, setEditErrorMsg] = React.useState<string | null>(null);

  // Fetch itinerary items
  const { data: items = [], isLoading } = useQuery<ItineraryItem[]>({
    queryKey: ["itinerary", activeTrip?.id],
    queryFn: async () => {
      if (!activeTrip?.id) return [];
      const { data, error } = await supabase
        .from("itinerary")
        .select("*")
        .eq("trip_id", activeTrip.id)
        .order("date", { ascending: true })
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!activeTrip?.id,
  });

  const handleAddStop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTrip || !location.trim()) return;
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const { error } = await supabase.from("itinerary").insert({
        trip_id: activeTrip.id,
        date,
        location: location.trim(),
        description: description.trim() || null,
        image_url: imageUrl.trim() || null,
      });

      if (error) throw error;

      // Reset Form fields (keep date)
      setLocation("");
      setDescription("");
      setImageUrl("");
      
      queryClient.invalidateQueries({ queryKey: ["itinerary", activeTrip.id] });
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to add itinerary stop");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteStop = async (id: string) => {
    if (!activeTrip) return;
    if (!confirm("Are you sure you want to delete this itinerary stop?")) return;

    try {
      const { error } = await supabase.from("itinerary").delete().eq("id", id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["itinerary", activeTrip.id] });
    } catch (err: any) {
      alert(err.message || "Failed to delete itinerary stop");
    }
  };

  const handleEditStopSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTrip || !editingStop || !editLocation.trim()) return;
    setIsSavingStop(true);
    setEditErrorMsg(null);

    try {
      const { error } = await supabase
        .from("itinerary")
        .update({
          date: editStopDate,
          location: editLocation.trim(),
          description: editDescription.trim() || null,
          image_url: editImageUrl.trim() || null,
        })
        .eq("id", editingStop.id);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["itinerary", activeTrip.id] });
      setEditingStop(null);
    } catch (err: any) {
      setEditErrorMsg(err.message || "Failed to update itinerary stop");
    } finally {
      setIsSavingStop(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const options: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric", year: "numeric" };
    return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", options);
  };

  if (!activeTrip) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center max-w-md mx-auto">
        <div className="h-12 w-12 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-400 flex items-center justify-center mb-4">
          <MapPin className="h-6 w-6" />
        </div>
        <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-50">No Active Trip Workspace</h3>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-2">
          You must activate a trip workspace before viewing or planning the daily itinerary.
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

  const isAdmin = profile?.is_admin === true;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50 flex items-center gap-2">
          <Compass className="h-6 w-6 text-neutral-800 dark:text-neutral-200" />
          Daily Itinerary
        </h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
          Explore and plan locations we are visiting on specific dates.
        </p>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Form & Weather (Always Visible) */}
        <div className="lg:col-span-1 space-y-6">
          {isAdmin && (
            <Card className="border border-neutral-200 dark:border-neutral-800">
              <form onSubmit={handleAddStop}>
                <CardHeader>
                  <CardTitle className="text-base font-semibold">Add Itinerary Stop</CardTitle>
                  <CardDescription>Plan specific stops and attractions for active trip.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {errorMsg && (
                    <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/40 text-red-600 dark:text-red-400 rounded-lg text-xs">
                      {errorMsg}
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label htmlFor="stopDate">Target Date</Label>
                    <Input
                      id="stopDate"
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="location">Location / Attraction</Label>
                    <Input
                      id="location"
                      placeholder="e.g. Eiffel Tower, Shinjuku Gyoen"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="description">Details / Notes</Label>
                    <textarea
                      id="description"
                      rows={3}
                      className="w-full text-sm bg-transparent rounded-lg border border-neutral-200 dark:border-neutral-850 px-3 py-2 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-[hsl(var(--accent))] placeholder:text-neutral-400"
                      placeholder="e.g. Guided tour at 2 PM, wear comfortable walking shoes."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <Label htmlFor="imageUrl" className="flex items-center gap-1">
                        <ImageIcon className="h-3.5 w-3.5 text-neutral-400" />
                        Image URL
                      </Label>
                      <span className="text-[10px] text-neutral-400 italic">Optional</span>
                    </div>
                    <Input
                      id="imageUrl"
                      placeholder="Paste image address (https://...)"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                    />
                  </div>

                  {/* Preset Helper Panel */}
                  <div className="space-y-1.5 pt-1.5">
                    <Label className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 flex items-center gap-1">
                      <Sparkles className="h-3 w-3 text-amber-500" />
                      Quick Image Presets
                    </Label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {PRESET_IMAGES.map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => setImageUrl(preset.url)}
                          className="text-[10px] py-1 px-1.5 text-left border border-neutral-100 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-900/35 rounded truncate transition-all text-neutral-700 dark:text-neutral-300 font-medium cursor-pointer"
                          title={preset.label}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button type="submit" disabled={isSubmitting} className="w-full cursor-pointer text-xs" variant="accent">
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        Adding Stop...
                      </>
                    ) : (
                      <>
                        <Plus className="mr-1.5 h-3.5 w-3.5" />
                        Add Itinerary Stop
                      </>
                    )}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          )}

          <WeatherWidget location={activeTrip.location || "Delhi"} />
        </div>

        {/* Right Column: Timeline stops */}
        <div className="lg:col-span-2 space-y-6">
          {isLoading ? (
            <div className="py-20 text-center flex justify-center items-center">
              <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-16 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-3xl bg-white dark:bg-neutral-900/30 text-center">
              <div className="h-12 w-12 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-400 flex items-center justify-center mb-4">
                <Compass className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-50">Itinerary is Empty</h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2 max-w-sm">
                {isAdmin
                  ? "Define stops, activities, and visual spaces by using the left-hand form."
                  : "No specific date stops planned yet. The administrator will configure destinations shortly."}
              </p>
            </div>
          ) : (
            <div className="relative pl-6 sm:pl-8 border-l border-neutral-200 dark:border-neutral-850 space-y-8 py-2">
              {items.map((item, index) => {
                return (
                  <div key={item.id} className="relative">
                    {/* Timeline Node Point */}
                    <div className="absolute -left-[31px] sm:-left-[39px] top-1.5 h-6 w-6 rounded-full border-2 border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 flex items-center justify-center shadow-sm">
                      <div className="h-2.5 w-2.5 rounded-full bg-[hsl(var(--accent))]" />
                    </div>

                    {/* Card container */}
                    <Card className="border border-neutral-100 dark:border-neutral-800/80 shadow-sm hover:shadow-md transition-apple overflow-hidden">
                      <div className="flex flex-col sm:flex-row">
                        
                        {/* Location Details (left/main inside card) */}
                        <div className="flex-1 p-5 flex flex-col justify-between space-y-4">
                          <div className="space-y-2">
                            {/* Date Badge */}
                            <div className="flex items-center gap-1.5 text-xs font-bold text-[hsl(var(--accent))]">
                              <Calendar className="h-3.5 w-3.5" />
                              <span>{formatDate(item.date)}</span>
                            </div>
                            
                            {/* Location Header */}
                            <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-50 tracking-tight flex items-center gap-1.5">
                              <MapPin className="h-4 w-4 shrink-0 text-neutral-400" />
                              {item.location}
                            </h3>

                            {/* Notes description */}
                            {item.description && (
                              <p className="text-sm text-neutral-600 dark:text-neutral-450 leading-relaxed font-medium whitespace-pre-wrap">
                                {item.description}
                              </p>
                            )}
                          </div>

                          {/* Actions / Admin edit/delete stop */}
                          {isAdmin && (
                            <div className="pt-2 flex justify-end items-center gap-2">
                              <button
                                onClick={() => {
                                  setEditingStop(item);
                                  setEditStopDate(item.date);
                                  setEditLocation(item.location);
                                  setEditDescription(item.description || "");
                                  setEditImageUrl(item.image_url || "");
                                  setEditErrorMsg(null);
                                }}
                                type="button"
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-neutral-400 hover:text-[hsl(var(--accent))] hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-apple cursor-pointer font-semibold"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                Edit stop
                              </button>
                              <button
                                onClick={() => handleDeleteStop(item.id)}
                                type="button"
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded transition-apple cursor-pointer font-semibold"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Delete stop
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Stop Image representation (right inside card) */}
                        {item.image_url && (
                          <div className="w-full sm:w-48 md:w-56 h-48 sm:h-auto relative shrink-0 overflow-hidden border-t sm:border-t-0 sm:border-l border-neutral-100 dark:border-neutral-800/50">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={item.image_url}
                              alt={item.location}
                              className="w-full h-full object-cover hover:scale-105 transition-apple duration-500"
                              onError={(e) => {
                                // Fallback if image fails to load
                                e.currentTarget.style.display = "none";
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </Card>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* Edit Itinerary Stop Modal */}
      <Dialog open={editingStop !== null} onOpenChange={(open) => { if (!open) setEditingStop(null); }}>
        <DialogContent className="sm:max-w-[425px] border border-neutral-200 dark:border-neutral-800 shadow-sm rounded-xl">
          <form onSubmit={handleEditStopSubmit}>
            <DialogHeader>
              <DialogTitle>Edit Itinerary Stop</DialogTitle>
              <DialogDescription>
                Modify specific stops and attractions for this trip.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {editErrorMsg && (
                <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/40 text-red-600 dark:text-red-400 rounded-lg text-xs">
                  {editErrorMsg}
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="editStopDate">Target Date</Label>
                <Input
                  id="editStopDate"
                  type="date"
                  value={editStopDate}
                  onChange={(e) => setEditStopDate(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="editLocation">Location / Attraction</Label>
                <Input
                  id="editLocation"
                  placeholder="e.g. Eiffel Tower, Shinjuku Gyoen"
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="editDescription">Details / Notes</Label>
                <textarea
                  id="editDescription"
                  rows={3}
                  className="w-full text-sm bg-transparent rounded-lg border border-neutral-200 dark:border-neutral-850 px-3 py-2 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-[hsl(var(--accent))] placeholder:text-neutral-400"
                  placeholder="e.g. Guided tour at 2 PM, wear comfortable walking shoes."
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <Label htmlFor="editImageUrl" className="flex items-center gap-1">
                    <ImageIcon className="h-3.5 w-3.5 text-neutral-400" />
                    Image URL
                  </Label>
                  <span className="text-[10px] text-neutral-400 italic">Optional</span>
                </div>
                <Input
                  id="editImageUrl"
                  placeholder="Paste image address (https://...)"
                  value={editImageUrl}
                  onChange={(e) => setEditImageUrl(e.target.value)}
                />
              </div>

              {/* Preset Helper Panel */}
              <div className="space-y-1.5 pt-1.5">
                <Label className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-amber-500" />
                  Quick Image Presets
                </Label>
                <div className="grid grid-cols-2 gap-1.5">
                  {PRESET_IMAGES.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setEditImageUrl(preset.url)}
                      className="text-[10px] py-1 px-1.5 text-left border border-neutral-100 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-900/35 rounded truncate transition-all text-neutral-700 dark:text-neutral-300 font-medium cursor-pointer"
                      title={preset.label}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingStop(null)} className="cursor-pointer text-xs">
                Cancel
              </Button>
              <Button type="submit" disabled={isSavingStop || !editLocation.trim()} className="cursor-pointer text-xs" variant="accent">
                {isSavingStop ? (
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
