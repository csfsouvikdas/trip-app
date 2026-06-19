"use client";

import * as React from "react";
import { useDashboard } from "@/components/providers";
import { createClient } from "@/lib/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Plus, Trash2, CheckCircle2, User, Loader2, Sparkles, Check, Lock, Unlock, AlertCircle, ArrowRight } from "lucide-react";
import Link from "next/link";

interface Poll {
  id: string;
  trip_id: string;
  question: string;
  created_by: string;
  is_closed: boolean;
  created_at: string;
}

interface PollOption {
  id: string;
  poll_id: string;
  option_text: string;
}

interface PollVote {
  id: string;
  poll_id: string;
  option_id: string;
  profile_id: string;
  created_at: string;
}

export default function PollsPage() {
  const { activeTrip, profile } = useDashboard();
  const supabase = createClient();
  const queryClient = useQueryClient();

  const [question, setQuestion] = React.useState("");
  const [choices, setChoices] = React.useState<string[]>(["", ""]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // Fetch travelers for profile resolution
  const { data: travelers = [] } = useQuery<any[]>({
    queryKey: ["poll_travelers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, username, avatar_url");
      if (error) throw error;
      return data;
    },
  });

  // Fetch polls
  const { data: polls = [], isLoading: isLoadingPolls, refetch: refetchPolls } = useQuery<Poll[]>({
    queryKey: ["polls", activeTrip?.id],
    queryFn: async () => {
      if (!activeTrip?.id) return [];
      const { data, error } = await supabase
        .from("polls")
        .select("*")
        .eq("trip_id", activeTrip.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!activeTrip?.id,
  });

  // Fetch poll options
  const { data: options = [], refetch: refetchOptions } = useQuery<PollOption[]>({
    queryKey: ["poll_options", activeTrip?.id],
    queryFn: async () => {
      if (!activeTrip?.id) return [];
      const { data, error } = await supabase
        .from("poll_options")
        .select("*");
      if (error) throw error;
      return data;
    },
    enabled: !!activeTrip?.id,
  });

  // Fetch votes
  const { data: votes = [], refetch: refetchVotes } = useQuery<PollVote[]>({
    queryKey: ["poll_votes", activeTrip?.id],
    queryFn: async () => {
      if (!activeTrip?.id) return [];
      const { data, error } = await supabase
        .from("poll_votes")
        .select("*");
      if (error) throw error;
      return data;
    },
    enabled: !!activeTrip?.id,
  });

  const handleAddChoiceField = () => {
    setChoices([...choices, ""]);
  };

  const handleRemoveChoiceField = (idx: number) => {
    if (choices.length <= 2) return;
    const next = [...choices];
    next.splice(idx, 1);
    setChoices(next);
  };

  const handleChoiceChange = (idx: number, val: string) => {
    const next = [...choices];
    next[idx] = val;
    setChoices(next);
  };

  const handleCreatePoll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTrip || !profile) return;
    if (!question.trim()) return;

    const validChoices = choices.map((c) => c.trim()).filter(Boolean);
    if (validChoices.length < 2) {
      setErrorMsg("Please enter at least 2 valid options for the poll.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      // 1. Create Poll record
      const { data: poll, error: pollErr } = await supabase
        .from("polls")
        .insert({
          trip_id: activeTrip.id,
          question: question.trim(),
          created_by: profile.id,
        })
        .select()
        .single();

      if (pollErr) throw pollErr;

      // 2. Create choices Options records
      const optionInserts = validChoices.map((txt) => ({
        poll_id: poll.id,
        option_text: txt,
      }));

      const { error: optErr } = await supabase
        .from("poll_options")
        .insert(optionInserts);

      if (optErr) throw optErr;

      setQuestion("");
      setChoices(["", ""]);
      refetchPolls();
      refetchOptions();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to create poll");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVote = async (pollId: string, optionId: string) => {
    if (!profile) return;
    
    // Find if the poll is closed
    const targetPoll = polls.find((p) => p.id === pollId);
    if (targetPoll?.is_closed) {
      alert("This poll has been frozen/closed and is no longer accepting votes.");
      return;
    }

    try {
      // Upsert vote choice to handle unique constraint (poll_id, profile_id) atomically
      const { error } = await supabase.from("poll_votes").upsert(
        {
          poll_id: pollId,
          option_id: optionId,
          profile_id: profile.id,
        },
        { onConflict: "poll_id,profile_id" }
      );

      if (error) throw error;
      refetchVotes();
    } catch (err: any) {
      alert(err.message || "Failed to submit vote");
    }
  };

  const handleDeletePoll = async (id: string) => {
    if (!profile?.is_admin) {
      alert("Only administrators are permitted to delete polls.");
      return;
    }
    if (!confirm("Are you sure you want to delete this poll and all its recorded votes?")) return;

    try {
      const { error } = await supabase.from("polls").delete().eq("id", id);
      if (error) throw error;
      refetchPolls();
      refetchOptions();
      refetchVotes();
    } catch (err: any) {
      alert(err.message || "Failed to delete poll");
    }
  };

  const handleToggleClosePoll = async (poll: Poll) => {
    if (!profile?.is_admin) {
      alert("Only administrators can open or close polls.");
      return;
    }
    try {
      const { error } = await supabase
        .from("polls")
        .update({ is_closed: !poll.is_closed })
        .eq("id", poll.id);

      if (error) throw error;
      refetchPolls();
    } catch (err: any) {
      alert(err.message || "Failed to update poll state");
    }
  };

  // Helper resolver functions
  const getCreatorName = (userId: string) => {
    const t = travelers.find((x) => x.id === userId);
    return t ? t.full_name : "Unknown User";
  };

  const getCreatorUsername = (userId: string) => {
    const t = travelers.find((x) => x.id === userId);
    return t ? t.username : "unknown";
  };

  if (!activeTrip) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center max-w-md mx-auto">
        <div className="h-12 w-12 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-400 flex items-center justify-center mb-4">
          <BarChart3 className="h-6 w-6" />
        </div>
        <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-50">No Active Trip Workspace</h3>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-2">
          You must activate a trip workspace before planning group decisions or voting on polls.
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
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50 flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-neutral-800 dark:text-neutral-200" />
          Group Polls & Decisions
        </h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
          Coordinate decisions, vote on activities, and align the traveler roster in real-time.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Create Poll Form */}
        <div className="lg:col-span-1">
          <Card className="border border-neutral-200 dark:border-neutral-800 sticky top-24">
            <form onSubmit={handleCreatePoll}>
              <CardHeader>
                <CardTitle className="text-base font-semibold">Create New Poll</CardTitle>
                <CardDescription>Get feedback from the travel roster on group choices.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {errorMsg && (
                  <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/40 text-red-600 dark:text-red-400 rounded-lg text-xs">
                    {errorMsg}
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="question">Poll Question</Label>
                  <Input
                    id="question"
                    placeholder="e.g. Which beach resort should we book?"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label>Choices / Options</Label>
                    <button
                      type="button"
                      onClick={handleAddChoiceField}
                      className="text-[10px] text-emerald-600 dark:text-emerald-500 font-bold hover:underline cursor-pointer"
                    >
                      + Add Option
                    </button>
                  </div>

                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                    {choices.map((choice, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <Input
                          placeholder={`Option ${idx + 1}`}
                          value={choice}
                          onChange={(e) => handleChoiceChange(idx, e.target.value)}
                          required
                          disabled={isSubmitting}
                        />
                        {choices.length > 2 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveChoiceField(idx)}
                            className="p-1.5 text-neutral-400 hover:text-red-500 rounded cursor-pointer"
                            title="Remove Choice"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
              <CardFooter className="pt-2">
                <Button type="submit" disabled={isSubmitting} className="w-full cursor-pointer text-xs" variant="default">
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="mr-1.5 h-3.5 w-3.5" />
                      Publish Poll
                    </>
                  )}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>

        {/* Right Column: Displaying Polls */}
        <div className="lg:col-span-2 space-y-6">
          {isLoadingPolls ? (
            <div className="py-20 text-center flex justify-center items-center">
              <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
            </div>
          ) : polls.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-16 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-3xl bg-white dark:bg-neutral-900/30 text-center">
              <div className="h-12 w-12 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-400 flex items-center justify-center mb-4">
                <BarChart3 className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-50">No Active Polls</h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2 max-w-sm">
                Travel decisions are currently settled! Create a new poll on the left sidebar to coordinate roster choices.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {polls.map((poll) => {
                const pollOpts = options.filter((o) => o.poll_id === poll.id);
                const pollVotes = votes.filter((v) => v.poll_id === poll.id);
                const totalVotesCount = pollVotes.length;

                // Find user's vote for this poll
                const userVote = pollVotes.find((v) => v.profile_id === profile?.id);

                return (
                  <Card
                    key={poll.id}
                    className={`border border-neutral-100 dark:border-neutral-800/80 shadow-sm relative transition-apple overflow-hidden ${
                      poll.is_closed ? "opacity-75 bg-neutral-50/10 dark:bg-neutral-950/10" : ""
                    }`}
                  >
                    <CardHeader className="pb-3 border-b border-neutral-50 dark:border-neutral-800/40">
                      <div className="flex justify-between items-start gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                              poll.is_closed
                                ? "bg-red-500/10 text-red-500 border-red-500/20"
                                : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                            }`}>
                              {poll.is_closed ? "Frozen / Closed" : "Open for Votes"}
                            </span>
                            <span className="text-[10px] text-neutral-400 font-semibold">
                              by @{getCreatorUsername(poll.created_by)} • {totalVotesCount} votes cast
                            </span>
                          </div>
                          <CardTitle className="text-base font-bold text-neutral-900 dark:text-neutral-50 leading-snug mt-1.5">
                            {poll.question}
                          </CardTitle>
                        </div>

                        {/* Admin Action Menu: Open/Close or Delete */}
                        {profile?.is_admin && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => handleToggleClosePoll(poll)}
                              className="p-1.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 rounded transition-apple cursor-pointer"
                              title={poll.is_closed ? "Re-open Poll" : "Freeze/Close Poll"}
                            >
                              {poll.is_closed ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                            </button>
                            <button
                              onClick={() => handleDeletePoll(poll.id)}
                              className="p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded transition-apple cursor-pointer"
                              title="Delete Poll"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </CardHeader>
                    
                    <CardContent className="p-6 space-y-4">
                      {pollOpts.map((opt) => {
                        const optVotes = pollVotes.filter((v) => v.option_id === opt.id);
                        const optVotesCount = optVotes.length;
                        const percentage = totalVotesCount > 0 ? Math.round((optVotesCount / totalVotesCount) * 100) : 0;
                        const hasVotedThis = userVote?.option_id === opt.id;

                        // Find voter profiles to display initials/avatar
                        const voters = optVotes.map((v) => {
                          const p = travelers.find((x) => x.id === v.profile_id);
                          return p || { full_name: "Explorer", username: "voter", avatar_url: "🐒" };
                        });

                        return (
                          <div key={opt.id} className="space-y-1.5">
                            <div className="flex justify-between items-center gap-2">
                              {/* Option Check Selector */}
                              <button
                                onClick={() => handleVote(poll.id, opt.id)}
                                disabled={poll.is_closed}
                                className={`text-xs font-semibold px-3 py-2 border rounded-xl flex-1 text-left flex items-center justify-between transition-all ${
                                  poll.is_closed
                                    ? "bg-transparent border-neutral-100 dark:border-neutral-850 cursor-not-allowed"
                                    : hasVotedThis
                                    ? "bg-[hsl(var(--accent))]/10 border-[hsl(var(--accent))] text-[hsl(var(--accent))] font-bold scale-[1.01]"
                                    : "bg-white hover:bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-850 cursor-pointer hover:border-neutral-300"
                                }`}
                              >
                                <span className="truncate">{opt.option_text}</span>
                                {hasVotedThis && (
                                  <span className="h-4.5 w-4.5 rounded-full bg-[hsl(var(--accent))] text-white flex items-center justify-center shrink-0">
                                    <Check className="h-3 w-3 stroke-[3]" />
                                  </span>
                                )}
                              </button>

                              {/* Vote Ratio Indicator */}
                              <span className="text-xs font-bold text-neutral-500 w-12 text-right shrink-0">
                                {percentage}%
                              </span>
                            </div>

                            {/* visual progress bar */}
                            <div className="w-full bg-neutral-100 dark:bg-neutral-850 h-1.5 rounded-full overflow-hidden relative">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  hasVotedThis ? "bg-[hsl(var(--accent))]" : "bg-neutral-400 dark:bg-neutral-700"
                                }`}
                                style={{ width: `${percentage}%` }}
                              />
                            </div>

                            {/* voter avatar group list */}
                            {voters.length > 0 && (
                              <div className="flex items-center gap-1 pl-1 flex-wrap pt-0.5">
                                <span className="text-[9px] text-neutral-400 uppercase tracking-wider mr-1.5">Voted:</span>
                                <div className="flex -space-x-1.5 overflow-hidden">
                                  {voters.map((voter, vIdx) => (
                                    <div
                                      key={vIdx}
                                      className="h-5 w-5 rounded-full border border-white dark:border-neutral-900 bg-neutral-200 dark:bg-neutral-850 flex items-center justify-center text-xs shrink-0 select-none cursor-help"
                                      title={`${voter.full_name} (@${voter.username})`}
                                    >
                                      {voter.avatar_url || (voter.full_name ? voter.full_name[0].toUpperCase() : "U")}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </CardContent>
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
