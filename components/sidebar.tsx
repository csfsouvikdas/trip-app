"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useDashboard } from "@/components/providers";
import { createClient } from "@/lib/supabase/client";
import { Map, CreditCard, ListTodo, Utensils, LogOut, Menu, Shield, Sun, Moon, Calendar, BarChart3, Image } from "lucide-react";
import { cn } from "@/components/ui/button";

const navItems = [
  { href: "/dashboard/trips", label: "Trips", icon: Map },
  { href: "/dashboard/expenses", label: "Expenses", icon: CreditCard },
  { href: "/dashboard/checklist", label: "Checklist", icon: ListTodo },
  { href: "/dashboard/menu-planner", label: "Menu Planner", icon: Utensils },
  { href: "/dashboard/itinerary", label: "Itinerary", icon: Calendar },
  { href: "/dashboard/polls", label: "Group Polls", icon: BarChart3 },
  { href: "/dashboard/gallery", label: "Gang Gallery", icon: Image },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, activeTrip, logout, theme, toggleTheme } = useDashboard();
  const supabase = createClient();
  const [isOpen, setIsOpen] = React.useState(false);

  const sidebarItems = React.useMemo(() => {
    const items = [...navItems];
    if (profile?.is_admin) {
      items.push({ href: "/dashboard/admin", label: "Admin Panel", icon: Shield });
    }
    return items;
  }, [profile]);

  const handleSignOut = async () => {
    logout();
  };

  return (
    <>
      {/* Sidebar Backdrop Overlay on Mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/45 backdrop-blur-[2px] md:hidden animate-in fade-in duration-200"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Container (Desktop fixed, Mobile sliding overlay) */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 flex flex-col border-r border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 transition-transform duration-300 ease-in-out md:translate-x-0 md:z-30",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Brand / Logo */}
        <div className="flex items-center gap-2.5 px-6 h-16 border-b border-neutral-100 dark:border-neutral-800">
          <div className="h-8 w-8 rounded-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center overflow-hidden">
            <img src="/favicon.ico" className="h-full w-full scale-125 object-contain" alt="Monkey Gang Logo" />
          </div>
          <span className="font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
            Monkey Gang 🐒
          </span>
        </div>

        {/* Selected Trip Details */}
        <div className="p-4 border-b border-neutral-100 dark:border-neutral-800">
          <div className="px-3 py-2 bg-neutral-50 dark:bg-neutral-950 rounded-lg">
            <p className="text-[10px] uppercase font-bold tracking-wider text-neutral-400">
              Active Trip
            </p>
            <p className="text-sm font-semibold truncate text-neutral-800 dark:text-neutral-200 mt-0.5">
              {activeTrip ? activeTrip.name : "No Trip Selected"}
            </p>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
          {sidebarItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href === "/dashboard/trips" && pathname === "/dashboard");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-apple group cursor-pointer",
                  isActive
                    ? "bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-50"
                    : "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-950 dark:text-neutral-400 dark:hover:bg-neutral-800/40 dark:hover:text-neutral-200"
                )}
              >
                <Icon className={cn(
                  "h-4.5 w-4.5 transition-apple",
                  isActive ? "text-neutral-900 dark:text-neutral-50" : "text-neutral-400 group-hover:text-neutral-600 dark:group-hover:text-neutral-300"
                )} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User Profile / Logout Section */}
        <div className="p-4 border-t border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg">
            <Link
              href="/dashboard/profile"
              className="flex items-center gap-2.5 overflow-hidden hover:bg-neutral-50 dark:hover:bg-neutral-800/40 p-1.5 rounded-lg transition-apple cursor-pointer flex-1"
            >
              <div className="h-8 w-8 rounded-full bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center text-lg shrink-0 border border-neutral-200 dark:border-neutral-700">
                {profile?.avatar_url || (profile?.full_name ? profile.full_name[0].toUpperCase() : "U")}
              </div>
              <div className="overflow-hidden text-left">
                <p className="text-xs font-semibold truncate text-neutral-800 dark:text-neutral-200">
                  {profile?.full_name || "User"}
                </p>
                <p className="text-[10px] text-neutral-400 truncate">
                  Explorer
                </p>
              </div>
            </Link>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={toggleTheme}
                className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 rounded-md transition-apple cursor-pointer"
                title={theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
              >
                {theme === "light" ? <Moon className="h-4.5 w-4.5" /> : <Sun className="h-4.5 w-4.5" />}
              </button>
              <button
                onClick={handleSignOut}
                className="p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-md transition-apple cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="h-4.5 w-4.5" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Tab Navigation (Under md) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t border-neutral-200 dark:border-neutral-800 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md px-2 py-1 z-40 flex justify-around items-center transition-apple shadow-[0_-4px_16px_rgba(0,0,0,0.03)] pb-safe-bottom">
        {[
          { href: "/dashboard/trips", label: "Trips", icon: Map },
          { href: "/dashboard/expenses", label: "Expenses", icon: CreditCard },
          { href: "/dashboard/itinerary", label: "Itinerary", icon: Calendar },
          { href: "/dashboard/checklist", label: "Checklist", icon: ListTodo },
        ].map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href === "/dashboard/trips" && pathname === "/dashboard");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 py-1 px-2.5 rounded-lg text-[10px] font-medium transition-apple shrink-0 cursor-pointer min-w-[56px]",
                isActive
                  ? "text-[hsl(var(--accent))]"
                  : "text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200"
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
        <button
          onClick={() => setIsOpen(true)}
          className="flex flex-col items-center justify-center gap-1 py-1 px-2.5 rounded-lg text-[10px] font-medium text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 cursor-pointer min-w-[56px]"
        >
          <Menu className="h-5 w-5" />
          <span>Menu</span>
        </button>
      </nav>
    </>
  );
}
