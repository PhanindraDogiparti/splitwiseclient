import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Moon,
  ShieldCheck,
  Sparkles,
  Sun,
  Wallet,
} from "lucide-react";

const API_BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");

export default function LoginPage() {
  const navigate = useNavigate();

  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const saved = localStorage.getItem("splitmate_theme");
    if (saved) return saved === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

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

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);

    if (!email.trim() || !password) {
      setErrorMessage("Please enter both your email address and password.");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        setErrorMessage(
          data?.message || data?.error?.message || "Invalid email or password."
        );
        return;
      }

      const authData = data.data || data;
      localStorage.removeItem("splitmate_demo");
      localStorage.setItem("splitmate_authenticated", "true");
      if (authData.user) {
        localStorage.setItem("splitmate_user", JSON.stringify(authData.user));
      }
      if (authData.token) {
        localStorage.setItem("splitmate_token", authData.token);
      }
      navigate("/group");
    } catch {
      setErrorMessage(
        "Cannot reach the backend server right now. Start the server or click 'Skip login & preview Live Groups Demo' below."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoAccess = () => {
    localStorage.setItem("splitmate_demo", "true");
    localStorage.removeItem("splitmate_authenticated");
    navigate("/group");
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors duration-200 dark:bg-zinc-950 dark:text-zinc-100">
      {/* Top Minimal Header */}
      <header className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Home</span>
        </Link>

        <button
          type="button"
          onClick={() => setDarkMode(!darkMode)}
          aria-label="Toggle color theme"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer"
        >
          {darkMode ? (
            <Sun className="h-4 w-4 text-amber-400" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </button>
      </header>

      {/* Main Responsive Container */}
      <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid w-full grid-cols-1 overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-xl shadow-slate-900/5 lg:grid-cols-12 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-black/40">
          {/* Left Panel: Branding & Trust Showcase */}
          <div className="hidden flex-col justify-between bg-gradient-to-br from-indigo-600 via-indigo-600 to-violet-700 p-10 text-white lg:col-span-5 lg:flex">
            <div>
              <Link to="/" className="inline-flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur-xs">
                  <Wallet className="h-5 w-5 text-white" />
                </div>
                <span className="font-display text-2xl font-extrabold tracking-tight">
                  SplitMate
                </span>
              </Link>

              <h2 className="mt-10 font-display text-3xl font-extrabold leading-tight">
                Welcome back to stress-free bill splitting.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-indigo-100">
                Track shared trip expenses, split roommate utilities, and settle balances with friends in fewer transfers.
              </p>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
                <div className="flex items-center justify-between text-xs text-indigo-100">
                  <span>Goa Weekend Trip</span>
                  <span className="rounded-full bg-emerald-400/20 px-2.5 py-0.5 font-semibold text-emerald-200">
                    Settled smartly
                  </span>
                </div>
                <div className="mt-3 flex items-baseline justify-between">
                  <div>
                    <p className="text-xs text-indigo-200">Your net balance</p>
                    <p className="font-display text-2xl font-extrabold text-white tabular-nums">
                      +₹2,000.00
                    </p>
                  </div>
                  <span className="text-xs text-indigo-100">2 friends owe you</span>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-indigo-100">
                <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-300" />
                <span>Protected with encrypted sessions &amp; strict privacy controls</span>
              </div>
            </div>
          </div>

          {/* Right Panel: Email & Password Login Form */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="p-6 sm:p-10 lg:col-span-7 lg:p-12"
          >
            {/* Mobile Brand Header */}
            <div className="mb-6 flex items-center gap-2.5 lg:hidden">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white">
                <Wallet className="h-5 w-5" />
              </div>
              <span className="font-display text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                Split<span className="text-indigo-600 dark:text-indigo-400">Mate</span>
              </span>
            </div>

            <div>
              <h1 className="font-display text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
                Sign in to your account
              </h1>
              <p className="mt-1.5 text-sm text-slate-500 dark:text-zinc-400">
                Don&apos;t have an account yet?{" "}
                <Link
                  to="/register"
                  className="font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                >
                  Create one free
                </Link>
              </p>
            </div>

            {errorMessage && (
              <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/50 dark:text-rose-300">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                <span>{errorMessage}</span>
              </div>
            )}

            {infoMessage && (
              <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-3 text-xs text-indigo-700 dark:border-indigo-900/60 dark:bg-indigo-950/50 dark:text-indigo-300">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />
                <span>{infoMessage}</span>
              </div>
            )}

            <form onSubmit={handleEmailLogin} className="mt-6 space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="block text-xs font-semibold text-slate-700 dark:text-zinc-300"
                >
                  Email Address
                </label>
                <div className="relative mt-1.5">
                  <Mail className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white pr-3.5 pl-10 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="password"
                    className="block text-xs font-semibold text-slate-700 dark:text-zinc-300"
                  >
                    Password
                  </label>
                  <Link
                    to="/forgot-password"
                    className="text-xs font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative mt-1.5">
                  <Lock className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white pr-11 pl-10 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute top-1/2 right-3 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 cursor-pointer"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-0.5">
                <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-zinc-400 cursor-pointer">
                  <input
                    type="checkbox"
                    defaultChecked
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900"
                  />
                  Keep me signed in for 30 days
                </label>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white shadow-md shadow-indigo-600/20 transition hover:bg-indigo-700 disabled:opacity-60 dark:bg-indigo-500 dark:hover:bg-indigo-600 cursor-pointer"
              >
                {isLoading ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <>
                    Sign In
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            {/* Instant UI Preview / Demo Mode Footer */}
            <div className="mt-6 border-t border-slate-100 pt-5 dark:border-zinc-800">
              <button
                type="button"
                onClick={handleDemoAccess}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200/80 bg-emerald-50/70 px-4 py-2.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100/80 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-950/70 cursor-pointer"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Skip login &amp; preview Live Groups Demo
              </button>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}