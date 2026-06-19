"use client";

import * as React from "react";
import { useDashboard } from "@/components/providers";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Sparkles, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

const AVATAR_EMOJIS = ["🐒", "🦁", "🐯", "🐼", "🐨", "🦊", "🐰", "🐻", "🐶", "🐱", "🦍", "🐸"];

export default function ProfilePage() {
  const { profile, login } = useDashboard();
  const supabase = createClient();

  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [selectedEmoji, setSelectedEmoji] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [success, setSuccess] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // Load initial values from profile
  React.useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      setEmail(profile.email || "");
      setPassword(profile.password || "");
      setSelectedEmoji(profile.avatar_url || AVATAR_EMOJIS[0]);
    }
  }, [profile]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setLoading(true);
    setErrorMsg(null);
    setSuccess(false);

    try {
      const updatedProfile = {
        full_name: fullName.trim(),
        email: email.trim() || null,
        password: password.trim(),
        avatar_url: selectedEmoji,
      };

      const { data, error } = await supabase
        .from("profiles")
        .update(updatedProfile)
        .eq("id", profile.id)
        .select()
        .single();

      if (error) throw error;

      // Update session logic client-side
      login(data);
      setSuccess(true);
    } catch (err: any) {
      console.error("Update profile error:", err);
      setErrorMsg(err.message || "Failed to update profile details.");
    } finally {
      setLoading(false);
    }
  };

  if (!profile) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50 flex items-center gap-2">
          <User className="h-6 w-6 text-neutral-800 dark:text-neutral-200" />
          My Profile Settings
        </h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
          Customize your traveler identity and security credentials.
        </p>
      </div>

      <Card className="border border-neutral-100 dark:border-neutral-800">
        <form onSubmit={handleUpdateProfile}>
          <CardHeader className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left border-b border-neutral-100 dark:border-neutral-800 pb-6 mb-6">
            <div className="h-16 w-16 rounded-2xl bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 flex items-center justify-center text-3xl shadow-sm">
              {selectedEmoji}
            </div>
            <div>
              <CardTitle className="text-lg font-bold flex items-center gap-1.5 justify-center sm:justify-start">
                {profile.full_name}
                {profile.is_admin && (
                  <span className="text-[10px] bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400 px-2 py-0.5 rounded-full font-bold">
                    Admin
                  </span>
                )}
              </CardTitle>
              <CardDescription>
                @{profile.username} • Account Owner
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {success && (
              <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-450 rounded-lg text-xs font-semibold border border-emerald-100 dark:border-emerald-900/40">
                <CheckCircle2 className="h-4.5 w-4.5 shrink-0" />
                <span>Your profile has been updated successfully!</span>
              </div>
            )}
            {errorMsg && (
              <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-450 rounded-lg text-xs border border-red-100 dark:border-red-900/40">
                <AlertCircle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Select Travel Emoji</Label>
              <div className="grid grid-cols-6 sm:grid-cols-12 gap-2 p-3.5 bg-neutral-50 dark:bg-neutral-950 rounded-xl border border-neutral-100 dark:border-neutral-850">
                {AVATAR_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setSelectedEmoji(emoji)}
                    className={`h-9 w-9 text-lg flex items-center justify-center rounded-lg cursor-pointer transition-all hover:scale-110 active:scale-95 ${
                      selectedEmoji === emoji
                        ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-950 ring-2 ring-neutral-300 dark:ring-neutral-700"
                        : "bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800"
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="prof-username">Username (Read-only)</Label>
                <Input
                  id="prof-username"
                  value={`@${profile.username}`}
                  disabled
                  className="bg-neutral-100 dark:bg-neutral-850"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="prof-fullname">Full Name</Label>
                <Input
                  id="prof-fullname"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="John Doe"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="prof-email">Email Address</Label>
                <Input
                  id="prof-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="john@example.com"
                  required
                  disabled={loading}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="prof-password">Update Password</Label>
                <Input
                  id="prof-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  disabled={loading}
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="border-t border-neutral-100 dark:border-neutral-800/60 pt-4 flex justify-end gap-2">
            <Button type="submit" disabled={loading} className="cursor-pointer text-xs" variant="default">
              {loading ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Saving Changes...
                </>
              ) : (
                <>
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                  Update Profile
                </>
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
