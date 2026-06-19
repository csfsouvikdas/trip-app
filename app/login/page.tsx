"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useDashboard } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Compass, AlertCircle, Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const { login } = useDashboard();

  const [username, setUsername] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id, full_name, username, is_admin")
      .eq("username", username.trim().toLowerCase())
      .maybeSingle();

    if (error) {
      console.error("Login database error:", error);
      if (error.code === "42501" || error.message?.includes("row-level security")) {
        setErrorMsg("Database setup incomplete: Row-Level Security (RLS) is still active. Please run schema.sql in Supabase SQL editor.");
      } else {
        setErrorMsg(error.message || "Database connection error.");
      }
      setLoading(false);
      return;
    }

    if (!profile) {
      setErrorMsg("Name not found in our trip roster.");
      setLoading(false);
      return;
    }

    // Save "Session" via context helper
    login(profile);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 p-4">
      <Card className="w-full max-w-[400px] shadow-lg border border-neutral-200">
        <form onSubmit={handleLogin}>
          <CardHeader className="items-center text-center">
            <div className="mb-2 h-12 w-12 rounded-xl bg-neutral-900 text-white flex items-center justify-center">
              <Compass className="h-6 w-6" />
            </div>
            <CardTitle>Successful Trip ?</CardTitle>
            <CardDescription>Enter your username to access your dashboard.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {errorMsg && (
              <div className="flex items-start gap-2 p-3 bg-red-50 text-red-600 rounded-lg text-xs leading-normal border border-red-100">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="login-username">Your Username</Label>
              <Input
                id="login-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. souvik"
                required
                disabled={loading}
              />
            </div>
            <Button className="w-full cursor-pointer" disabled={loading}>
              {loading ? <Loader2 className="animate-spin h-4 w-4" /> : "Access Dashboard"}
            </Button>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}