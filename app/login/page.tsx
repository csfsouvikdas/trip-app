"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useDashboard } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AlertCircle, Loader2, Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const { login } = useDashboard();

  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id, full_name, username, is_admin, password, onboarded")
      .eq("username", username.trim().toLowerCase())
      .eq("password", password.trim())
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
      setErrorMsg("Incorrect username or password.");
      setLoading(false);
      return;
    }

    // Save "Session" via context helper
    login(profile);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 p-4 dark:bg-neutral-950">
      <Card className="w-full max-w-[400px] shadow-lg border border-neutral-200 dark:border-neutral-800 dark:bg-neutral-900">
        <form onSubmit={handleLogin}>
          <CardHeader className="items-center text-center">
            <div className="mb-2 h-12 w-12 rounded-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center overflow-hidden">
              <img src="/favicon.ico" className="h-full w-full scale-125 object-contain" alt="Monkey Gang Logo" />
            </div>
            <CardTitle className="text-xl font-bold">Monkey Gang</CardTitle>
            <CardDescription>Enter your credentials to access your dashboard.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {errorMsg && (
              <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-lg text-xs leading-normal border border-red-100 dark:border-red-900/40">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="login-username">Username</Label>
              <Input
                id="login-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. souvik"
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="login-password">Password</Label>
              <div className="relative">
                <Input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pr-10"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button className="w-full cursor-pointer mt-2" disabled={loading}>
              {loading ? <Loader2 className="animate-spin h-4 w-4" /> : "Access Dashboard"}
            </Button>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}