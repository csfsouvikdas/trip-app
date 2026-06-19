"use client";

import * as React from "react";
import { useDashboard } from "@/components/providers";
import { createClient } from "@/lib/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { ListTodo, Plus, Trash2, Calendar, CheckSquare, ArrowRight, ClipboardList, Loader2, Sparkles } from "lucide-react";
import Link from "next/link";

interface ChecklistItem {
  id: string;
  trip_id: string;
  task: string;
  is_completed: boolean;
  day: string; // date string
  assigned_to?: string | null;
  created_at: string;
}

const PACKING_TEMPLATES = [
  {
    name: "Essential Documents",
    icon: "📄",
    items: [
      "Passport / Visa / ID card",
      "Flight tickets & boarding passes",
      "Hotel reservation confirmations",
      "Travel insurance policy",
      "Cash (INR) & credit cards",
    ],
  },
  {
    name: "Tech & Electronics",
    icon: "🔌",
    items: [
      "Phone charger & cables",
      "Power bank (fully charged)",
      "Universal travel adapter",
      "Headphones / Earbuds",
      "Camera & memory cards",
    ],
  },
  {
    name: "Toiletries & Meds",
    icon: "🧴",
    items: [
      "Toothbrush & toothpaste",
      "Deodorant & sunscreen",
      "Painkillers & prescription medications",
      "Hand sanitizer & face masks",
      "Bandages & motion sickness pills",
    ],
  },
];

