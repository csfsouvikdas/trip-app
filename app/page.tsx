"use client";

import * as React from "react";
import Link from "next/link";

export default function Home() {
  return (
    <div className="relative min-h-screen bg-[#09090b] text-[#fafafa] font-sans overflow-x-hidden selection:bg-emerald-500/30 selection:text-emerald-300">
      {/* Background Glow Blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[10%] w-[500px] h-[500px] rounded-full bg-emerald-500/10 blur-[120px] animate-pulse duration-[10000ms]" />
        <div className="absolute bottom-[10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-indigo-500/10 blur-[120px] animate-pulse duration-[15000ms]" />
      </div>

      {/* Navigation Header */}
      <header className="fixed top-0 left-0 right-0 h-18 border-b border-white/5 bg-[#09090b]/70 backdrop-blur-md z-50 flex items-center justify-between px-6 md:px-12">
        <Link href="/" className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-white" id="root-nav-logo">
          <div className="h-9 w-9 rounded-xl bg-neutral-900 border border-white/10 flex items-center justify-center text-lg shadow-md">
            🐒
          </div>
          <span>Monkey Gang</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm font-medium text-neutral-400 hover:text-white transition-all" id="root-nav-login">
            Sign In
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center bg-white text-black px-4 py-2 rounded-xl text-sm font-semibold hover:bg-transparent hover:text-white border border-white transition-all shadow-sm hover:border-emerald-500"
            id="root-nav-launch"
          >
            Launch App
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative max-w-7xl mx-auto px-6 md:px-12 pt-36 pb-20 z-10 flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-semibold text-emerald-400 mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#10b981]" />
          Meet the Rebranded Monkey Gang App
        </div>

        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-none max-w-4xl mb-6 bg-gradient-to-r from-white via-neutral-100 to-neutral-400 bg-clip-text text-transparent">
          Group Trip Management <br />
          <span className="bg-gradient-to-r from-emerald-400 to-emerald-600 bg-clip-text text-transparent">
            Perfected for the Gang.
          </span>
        </h1>

        <p className="text-neutral-400 text-lg md:text-xl max-w-2xl mb-10 leading-relaxed">
          Ditch chaotic spreadsheets. Manage trip rosters, log shared expenses securely, assign checklist items, and coordinate dinner planners in one dynamic obsidian interface.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 mb-20">
          <Link
            href="/login"
            className="inline-flex items-center justify-center bg-gradient-to-r from-emerald-500 to-emerald-600 text-white px-8 py-3.5 rounded-xl font-bold hover:scale-105 transition-all shadow-lg shadow-emerald-500/20"
            id="hero-launch-btn"
          >
            Launch Dashboard 🚀
          </Link>
          <a
            href="#features"
            className="inline-flex items-center justify-center bg-white/5 hover:bg-white/10 border border-white/10 text-white px-8 py-3.5 rounded-xl font-medium transition-all"
            id="hero-explore-btn"
          >
            Explore Features
          </a>
        </div>

        {/* CSS Dashboard Mockup */}
        <div className="w-full max-w-4xl rounded-2xl bg-neutral-900/60 border border-white/10 p-1.5 shadow-2xl backdrop-blur-xl mb-32 relative">
          <div className="bg-[#0d0d11] rounded-xl overflow-hidden border border-white/5">
            {/* Mockup Header */}
            <div className="h-12 bg-neutral-900/90 border-b border-white/5 flex items-center px-4 gap-2">
              <div className="w-3 h-3 rounded-full bg-[#ff5f56]" />
              <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
              <div className="w-3 h-3 rounded-full bg-[#27c93f]" />
              <div className="text-[10px] text-neutral-500 mx-auto tracking-widest font-mono">MONKEY GANG DASHBOARD v2.0</div>
            </div>

            {/* Mockup Body */}
            <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] h-[400px]">
              <div className="hidden md:flex flex-col gap-6 p-5 bg-[#0d0d11]/50 border-r border-white/5 text-left">
                <div className="flex items-center gap-2 font-bold text-sm text-white">🐒 Monkey Gang</div>
                <div className="space-y-2">
                  <div className="flex items-center gap-3 px-3 py-2 bg-white/5 rounded-lg">
                    <div className="w-3.5 h-3.5 rounded bg-emerald-500" />
                    <div className="w-16 h-2 bg-white/90 rounded" />
                  </div>
                  <div className="flex items-center gap-3 px-3 py-2">
                    <div className="w-3.5 h-3.5 rounded bg-neutral-600" />
                    <div className="w-16 h-2 bg-neutral-600 rounded" />
                  </div>
                  <div className="flex items-center gap-3 px-3 py-2">
                    <div className="w-3.5 h-3.5 rounded bg-neutral-600" />
                    <div className="w-16 h-2 bg-neutral-600 rounded" />
                  </div>
                </div>
              </div>
              <div className="p-8 flex flex-col gap-6 text-left">
                <div className="w-24 h-3 bg-neutral-600 rounded opacity-75" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-white/[0.02] border border-white/[0.04] rounded-xl flex flex-col gap-4">
                    <div className="flex justify-between items-center text-xs font-semibold text-neutral-300">
                      <span>Assigned Checklist</span>
                      <span className="text-[9px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-full">Admin Panel</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs p-2 border-b border-white/[0.02]">
                        <div className="flex items-center gap-2">
                          <div className="w-3.5 h-3.5 rounded border border-emerald-500 flex items-center justify-center"><div className="w-2 h-2 bg-emerald-500 rounded-sm" /></div>
                          <span className="text-neutral-200">Pack camping gear</span>
                        </div>
                        <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded">Common</span>
                      </div>
                      <div className="flex justify-between items-center text-xs p-2 border-b border-white/[0.02]">
                        <div className="flex items-center gap-2">
                          <div className="w-3.5 h-3.5 rounded border border-emerald-500 flex items-center justify-center"><div className="w-2 h-2 bg-emerald-500 rounded-sm" /></div>
                          <span className="text-neutral-200">Book rental vans</span>
                        </div>
                        <span className="text-[9px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded">Souvik</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-white/[0.02] border border-white/[0.04] rounded-xl flex flex-col gap-4">
                    <div className="flex justify-between items-center text-xs font-semibold text-neutral-300">
                      <span>My Expenses</span>
                      <span className="text-emerald-400">$450.00</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs p-2 border-b border-white/[0.02]">
                        <span className="text-neutral-300">Fuel Refill</span>
                        <span className="text-neutral-400">$120.00</span>
                      </div>
                      <div className="flex justify-between items-center text-xs p-2 border-b border-white/[0.02]">
                        <span className="text-neutral-300">Groceries</span>
                        <span className="text-neutral-400">$330.00</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Features List Section */}
        <section id="features" className="w-full text-left scroll-mt-24">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight text-white mb-2">Rebranded & Upgraded Features</h2>
            <p className="text-neutral-400">Engineered for security, permission levels, and clean collaboration.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-8 bg-neutral-900/40 border border-white/5 rounded-2xl backdrop-blur-md hover:translate-y-[-6px] hover:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/5 transition-all flex flex-col gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-2xl">🔒</div>
              <h3 className="text-lg font-bold text-white">Secure Credentials</h3>
              <p className="text-sm text-neutral-400 leading-relaxed">
                Every member gets a dedicated password alongside their custom username. Simple, direct authentication and custom onboarding setups ensure complete account ownership.
              </p>
            </div>

            <div className="p-8 bg-neutral-900/40 border border-white/5 rounded-2xl backdrop-blur-md hover:translate-y-[-6px] hover:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/5 transition-all flex flex-col gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-2xl">🛡️</div>
              <h3 className="text-lg font-bold text-white">Restricted Expense Controls</h3>
              <p className="text-sm text-neutral-400 leading-relaxed">
                Keep budget entries clean. Normal members only see their own expense logs, while group administrators see all global logs and hold exclusive deletion rights.
              </p>
            </div>

            <div className="p-8 bg-neutral-900/40 border border-white/5 rounded-2xl backdrop-blur-md hover:translate-y-[-6px] hover:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/5 transition-all flex flex-col gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-2xl">📋</div>
              <h3 className="text-lg font-bold text-white">Assignable Checklists</h3>
              <p className="text-sm text-neutral-400 leading-relaxed">
                Assign checklist tasks directly to specific travel members or mark them as "Common" tasks for everyone. Only administrators have checklist creation controls.
              </p>
            </div>

            <div className="p-8 bg-neutral-900/40 border border-white/5 rounded-2xl backdrop-blur-md hover:translate-y-[-6px] hover:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/5 transition-all flex flex-col gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-2xl">✍️</div>
              <h3 className="text-lg font-bold text-white">Full Admin Controls</h3>
              <p className="text-sm text-neutral-400 leading-relaxed">
                Administrators gain full interactive inline editing capability for all database records including users, password parameters, active trips, and budgets.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/5 bg-[#050507] py-12 text-center text-sm text-neutral-600">
        <p>© 2026 Monkey Gang. Designed for premium trip rosters. All rights reserved.</p>
      </footer>
    </div>
  );
}
