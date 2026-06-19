"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useDashboard } from "@/components/providers";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, AlertCircle, Loader2 } from "lucide-react";

const AVATAR_EMOJIS = ["🐒", "🦁", "🐯", "🐼", "🐨", "🦊", "🐰", "🐻", "🐶", "🐱", "🦍", "🐸"];

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();
  const { user, login } = useDashboard();

  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [selectedEmoji, setSelectedEmoji] = React.useState(AVATAR_EMOJIS[0]);
  const [loading, setLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // If user is already onboarded, redirect immediately to dashboard
  React.useEffect(() => {
    if (user && user.onboarded) {
      router.replace("/dashboard");
    }
  }, [user, router]);

  const handleOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      const updatedProfile = {
        full_name: fullName.trim(),
        email: email.trim() || null,
        password: password.trim() || "password",
        avatar_url: selectedEmoji,
        onboarded: true,
      };

      const { data, error } = await supabase
        .from("profiles")
        .update(updatedProfile)
        .eq("id", user.id)
        .select()
        .single();

      if (error) throw error;

      // Log in again with updated profile
      login(data);
    } catch (err: any) {
      console.error("Onboarding error:", err);
      setErrorMsg(err.message || "Failed to complete onboarding.");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 p-4 dark:bg-neutral-950">
      <Card className="w-full max-w-[500px] shadow-xl border border-neutral-200 dark:border-neutral-800 dark:bg-neutral-900 animate-in fade-in zoom-in-95 duration-300">
        <form onSubmit={handleOnboarding}>
          <CardHeader className="items-center text-center">
            <div className="mb-2 h-14 w-14 rounded-2xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-950 flex items-center justify-center text-2xl shadow-md animate-bounce">
              {selectedEmoji}
            </div>
            <CardTitle className="text-2xl font-bold flex items-center gap-2">
              Welcome to the Gang <Sparkles className="h-5 w-5 text-amber-500 fill-amber-500 animate-pulse" />
            </CardTitle>
            <CardDescription className="max-w-[320px] mx-auto">
              Finish setting up your traveler profile to start planning trip rosters, budgets, and menus.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {errorMsg && (
              <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-lg text-xs border border-red-100 dark:border-red-900/40">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}
            
            <div className="space-y-1.5">
              <Label>Choose Traveler Emoji</Label>
              <div className="grid grid-cols-6 gap-2 p-3 bg-neutral-100 dark:bg-neutral-950 rounded-xl border border-neutral-200/50 dark:border-neutral-800">
                {AVATAR_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setSelectedEmoji(emoji)}
                    className={`h-10 w-10 text-xl flex items-center justify-center rounded-lg cursor-pointer transition-all hover:scale-110 active:scale-95 ${
                      selectedEmoji === emoji
                        ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-950 ring-2 ring-neutral-400 dark:ring-neutral-700"
                        : "bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800"
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="onboard-fullname">Full Name</Label>
              <Input
                id="onboard-fullname"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. John Doe"
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="onboard-email">Email Address</Label>
              <Input
                id="onboard-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. john@example.com"
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="onboard-password">Create Your Password</Label>
              <Input
                id="onboard-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Make it secure"
                required
                disabled={loading}
              />
            </div>
          </CardContent>
          <CardFooter className="pt-2">
            <Button className="w-full cursor-pointer" size="lg" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  Completing Setup...
                </>
              ) : (
                "Launch Dashboard"
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
