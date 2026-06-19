"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

// Define Types
export interface Profile {
  id: string;
  full_name: string;
  username?: string;
  email?: string;
  is_admin?: boolean;
  avatar_url?: string | null;
  password?: string;
  onboarded?: boolean;
}

export interface Trip {
  id: string;
  user_id: string;
  name: string;
  location?: string;
  total_budget: number;
  google_refresh_token?: string | null;
  google_folder_id?: string | null;
  created_at: string;
}

export interface Expense {
  id: string;
  trip_id: string;
  amount: number;
  description: string;
  category: string;
  date: string;
  created_by?: string | null;
  created_at: string;
}

interface DashboardContextType {
  user: any | null;
  profile: Profile | null;
  trips: Trip[];
  isLoadingTrips: boolean;
  activeTrip: Trip | null;
  setActiveTrip: (trip: Trip | null) => void;
  expenses: Expense[];
  isLoadingExpenses: boolean;
  remainingBudget: number;
  refetchTrips: () => void;
  refetchExpenses: () => void;
  login: (profile: Profile) => void;
  logout: () => void;
  theme: "light" | "dark";
  toggleTheme: () => void;
}

const DashboardContext = React.createContext<DashboardContextType | undefined>(undefined);

export function useDashboard() {
  const context = React.useContext(DashboardContext);
  if (!context) {
    throw new Error("useDashboard must be used within a DashboardProvider");
  }
  return context;
}

function DashboardProviderInner({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const router = useRouter();

  const [user, setUser] = React.useState<any | null>(null);
  const [activeTrip, setActiveTripState] = React.useState<Trip | null>(null);
  const [theme, setTheme] = React.useState<"light" | "dark">("light");

  // Effect to load and apply theme on client mount
  React.useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    if (savedTheme) {
      setTheme(savedTheme);
      if (savedTheme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (prefersDark) {
        setTheme("dark");
        document.documentElement.classList.add("dark");
      } else {
        setTheme("light");
        document.documentElement.classList.remove("dark");
      }
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    localStorage.setItem("theme", nextTheme);
    if (nextTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  const login = (newProfile: Profile) => {
    localStorage.setItem("trip_user", JSON.stringify(newProfile));
    document.cookie = `trip_user=${newProfile.username}; path=/; max-age=31536000`;
    setUser(newProfile);
    queryClient.clear();
    if (newProfile.onboarded) {
      router.push("/dashboard");
    } else {
      router.push("/onboarding");
    }
  };

  const logout = () => {
    localStorage.removeItem("trip_user");
    localStorage.removeItem("activeTripId");
    document.cookie = "trip_user=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    setUser(null);
    setActiveTripState(null);
    queryClient.clear();
    router.push("/login");
  };

  // Get current session / user from localStorage
  React.useEffect(() => {
    let active = true;
    const checkSession = async () => {
      const savedUser = localStorage.getItem("trip_user");
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        if (!active) return;
        setUser(parsed);
        const path = window.location.pathname;
        if (!parsed.onboarded && path !== "/onboarding") {
          router.push("/onboarding");
        } else if (parsed.onboarded && path === "/onboarding") {
          router.push("/dashboard");
        }

        // Validate session against database to ensure user UUID exists
        try {
          const { data, error } = await supabase
            .from("profiles")
            .select("id, full_name, username, is_admin, password, onboarded, avatar_url")
            .eq("id", parsed.id)
            .maybeSingle();

          if (error || !data) {
            console.warn("Session invalid or database reset. Logging out.");
            logout();
          } else if (active) {
            // Update session if DB attributes changed
            if (JSON.stringify(data) !== JSON.stringify(parsed)) {
              localStorage.setItem("trip_user", JSON.stringify(data));
              setUser(data);
            }
          }
        } catch (err) {
          console.error("Session validation failed:", err);
        }
      } else {
        setUser(null);
        queryClient.clear();
        const path = window.location.pathname;
        if (path !== "/login" && path !== "/") {
          router.push("/login");
        }
      }
    };

    checkSession();

    // Check localStorage periodically or on storage events
    window.addEventListener("storage", checkSession);
    return () => {
      active = false;
      window.removeEventListener("storage", checkSession);
    };
  }, [queryClient, router]);

  // Profile is just the user session object itself
  const profile = user as Profile | null;

  // Fetch Trips
  const { data: trips = [], isLoading: isLoadingTrips, refetch: refetchTrips } = useQuery<Trip[]>({
    queryKey: ["trips", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("trips")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Load active trip from localStorage or default to first trip
  React.useEffect(() => {
    if (trips.length > 0) {
      const savedTripId = localStorage.getItem("activeTripId");
      const savedTrip = trips.find((t) => t.id === savedTripId);
      if (savedTrip) {
        setActiveTripState(savedTrip);
      } else {
        setActiveTripState(trips[0]);
      }
    } else {
      setActiveTripState(null);
    }
  }, [trips]);

  const setActiveTrip = (trip: Trip | null) => {
    setActiveTripState(trip);
    if (trip) {
      localStorage.setItem("activeTripId", trip.id);
    } else {
      localStorage.removeItem("activeTripId");
    }
  };

  // Fetch Expenses for active trip
  const { data: expenses = [], isLoading: isLoadingExpenses, refetch: refetchExpenses } = useQuery<Expense[]>({
    queryKey: ["expenses", activeTrip?.id],
    queryFn: async () => {
      if (!activeTrip?.id) return [];
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .eq("trip_id", activeTrip.id)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!activeTrip?.id,
  });

  // Calculate live remaining budget
  const remainingBudget = React.useMemo(() => {
    if (!activeTrip) return 0;
    const totalSpent = expenses.reduce((sum, exp) => sum + Number(exp.amount), 0);
    return activeTrip.total_budget - totalSpent;
  }, [activeTrip, expenses]);

  // Set up Supabase Realtime listeners for expenses, trips
  React.useEffect(() => {
    if (!user?.id) return;

    // Realtime channel for database changes
    const channel = supabase
      .channel("dashboard-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "expenses" },
        (payload) => {
          // If the expense belongs to current active trip (or we don't know the exact context), refetch expenses
          queryClient.invalidateQueries({ queryKey: ["expenses"] });
          queryClient.invalidateQueries({ queryKey: ["trips"] }); // Also refresh trips list to be safe
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trips" },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ["trips"] });
          // If the active trip was updated, refetch it
          if (payload.new && (payload.new as any).id === activeTrip?.id) {
            setActiveTripState(payload.new as Trip);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "checklist_items" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["checklist_items"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "menu_plan" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["menu_plan"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "itinerary" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["itinerary"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, queryClient, user?.id, activeTrip?.id]);

  return (
    <DashboardContext.Provider
      value={{
        user,
        profile: profile ?? null,
        trips,
        isLoadingTrips,
        activeTrip,
        setActiveTrip,
        expenses,
        isLoadingExpenses,
        remainingBudget,
        refetchTrips,
        refetchExpenses,
        login,
        logout,
        theme,
        toggleTheme,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
}

// Global Providers Wrapper
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <DashboardProviderInner>{children}</DashboardProviderInner>
    </QueryClientProvider>
  );
}
