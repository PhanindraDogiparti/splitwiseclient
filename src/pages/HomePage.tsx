import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  CreditCard,
  Divide,
  Menu,
  Moon,
  Percent,
  PieChart,
  Receipt,
  Repeat,
  Scale,
  ShieldCheck,
  Sparkles,
  Sun,
  Users,
  Wallet,
  X,
  Zap,
} from "lucide-react";

const SPLIT_METHODS = [
  {
    id: "equal",
    title: "Equal Split",
    badge: "Most Popular",
    icon: Divide,
    example: "₹100.00 ÷ 3 friends → ₹33.34, ₹33.33, ₹33.33",
    description:
      "Divides bills evenly with deterministic paise rounding so shares always sum strictly to the exact bill.",
  },
  {
    id: "exact",
    title: "Exact Amounts",
    badge: "Itemized",
    icon: Receipt,
    example: "Phanindra ₹500 • Rohan ₹300 • Ananya ₹250",
    description:
      "Enter exact rupee and paise amounts per person with a live remaining-balance meter before saving.",
  },
  {
    id: "percentage",
    title: "By Percentage",
    badge: "Flexible",
    icon: Percent,
    example: "40% + 30% + 20% + 10% = 100.00%",
    description:
      "Assign custom percentage weights across roommates or travel partners with strict 100% validation.",
  },
  {
    id: "shares",
    title: "Shares & Adjustments",
    badge: "Pro Ratio",
    icon: Scale,
    example: "Couple (2 shares) + Solo (1 share) + ₹150 extra",
    description:
      "Split by household shares or ratios and apply +₹ / −₹ individual adjustments before proportional distribution.",
  },
];

const USE_CASES = [
  {
    title: "Weekend & Group Trips",
    subtitle: "Goa, Manali, or international holidays",
    description:
      "Log hotels, cabs, beach shacks, and flights in seconds—even when two people split paying the same bill.",
    accent: "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/70 dark:text-indigo-400",
    icon: Sparkles,
  },
  {
    title: "Flatmates & Roommates",
    subtitle: "Rent, Wi-Fi, electricity & groceries",
    description:
      "Automate monthly recurring bills with custom room-size ratios and never chase flatmates for utility splits.",
    accent: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/70 dark:text-emerald-400",
    icon: Repeat,
  },
  {
    title: "1-on-1 & Everyday Outings",
    subtitle: "Coffee runs, movies & shared cabs",
    description:
      "No need to create a group for every outing. Split directly with a friend and view your combined net balance.",
    accent: "bg-amber-50 text-amber-600 dark:bg-amber-950/70 dark:text-amber-400",
    icon: Users,
  },
];