export default function ChecklistPage() {
  const { activeTrip, profile } = useDashboard();
  const supabase = createClient();
  const queryClient = useQueryClient();

  const [newTaskText, setNewTaskText] = React.useState("");
  const [newDate, setNewDate] = React.useState(new Date().toISOString().split("T")[0]);
  const [inlineTaskText, setInlineTaskText] = React.useState<Record<string, string>>({}); // { [date]: "text" }
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isApplyingTemplate, setIsApplyingTemplate] = React.useState<string | null>(null);

  const [assignedTo, setAssignedTo] = React.useState<string>("common");
  const [inlineAssignedTo, setInlineAssignedTo] = React.useState<Record<string, string>>({});

  // Fetch profiles for task assignment
  const { data: travelers = [] } = useQuery<any[]>({
    queryKey: ["checklist_travelers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, username")
        .order("full_name", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const handleApplyTemplate = async (templateName: string, templateItems: string[]) => {
    if (!activeTrip) return;
    setIsApplyingTemplate(templateName);

    try {
      const inserts = templateItems.map((item) => ({
        trip_id: activeTrip.id,
        task: item,
        day: newDate,
        is_completed: false,
        assigned_to: null,
      }));

      const { error } = await supabase.from("checklist_items").insert(inserts);
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["checklist_items", activeTrip.id] });
    } catch (err: any) {
      alert(err.message || `Failed to apply ${templateName} template`);
    } finally {
      setIsApplyingTemplate(null);
    }
  };

  // Fetch checklist items
  const { data: items = [], isLoading } = useQuery<ChecklistItem[]>({
    queryKey: ["checklist_items", activeTrip?.id],
    queryFn: async () => {
      if (!activeTrip?.id) return [];
      const { data, error } = await supabase
        .from("checklist_items")
        .select("*")
        .eq("trip_id", activeTrip.id)
        .order("day", { ascending: true })
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!activeTrip?.id,
  });

  const displayedItems = React.useMemo(() => {
    if (!items) return [];
    if (profile?.is_admin) return items;
    return items.filter((item) => !item.assigned_to || item.assigned_to === profile?.id);
  }, [items, profile]);

  // Group items by day
  const groupedItems = React.useMemo(() => {
    const groups: Record<string, ChecklistItem[]> = {};
    displayedItems.forEach((item) => {
      if (!groups[item.day]) {
        groups[item.day] = [];
      }
      groups[item.day].push(item);
    });
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, [displayedItems]);

  const handleToggle = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("checklist_items")
        .update({ is_completed: !currentStatus })
        .eq("id", id);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["checklist_items", activeTrip?.id] });
    } catch (err: any) {
      alert(err.message || "Failed to update item");
    }
  };

  const handleAddTask = async (taskText: string, dateString: string, isInline = false, inlineAssign?: string) => {
    if (!activeTrip || !taskText.trim()) return;
    setIsSubmitting(true);

    try {
      const taskAssignee = inlineAssign !== undefined ? inlineAssign : assignedTo;
      const assignedVal = taskAssignee === "common" || !taskAssignee ? null : taskAssignee;

      const { error } = await supabase.from("checklist_items").insert({
        trip_id: activeTrip.id,
        task: taskText.trim(),
        day: dateString,
        is_completed: false,
        assigned_to: assignedVal,
      });

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["checklist_items", activeTrip.id] });

      if (isInline) {
        setInlineTaskText((prev) => ({ ...prev, [dateString]: "" }));
        setInlineAssignedTo((prev) => ({ ...prev, [dateString]: "common" }));
      } else {
        setNewTaskText("");
        setAssignedTo("common");
      }
    } catch (err: any) {
      alert(err.message || "Failed to add task");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!profile?.is_admin) {
      alert("Only administrators are permitted to delete checklist items.");
      return;
    }
    try {
      const { error } = await supabase.from("checklist_items").delete().eq("id", id);
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["checklist_items", activeTrip?.id] });
    } catch (err: any) {
      alert(err.message || "Failed to delete item");
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
          <ListTodo className="h-6 w-6" />
        </div>
        <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-50">No Active Trip Workspace</h3>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-2">
          You must activate a trip workspace before managing checklists.
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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50 flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-neutral-800 dark:text-neutral-200" />
            Trip Checklist
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            Stay organized with day-by-day packing, checklist, and scheduling guides.
          </p>
        </div>

        {/* Global Task Add Bar */}
        {profile?.is_admin && (
          <div className="flex flex-wrap items-center gap-2 max-w-2xl bg-white dark:bg-neutral-900 p-2 border border-neutral-100 dark:border-neutral-800 rounded-xl shadow-sm w-full md:w-auto">
            <Input
              placeholder="New quick task..."
              className="flex-1 min-w-[150px] border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-2 h-9 bg-transparent"
              value={newTaskText}
              onChange={(e) => setNewTaskText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddTask(newTaskText, newDate);
              }}
            />
            <Input
              type="date"
              className="w-auto border-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-xs px-2 h-9 bg-transparent shrink-0"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
            />
            <Select
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              className="w-auto border-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-xs px-2 h-9 bg-transparent shrink-0"
            >
              <option value="common">Common (All)</option>
              {travelers.map((t) => (
                <option key={t.id} value={t.id}>
                  Assign to: {t.full_name}
                </option>
              ))}
            </Select>
            <Button
              size="sm"
              onClick={() => handleAddTask(newTaskText, newDate)}
              disabled={isSubmitting || !newTaskText.trim()}
              className="cursor-pointer text-xs shrink-0 font-semibold"
              variant="default"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add
            </Button>
          </div>
        )}
      </div>

      {/* Main Grid: Templates Left, Checklist Right */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Left Column: Templates panel */}
        {profile?.is_admin && (
          <div className="lg:col-span-1">
            <Card className="border border-neutral-100 dark:border-neutral-800 sticky top-24">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-1.5">
                  <Sparkles className="h-4.5 w-4.5 text-amber-500" />
                  Quick Templates
                </CardTitle>
                <CardDescription>
                  Apply predefined lists to the active date: <span className="font-bold text-neutral-800 dark:text-neutral-200">{formatDate(newDate)}</span>.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {PACKING_TEMPLATES.map((tmpl) => (
                  <div
                    key={tmpl.name}
                    className="p-3 rounded-xl border border-neutral-100 dark:border-neutral-850 hover:bg-neutral-50/50 dark:hover:bg-neutral-900/10 transition-apple"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-neutral-850 dark:text-neutral-200">{tmpl.icon} {tmpl.name}</span>
                    </div>
                    <p className="text-[10px] text-neutral-400 mb-2 truncate leading-relaxed">
                      {tmpl.items.slice(0, 3).join(", ")}...
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full text-[10px] h-7 cursor-pointer"
                      onClick={() => handleApplyTemplate(tmpl.name, tmpl.items)}
                      disabled={isApplyingTemplate !== null}
                    >
                      {isApplyingTemplate === tmpl.name ? "Applying..." : "Apply Template"}
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Right Column: Checklist list */}
        <div className={profile?.is_admin ? "lg:col-span-3" : "lg:col-span-4"}>
          {isLoading ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-2xl bg-white dark:bg-neutral-900/30 text-center">
              <div className="h-10 w-10 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-400 flex items-center justify-center mb-3">
                <ListTodo className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-50">No Tasks Logged</h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 max-w-[280px]">
                {profile?.is_admin
                  ? "Input daily goals or packing checks using the add bar at the top or apply a template on the left."
                  : "No checklist items have been assigned to you or made common yet."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {groupedItems.map(([dateString, dayItems]) => {
                const completedCount = dayItems.filter((i) => i.is_completed).length;
                const progressPercentage = Math.round((completedCount / dayItems.length) * 100);

                return (
                  <Card key={dateString} className="border border-neutral-100 dark:border-neutral-800 flex flex-col justify-between">
                    <div>
                      <CardHeader className="pb-3 flex flex-row items-start justify-between gap-4">
                        <div className="space-y-1">
                          <CardTitle className="text-sm font-bold flex items-center gap-1.5 text-neutral-800 dark:text-neutral-200">
                            <Calendar className="h-4 w-4 text-neutral-400" />
                            {formatDate(dateString)}
                          </CardTitle>
                          <CardDescription className="text-xs">
                            {completedCount} of {dayItems.length} items completed
                          </CardDescription>
                        </div>
                        <span className="text-[10px] bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400 px-2 py-0.5 rounded font-bold shrink-0">
                          {progressPercentage}% Done
                        </span>
                      </CardHeader>

                      <CardContent className="space-y-2">
                        {/* Checklist items lists */}
                        <div className="space-y-1 divide-y divide-neutral-100/50 dark:divide-neutral-800/40">
                          {dayItems.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between gap-3 group py-2.5 px-1 rounded-md hover:bg-neutral-50/50 dark:hover:bg-neutral-900/10"
                            >
                              <div className="flex items-center gap-3 overflow-hidden select-none">
                                <Checkbox
                                  checked={item.is_completed}
                                  onCheckedChange={() => handleToggle(item.id, item.is_completed)}
                                  id={item.id}
                                />
                                <label
                                  htmlFor={item.id}
                                  className={`text-sm cursor-pointer truncate transition-apple font-medium ${
                                    item.is_completed
                                      ? "line-through text-neutral-400 dark:text-neutral-500"
                                      : "text-neutral-700 dark:text-neutral-300"
                                  }`}
                                >
                                  {item.task}
                                  {item.assigned_to && (
                                    <span className="ml-2 text-[10px] bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 px-1.5 py-0.5 rounded-full font-bold">
                                      @{travelers.find((t) => t.id === item.assigned_to)?.username || "Member"}
                                    </span>
                                  )}
                                </label>
                              </div>
                              {profile?.is_admin && (
                                <button
                                  onClick={() => handleDelete(item.id)}
                                  className="p-1 text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded cursor-pointer opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-apple"
                                  title="Delete task"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </div>

                    {/* Inline Card Footer: Add Task directly to this day */}
                    {profile?.is_admin && (
                      <CardFooter className="pt-4 border-t border-neutral-100 dark:border-neutral-800/50 flex flex-col gap-2">
                        <div className="flex items-center gap-2 w-full">
                          <Input
                            placeholder="Add task to this day..."
                            className="h-8 text-xs flex-1 bg-neutral-50/50 dark:bg-neutral-950/20 focus-visible:ring-neutral-200"
                            value={inlineTaskText[dateString] || ""}
                            onChange={(e) =>
                              setInlineTaskText((prev) => ({ ...prev, [dateString]: e.target.value }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                handleAddTask(inlineTaskText[dateString] || "", dateString, true, inlineAssignedTo[dateString]);
                              }
                            }}
                          />
                          <Button
                            size="sm"
                            className="h-8 px-3 cursor-pointer text-xs"
                            variant="secondary"
                            onClick={() =>
                              handleAddTask(inlineTaskText[dateString] || "", dateString, true, inlineAssignedTo[dateString])
                            }
                            disabled={isSubmitting || !(inlineTaskText[dateString] || "").trim()}
                          >
                            Add
                          </Button>
                        </div>
                        <Select
                          value={inlineAssignedTo[dateString] || "common"}
                          onChange={(e) =>
                            setInlineAssignedTo((prev) => ({ ...prev, [dateString]: e.target.value }))
                          }
                          className="h-7 text-[10px] w-full"
                        >
                          <option value="common">Common (All)</option>
                          {travelers.map((t) => (
                            <option key={t.id} value={t.id}>
                              Assign to: {t.full_name}
                            </option>
                          ))}
                        </Select>
                      </CardFooter>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
