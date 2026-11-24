import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  KeyRound,
  Loader2,
  Mail,
  Menu,
  Moon,
  RefreshCw,
  ShieldCheck,
  Sun,
  Wallet,
  X,
} from "lucide-react";

const API_BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");

export default function ForgotPasswordPage() {
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

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [step, setStep] = useState<"email" | "otp" | "reset">("email");
  const [email, setEmail] = useState("");
  const [otpDigits, setOtpDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setTimeout(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [resendCooldown]);

  const otp = otpDigits.join("");

  function handleDigitChange(index: number, rawValue: string) {
    const digit = rawValue.replace(/\D/g, "").slice(-1);
    setOtpDigits((prev) => {
      const next = [...prev];
      next[index] = digit;
      return next;
    });
  }

  async function requestOtpForEmail(targetEmail: string) {
    setErrorMessage(null);
    setInfoMessage(null);
    setIsLoading(true);

    const normalizedEmail = targetEmail.trim().toLowerCase();
    if (!normalizedEmail) {
      setErrorMessage("Please enter your email address.");
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/request-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: normalizedEmail,
          purpose: "reset-password",
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        setOtpSent(true);
        setStep("otp");
        setResendCooldown(30);
        setInfoMessage(`6-digit OTP sent to ${normalizedEmail}. Check your inbox.`);
      } else {
        setErrorMessage(data.message || "Failed to send OTP. Please try again.");
      }
    } catch {
      setErrorMessage("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  async function sendResetOtp(e: React.FormEvent) {
    e.preventDefault();
    await requestOtpForEmail(email);
  }

  async function verifyOtpAndReset(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);

    if (otp.length !== 6 || !newPassword.trim() || !confirmPassword.trim()) {
      setErrorMessage("Please enter the 6-digit OTP and both password fields.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    if (newPassword.length < 8) {
      setErrorMessage("Password must be at least 8 characters.");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          otp,
          purpose: "reset-password",
          password: newPassword,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        setStep("reset");
        setInfoMessage(
          "Password reset successful! You can now log in with your new password."
        );
        setTimeout(() => {
          navigate("/login");
        }, 2000);
      } else {
        setErrorMessage(data.message || "Failed to verify OTP. Please try again.");
      }
    } catch {
      setErrorMessage("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleResendOtp() {
    if (resendCooldown > 0 || isLoading) return;
    setOtpDigits(["", "", "", "", "", ""]);
    await requestOtpForEmail(email);
  }

  const steps = [
    { key: "email", label: "1. Email" },
    { key: "otp", label: "2. OTP & Reset" },
    { key: "reset", label: "3. Done" },
  ] as const;

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 transition-colors duration-200 dark:bg-zinc-950 dark:text-zinc-100">
      {/* =====================================================================
          1. RESPONSIVE STICKY NAVBAR (BACK + BRAND + THEME + SIGN UP)
      ===================================================================== */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-950/85">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">

            <Link to="/" className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-600/30">
                <Wallet className="h-5 w-5" />
              </div>
              <span className="font-display text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                Split<span className="text-indigo-600 dark:text-indigo-400">Mate</span>
              </span>
            </Link>
          </div>

          {/* Desktop Actions */}
          <div className="hidden items-center gap-3 md:flex">
            <button
              type="button"
              onClick={() => setDarkMode(!darkMode)}
              aria-label="Toggle theme"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer"
            >
              {darkMode ? (
                <Sun className="h-4 w-4 text-amber-400" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
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
              Sign up
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {/* Mobile Controls */}
          <div className="flex items-center gap-2 md:hidden">
            <button
              type="button"
              onClick={() => setDarkMode(!darkMode)}
              aria-label="Toggle theme"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
            >
              {darkMode ? (
                <Sun className="h-4 w-4 text-amber-400" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>
            <button
              type="button"
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
              <div className="grid grid-cols-2 gap-2.5">
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
                  Sign up
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* =====================================================================
          2. CENTERED RECOVERY CARD WITH AMBIENT GLOW
      ===================================================================== */}
      <main className="relative flex flex-1 flex-col justify-center overflow-hidden px-4 py-12 sm:px-6 lg:px-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 -top-24 -z-10 flex justify-center overflow-hidden blur-3xl"
        >
          <div className="h-72 w-[38rem] rounded-full bg-gradient-to-tr from-indigo-500/15 via-violet-500/10 to-emerald-400/15 dark:from-indigo-500/20 dark:to-emerald-500/10" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mx-auto w-full max-w-md"
        >
          {/* Step Progress Pills */}
          <div className="mb-5 grid grid-cols-3 gap-2 rounded-2xl border border-slate-200/80 bg-white p-1.5 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900">
            {steps.map((s) => {
              const active = step === s.key;
              return (
                <div
                  key={s.key}
                  className={`rounded-xl py-1.5 text-center text-xs font-semibold transition ${
                    active
                      ? "bg-indigo-600 text-white shadow-2xs"
                      : "text-slate-500 dark:text-zinc-400"
                  }`}
                >
                  {s.label}
                </div>
              );
            })}
          </div>

          {step === "email" && (
            <form
              onSubmit={sendResetOtp}
              className="space-y-4 rounded-3xl border border-slate-200/90 bg-white p-6 shadow-xl shadow-slate-900/5 sm:p-7 dark:border-zinc-800 dark:bg-zinc-900/95 dark:shadow-black/40"
            >
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200/80 bg-indigo-50/80 px-3 py-1 text-[11px] font-semibold text-indigo-700 dark:border-indigo-800/60 dark:bg-indigo-950/60 dark:text-indigo-300">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Account Recovery
                </span>
                <h1 className="mt-3 font-display text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
                  Forgot your password?
                </h1>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-zinc-400">
                  Enter your email address and we&apos;ll send a 6-digit one-time code to reset it.
                </p>
              </div>

              <div className="relative">
                <Mail className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading || otpSent}
                  required
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/80 pr-3.5 pl-10 text-sm outline-none transition focus:border-indigo-500 focus:bg-white dark:border-zinc-800 dark:bg-zinc-950"
                />
              </div>

              {errorMessage && (
                <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white shadow-md shadow-indigo-600/25 transition hover:bg-indigo-700 disabled:opacity-60 dark:bg-indigo-500 dark:hover:bg-indigo-600 cursor-pointer"
              >
                {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                <span>{isLoading ? "Sending OTP..." : "Send Reset OTP"}</span>
                {!isLoading && <ArrowRight className="h-4 w-4" />}
              </button>

              <p className="pt-1 text-center text-xs text-slate-500 dark:text-zinc-400">
                Remembered your password?{" "}
                <Link
                  to="/login"
                  className="font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  Log in
                </Link>
              </p>
            </form>
          )}

          {step === "otp" && (
            <form
              onSubmit={verifyOtpAndReset}
              className="space-y-4 rounded-3xl border border-slate-200/90 bg-white p-6 shadow-xl shadow-slate-900/5 sm:p-7 dark:border-zinc-800 dark:bg-zinc-900/95 dark:shadow-black/40"
            >
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200/80 bg-indigo-50/80 px-3 py-1 text-[11px] font-semibold text-indigo-700 dark:border-indigo-800/60 dark:bg-indigo-950/60 dark:text-indigo-300">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Verify Code
                </span>
                <h1 className="mt-3 font-display text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                  Enter OTP &amp; new password
                </h1>
                <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-zinc-400">
                  Code sent to <strong className="text-slate-700 dark:text-zinc-200">{email}</strong>.
                </p>
              </div>

              {infoMessage && (
                <div className="rounded-xl border border-indigo-200 bg-indigo-50/80 px-3.5 py-2.5 text-xs font-medium text-indigo-700 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-300">
                  {infoMessage}
                </div>
              )}

              <div className="grid grid-cols-6 gap-2">
                {otpDigits.map((digit, idx) => (
                  <input
                    key={idx}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    aria-label={`OTP digit ${idx + 1}`}
                    value={digit}
                    onChange={(e) => handleDigitChange(idx, e.target.value)}
                    className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/80 text-center font-display text-lg font-bold outline-none transition focus:border-indigo-500 focus:bg-white dark:border-zinc-800 dark:bg-zinc-950"
                  />
                ))}
              </div>

              <div className="space-y-3">
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    placeholder="New password (min 8 characters)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/80 pr-3.5 pl-10 text-sm outline-none transition focus:border-indigo-500 focus:bg-white dark:border-zinc-800 dark:bg-zinc-950"
                  />
                </div>

                <div className="relative">
                  <KeyRound className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/80 pr-3.5 pl-10 text-sm outline-none transition focus:border-indigo-500 focus:bg-white dark:border-zinc-800 dark:bg-zinc-950"
                  />
                </div>
              </div>

              {errorMessage && (
                <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white shadow-md shadow-indigo-600/25 transition hover:bg-indigo-700 disabled:opacity-60 dark:bg-indigo-500 dark:hover:bg-indigo-600 cursor-pointer"
              >
                {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                <span>{isLoading ? "Resetting Password..." : "Reset Password"}</span>
              </button>

              <div className="flex items-center justify-between pt-1 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setOtpSent(false);
                    setStep("email");
                    setErrorMessage(null);
                  }}
                  className="font-medium text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200 cursor-pointer"
                >
                  Change email
                </button>

                <button
                  type="button"
                  onClick={() => void handleResendOtp()}
                  disabled={isLoading || resendCooldown > 0}
                  className="inline-flex items-center gap-1.5 font-semibold text-indigo-600 disabled:opacity-50 dark:text-indigo-400 cursor-pointer"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend OTP"}
                  </span>
                </button>
              </div>
            </form>
          )}

          {step === "reset" && (
            <div className="space-y-4 rounded-3xl border border-emerald-200/90 bg-white p-6 text-center shadow-xl shadow-slate-900/5 sm:p-7 dark:border-emerald-900/60 dark:bg-zinc-900">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/70 dark:text-emerald-400">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h1 className="font-display text-2xl font-extrabold text-slate-900 dark:text-white">
                Password Reset Successful
              </h1>
              <p className="text-sm text-slate-600 dark:text-zinc-400">
                {infoMessage || "Your password has been updated. Redirecting to login..."}
              </p>
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white shadow-md shadow-indigo-600/25 transition hover:bg-indigo-700 cursor-pointer"
              >
                <span>Go to Login</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </motion.div>
      </main>

      {/* =====================================================================
          3. RESPONSIVE FOOTER
      ===================================================================== */}
      <footer className="border-t border-slate-200/80 bg-white py-8 dark:border-zinc-800 dark:bg-zinc-950">
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