export default function HomePage() {
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const saved = localStorage.getItem("splitmate_theme");
    if (saved) return saved === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [simplifyDebts, setSimplifyDebts] = useState(true);
  const [activeMethod, setActiveMethod] = useState(SPLIT_METHODS[0]);

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add("dark");
      localStorage.setItem("splitmate_theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("splitmate_theme", "light");
    }
  }, [darkMode]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors duration-200 dark:bg-zinc-950 dark:text-zinc-100">
      {/* =====================================================================
          1. RESPONSIVE STICKY NAVBAR
      ===================================================================== */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-950/85">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Brand Logo */}
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-600/30">
              <Wallet className="h-5 w-5" />
            </div>
            <span className="font-display text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Split<span className="text-indigo-600 dark:text-indigo-400">Mate</span>
            </span>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden items-center gap-8 md:flex">
            <a
              href="#how-it-works"
              className="text-sm font-medium text-slate-600 transition hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400"
            >
              How It Works
            </a>
            <a
              href="#split-methods"
              className="text-sm font-medium text-slate-600 transition hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400"
            >
              4 Split Modes
            </a>
            <a
              href="#features"
              className="text-sm font-medium text-slate-600 transition hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400"
            >
              Features
            </a>
            <a
              href="#use-cases"
              className="text-sm font-medium text-slate-600 transition hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400"
            >
              Use Cases
            </a>
          </nav>

          {/* Desktop Actions */}
          <div className="hidden items-center gap-3 md:flex">
            <button
              onClick={() => setDarkMode(!darkMode)}
              aria-label="Toggle theme"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer"
            >
              {darkMode ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}
            </button>

            <Link
              to="/login"
              className="rounded-xl px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Log in
            </Link>
            <Link
              to="/register"
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-indigo-600/25 transition hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600"
            >
              Get Started Free
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {/* Mobile Controls */}
          <div className="flex items-center gap-2 md:hidden">
            <button
              onClick={() => setDarkMode(!darkMode)}
              aria-label="Toggle theme"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
            >
              {darkMode ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Open menu"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Drawer */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-t border-slate-200 bg-white px-4 py-4 md:hidden dark:border-zinc-800 dark:bg-zinc-950"
            >
              <div className="flex flex-col space-y-3">
                <a
                  href="#how-it-works"
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
                >
                  How It Works
                </a>
                <a
                  href="#split-methods"
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
                >
                  4 Split Modes
                </a>
                <a
                  href="#features"
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
                >
                  Features
                </a>
                <a
                  href="#use-cases"
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
                >
                  Use Cases
                </a>
                <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-slate-100 dark:border-zinc-800">
                  <Link
                    to="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-center rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-700 dark:border-zinc-800 dark:text-zinc-200"
                  >
                    Log in
                  </Link>
                  <Link
                    to="/register"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-center rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white"
                  >
                    Sign up Free
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* =====================================================================
          2. HERO SECTION + INTERACTIVE ₹8,000 TRIP SIMULATOR
      ===================================================================== */}
      <section className="relative overflow-hidden pt-10 pb-16 sm:pt-16 sm:pb-24 lg:pt-20 lg:pb-28">
        {/* Subtle Background Glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 -top-40 -z-10 flex justify-center overflow-hidden blur-3xl"
        >
          <div className="h-80 w-[44rem] rounded-full bg-gradient-to-tr from-indigo-500/15 via-violet-500/10 to-emerald-400/15 dark:from-indigo-500/20 dark:to-emerald-500/10" />
        </div>

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-10">
            {/* Left Column: Value Proposition */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
              className="lg:col-span-6 text-center lg:text-left"
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200/80 bg-indigo-50/80 px-3.5 py-1.5 text-xs font-semibold text-indigo-700 dark:border-indigo-800/60 dark:bg-indigo-950/60 dark:text-indigo-300">
                <Zap className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                Zero daily expense limits • No artificial paywalls
              </div>

              <h1 className="mt-5 font-display text-3xl font-extrabold tracking-tight text-slate-900 sm:text-5xl lg:text-[3.25rem] lg:leading-[1.12] dark:text-white">
                Split group bills & shared expenses{" "}
                <span className="text-indigo-600 dark:text-indigo-400">
                  without the math.
                </span>
              </h1>

              <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg lg:mx-0 dark:text-zinc-400">
                Track trips, roommate rent, and 1-on-1 outings effortlessly. SplitMate supports{" "}
                <strong className="font-semibold text-slate-800 dark:text-zinc-200">
                  multi-payer bills
                </strong>
                ,{" "}
                <strong className="font-semibold text-slate-800 dark:text-zinc-200">
                  4 precision split modes
                </strong>
                , and one-tap debt simplification so everyone settles up in fewer transfers.
              </p>

              {/* CTA Buttons */}
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start">
                <Link
                  to="/register"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3.5 text-sm font-semibold text-white shadow-md shadow-indigo-600/25 transition hover:bg-indigo-700 sm:w-auto dark:bg-indigo-500 dark:hover:bg-indigo-600"
                >
                  Start Splitting for Free
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/group"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 sm:w-auto dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  Explore Live Groups
                </Link>
              </div>

              {/* Trust Micro-Badges */}
              <div className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-medium text-slate-500 lg:justify-start dark:text-zinc-400">
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  Paise-accurate Decimal math
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  UPI ID & manual settlements
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  Multi-currency ready
                </span>
              </div>
            </motion.div>

            {/* Right Column: Interactive Live Product Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="lg:col-span-6"
            >
              <div className="rounded-3xl border border-slate-200/90 bg-white p-5 shadow-xl shadow-slate-900/5 sm:p-6 dark:border-zinc-800 dark:bg-zinc-900/95 dark:shadow-black/40">
                {/* Card Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-zinc-800">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                        Live Example • Goa Trip
                      </span>
                    </div>
                    <h2 className="mt-1 font-display text-lg font-bold text-slate-900 dark:text-white">
                      4 Friends • ₹8,000.00 Total Spend
                    </h2>
                  </div>

                  {/* Interactive Simplify Debts Toggle */}
                  <button
                    type="button"
                    onClick={() => setSimplifyDebts(!simplifyDebts)}
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                      simplifyDebts
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/60 dark:text-emerald-400"
                        : "border-slate-200 bg-slate-100 text-slate-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                    }`}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Simplify Debts: {simplifyDebts ? "ON" : "OFF"}
                  </button>
                </div>

                {/* Member Paid vs Fair Share Grid */}
                <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  {[
                    { name: "Person A", paid: "₹4,000", net: "+₹2,000.00", pos: true },
                    { name: "Person B", paid: "₹2,000", net: "₹0.00", neutral: true },
                    { name: "Person C", paid: "₹1,000", net: "−₹1,000.00", pos: false },
                    { name: "Person D", paid: "₹1,000", net: "−₹1,000.00", pos: false },
                  ].map((person) => (
                    <div
                      key={person.name}
                      className="rounded-2xl border border-slate-100 bg-slate-50/80 p-3 dark:border-zinc-800 dark:bg-zinc-950/60"
                    >
                      <p className="text-xs font-medium text-slate-500 dark:text-zinc-400">
                        {person.name}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-600 tabular-nums dark:text-zinc-300">
                        Paid {person.paid}
                      </p>
                      <p
                        className={`mt-1.5 text-sm font-bold tabular-nums ${
                          person.neutral
                            ? "text-slate-500 dark:text-zinc-400"
                            : person.pos
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-rose-600 dark:text-rose-400"
                        }`}
                      >
                        {person.net}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Suggested Settlements Box */}
                <div className="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 dark:border-indigo-900/40 dark:bg-indigo-950/25">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-zinc-300">
                      {simplifyDebts
                        ? "Simplified Settlements (2 Transfers)"
                        : "Raw Pairwise Debts (5 Transfers)"}
                    </span>
                    <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
                      Equal share: ₹2,000 each
                    </span>
                  </div>

                  <div className="mt-3 space-y-2">
                    {simplifyDebts ? (
                      <>
                        <div className="flex items-center justify-between rounded-xl bg-white px-3.5 py-2.5 text-sm shadow-2xs dark:bg-zinc-900">
                          <span className="font-medium text-slate-700 dark:text-zinc-200">
                            Person C <span className="text-slate-400">pays</span> Person A
                          </span>
                          <span className="font-bold text-emerald-600 tabular-nums dark:text-emerald-400">
                            ₹1,000.00
                          </span>
                        </div>
                        <div className="flex items-center justify-between rounded-xl bg-white px-3.5 py-2.5 text-sm shadow-2xs dark:bg-zinc-900">
                          <span className="font-medium text-slate-700 dark:text-zinc-200">
                            Person D <span className="text-slate-400">pays</span> Person A
                          </span>
                          <span className="font-bold text-emerald-600 tabular-nums dark:text-emerald-400">
                            ₹1,000.00
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="space-y-1.5 text-xs text-slate-600 dark:text-zinc-300">
                        <div className="flex justify-between rounded-lg bg-white/90 px-3 py-2 dark:bg-zinc-900">
                          <span>Person B → Person A (Hotel)</span>
                          <span className="font-semibold tabular-nums">₹500.00</span>
                        </div>
                        <div className="flex justify-between rounded-lg bg-white/90 px-3 py-2 dark:bg-zinc-900">
                          <span>Person C → Person A (Hotel)</span>
                          <span className="font-semibold tabular-nums">₹750.00</span>
                        </div>
                        <div className="flex justify-between rounded-lg bg-white/90 px-3 py-2 dark:bg-zinc-900">
                          <span>Person D → Person A (Hotel)</span>
                          <span className="font-semibold tabular-nums">₹750.00</span>
                        </div>
                        <div className="flex justify-between rounded-lg bg-white/90 px-3 py-2 dark:bg-zinc-900">
                          <span>Person C & D → Person B (Food)</span>
                          <span className="font-semibold tabular-nums">₹500.00 each</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          3. HOW IT WORKS (3-STEP WORKFLOW)
      ===================================================================== */}
      <section
        id="how-it-works"
        className="border-y border-slate-200/80 bg-white py-16 sm:py-24 dark:border-zinc-800/80 dark:bg-zinc-900/40"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
              Effortless Workflow
            </span>
            <h2 className="mt-2 font-display text-2xl font-extrabold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
              From messy group receipts to settled up in three steps
            </h2>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
            {[
              {
                step: "01",
                title: "Create a Group or Pick a Friend",
                desc: "Start a Trip, Roommate, or Friends group—or invite friends with a secure one-click link. You can also split 1-on-1 outside any group.",
              },
              {
                step: "02",
                title: "Log Bills with Quick-Entry Split",
                desc: "Type who paid (even multiple payers on one receipt) and split equally, by exact rupee amounts, percentages, or shares.",
              },
              {
                step: "03",
                title: "Simplify Debts & Settle via UPI",
                desc: "SplitMate calculates minimum transactions automatically. Copy your friend's saved UPI ID, pay, and record confirmation in one tap.",
              },
            ].map((item) => (
              <div
                key={item.step}
                className="relative rounded-2xl border border-slate-200/80 bg-slate-50/60 p-6 transition hover:border-indigo-200 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 font-display text-sm font-bold text-white">
                  {item.step}
                </span>
                <h3 className="mt-4 font-display text-lg font-bold text-slate-900 dark:text-white">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-zinc-400">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =====================================================================
          4. INTERACTIVE 4 EXPENSE-SPLITTING METHODS SHOWCASE
      ===================================================================== */}
      <section id="split-methods" className="py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
              Precision Math Engine
            </span>
            <h2 className="mt-2 font-display text-2xl font-extrabold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
              Four ways to split every bill fairly
            </h2>
            <p className="mt-3 text-sm text-slate-600 sm:text-base dark:text-zinc-400">
              Built with strict decimal arithmetic so uneven splits like ₹100 ÷ 3 never lose or invent a single paisa.
            </p>
          </div>

          {/* Interactive Method Selector Tabs */}
          <div className="mt-10 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {SPLIT_METHODS.map((method) => {
              const Icon = method.icon;
              const isSelected = activeMethod.id === method.id;
              return (
                <button
                  key={method.id}
                  onClick={() => setActiveMethod(method)}
                  className={`flex flex-col items-start rounded-2xl border p-4 text-left transition cursor-pointer ${
                    isSelected
                      ? "border-indigo-600 bg-indigo-600 text-white shadow-md shadow-indigo-600/20 dark:border-indigo-500 dark:bg-indigo-500"
                      : "border-slate-200 bg-white text-slate-800 hover:border-indigo-200 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
                  }`}
                >
                  <Icon
                    className={`h-5 w-5 ${
                      isSelected ? "text-white" : "text-indigo-600 dark:text-indigo-400"
                    }`}
                  />
                  <span className="mt-3 font-display text-sm font-bold">{method.title}</span>
                  <span
                    className={`mt-0.5 text-xs ${
                      isSelected ? "text-indigo-100" : "text-slate-500 dark:text-zinc-400"
                    }`}
                  >
                    {method.badge}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Active Method Detail Card */}
          <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
              <div className="max-w-xl">
                <span className="inline-block rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                  {activeMethod.badge}
                </span>
                <h3 className="mt-3 font-display text-xl font-bold text-slate-900 sm:text-2xl dark:text-white">
                  {activeMethod.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 sm:text-base dark:text-zinc-400">
                  {activeMethod.description}
                </p>
              </div>
              <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/70 px-5 py-4 dark:border-emerald-800/50 dark:bg-emerald-950/40">
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  Live Calculation Example
                </p>
                <p className="mt-1.5 font-mono text-sm font-semibold text-slate-900 tabular-nums sm:text-base dark:text-white">
                  {activeMethod.example}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          5. COMPLETE PLATFORM CAPABILITIES GRID
      ===================================================================== */}
      <section
        id="features"
        className="border-t border-slate-200/80 bg-white py-16 sm:py-24 dark:border-zinc-800/80 dark:bg-zinc-900/40"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
              Everything Included
            </span>
            <h2 className="mt-2 font-display text-2xl font-extrabold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
              Built for real-world shared finances
            </h2>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: CreditCard,
                title: "Multiple Payers on One Bill",
                desc: "Did two friends split paying for dinner? Record exact contributions for every payer on a single expense.",
              },
              {
                icon: Repeat,
                title: "Automated Recurring Bills",
                desc: "Schedule monthly rent, Wi-Fi, electricity, or OTT subscriptions to auto-generate without duplicates.",
              },
              {
                icon: PieChart,
                title: "Category & Monthly Analytics",
                desc: "Visualize your personal contribution vs. fair share across Food, Travel, Hotel, Rent, and Utilities.",
              },
              {
                icon: Receipt,
                title: "Receipt Attachments & Comments",
                desc: "Upload bill photos securely and discuss line items directly inside each expense thread.",
              },
              {
                icon: Wallet,
                title: "UPI-Ready Settlements",
                desc: "Save your UPI ID in your profile so friends can copy it with one click when settling up.",
              },
              {
                icon: ShieldCheck,
                title: "Immutable Audit & Privacy",
                desc: "Role-based group permissions, soft-delete history, and strict authorization on every receipt and balance.",
              },
            ].map((feat) => {
              const Icon = feat.icon;
              return (
                <div
                  key={feat.title}
                  className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-6 transition hover:bg-white hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/90 dark:hover:bg-zinc-900"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 font-display text-base font-bold text-slate-900 dark:text-white">
                    {feat.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-zinc-400">
                    {feat.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* =====================================================================
          6. USE CASES (TRIPS, ROOMMATES, FRIENDS)
      ===================================================================== */}
      <section id="use-cases" className="py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
              Made For Every Group
            </span>
            <h2 className="mt-2 font-display text-2xl font-extrabold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
              One clean workspace for every shared expense
            </h2>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
            {USE_CASES.map((uc) => {
              const Icon = uc.icon;
              return (
                <div
                  key={uc.title}
                  className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div>
                    <div className={`inline-flex rounded-xl p-3 ${uc.accent}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-4 font-display text-lg font-bold text-slate-900 dark:text-white">
                      {uc.title}
                    </h3>
                    <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
                      {uc.subtitle}
                    </p>
                    <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-zinc-400">
                      {uc.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* =====================================================================
          7. FINAL CTA BANNER
      ===================================================================== */}
      <section className="px-4 pb-16 sm:px-6 sm:pb-24 lg:px-8">
        <div className="mx-auto max-w-5xl overflow-hidden rounded-3xl bg-indigo-600 px-6 py-12 text-center text-white shadow-xl shadow-indigo-600/20 sm:px-12 sm:py-16 dark:bg-indigo-600">
          <h2 className="font-display text-2xl font-extrabold tracking-tight sm:text-4xl">
            Ready to stop doing spreadsheet math after every trip?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-indigo-100 sm:text-base">
            Create your free SplitMate account in 30 seconds. Add unlimited expenses, invite unlimited friends, and settle up stress-free.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to="/register"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-6 py-3.5 text-sm font-bold text-indigo-700 transition hover:bg-indigo-50 sm:w-auto"
            >
              Create Free Account
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/login"
              className="inline-flex w-full items-center justify-center rounded-xl border border-indigo-400/60 bg-indigo-700/40 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-indigo-700/70 sm:w-auto"
            >
              Sign In to Existing Account
            </Link>
          </div>
        </div>
      </section>

      {/* =====================================================================
          8. RESPONSIVE FOOTER
      ===================================================================== */}
      <footer className="border-t border-slate-200/80 bg-white py-10 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 text-sm text-slate-500 sm:flex-row sm:px-6 lg:px-8 dark:text-zinc-400">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white">
              <Wallet className="h-4 w-4" />
            </div>
            <span className="font-display font-bold text-slate-900 dark:text-white">
              SplitMate
            </span>
            <span>• Smart Expense Splitting</span>
          </div>
          <p className="text-xs">
            © {new Date().getFullYear()} SplitMate. Built for transparent shared finances.
          </p>
        </div>
      </footer>
    </div>
  );
}