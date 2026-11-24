import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  Globe,
  Lock,
  Mail,
  Moon,
  RefreshCw,
  ShieldCheck,
  Sun,
  User,
  Wallet,
} from "lucide-react";

const API_BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");

const CURRENCIES = [
  { code: "INR", label: "INR (₹) — Indian Rupee" },
  { code: "USD", label: "USD ($) — US Dollar" },
  { code: "EUR", label: "EUR (€) — Euro" },
  { code: "GBP", label: "GBP (£) — British Pound" },
  { code: "AED", label: "AED — UAE Dirham" },
  { code: "SGD", label: "SGD (S$) — Singapore Dollar" },
];

export default function RegisterPage() {
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

  const [step, setStep] = useState<"details" | "verify-otp">("details");

  // Step 1 fields
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Step 2 OTP boxes
  const [otpDigits, setOtpDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);
  const [resendTimer, setResendTimer] = useState(30);
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const passwordChecks = useMemo(
    () => ({
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      number: /[0-9]/.test(password),
    }),
    [password]
  );

  const isPasswordStrong =
    passwordChecks.length && passwordChecks.uppercase && passwordChecks.number;

  useEffect(() => {
    if (step !== "verify-otp" || resendTimer <= 0) return;
    const interval = setInterval(() => {
      setResendTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [step, resendTimer]);

  // Step 1: Send registration details & request Email OTP from backend (port 5001)
  const handleSendEmailOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);
    setDevOtpHint(null);

    if (fullName.trim().length < 2) {
      setErrorMessage("Please enter your full name (at least 2 characters).");
      return;
    }
    if (!email.includes("@")) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }
    if (!isPasswordStrong) {
      setErrorMessage(
        "Password must be at least 8 characters with 1 uppercase letter and 1 number."
      );
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    try {
      const cleanEmail = email.trim().toLowerCase();
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/request-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: cleanEmail,
          purpose: "register",
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMessage(data.message || "Could not send verification OTP.");
        return;
      }

      if (data.devOtp) {
        setDevOtpHint(String(data.devOtp));
      }

      setStep("verify-otp");
      setOtpDigits(["", "", "", "", "", ""]);
      setResendTimer(30);
      setInfoMessage(
        data.message || `We sent a 6-digit verification code to ${cleanEmail}`
      );
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch {
      setErrorMessage(
        `Cannot reach the backend API${API_BASE_URL ? ` at ${API_BASE_URL}` : ""}. Check that the server is running and the /api proxy is configured.`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    const clean = value.replace(/\D/g, "");
    if (!clean) {
      const updated = [...otpDigits];
      updated[index] = "";
      setOtpDigits(updated);
      return;
    }

    if (clean.length > 1) {
      const chars = clean.slice(0, 6).split("");
      const updated = ["", "", "", "", "", ""];
      chars.forEach((ch, idx) => {
        updated[idx] = ch;
      });
      setOtpDigits(updated);
      otpRefs.current[Math.min(chars.length, 5)]?.focus();
      return;
    }

    const updated = [...otpDigits];
    updated[index] = clean;
    setOtpDigits(updated);

    if (index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);
    if (!pasted) return;
    const updated = ["", "", "", "", "", ""];
    pasted.split("").forEach((ch, idx) => {
      updated[idx] = ch;
    });
    setOtpDigits(updated);
    otpRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  // Step 2: Verify OTP & create/persist user in backend (port 5001)
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const code = otpDigits.join("");
    if (code.length !== 6) {
      setErrorMessage("Please enter all 6 digits of your email verification code.");
      return;
    }

    setIsLoading(true);
    try {
      const cleanEmail = email.trim().toLowerCase();
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fullName.trim(),
          email: cleanEmail,
          password,
          purpose: "register",
          otp: code,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMessage(data.message || "Invalid or expired verification code.");
        return;
      }

      const authData = data.data || data;
      if (authData.token) {
        localStorage.setItem("splitmate_token", authData.token);
      }
      localStorage.setItem(
        "splitmate_user",
        JSON.stringify(
          authData.user || {
            name: fullName.trim(),
            email: cleanEmail,
            defaultCurrency: currency,
          }
        )
      );

      navigate("/group");
    } catch {
      setErrorMessage(
        `Failed to verify OTP${API_BASE_URL ? ` with ${API_BASE_URL}` : ""}. Check that the backend server is running.`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (resendTimer > 0) return;
    setErrorMessage(null);
    setInfoMessage(null);
    setIsLoading(true);
    try {
      const cleanEmail = email.trim().toLowerCase();
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/request-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: cleanEmail,
          purpose: "register",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMessage(data.message || "Could not resend OTP.");
        return;
      }
      if (data.devOtp) setDevOtpHint(String(data.devOtp));
      setOtpDigits(["", "", "", "", "", ""]);
      setResendTimer(30);
      setInfoMessage(`A fresh 6-digit code has been sent to ${cleanEmail}`);
      otpRefs.current[0]?.focus();
    } catch {
      setErrorMessage(
        `Cannot reach the backend API${API_BASE_URL ? ` at ${API_BASE_URL}` : ""}.`
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors duration-200 dark:bg-zinc-950 dark:text-zinc-100">
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

      <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid w-full grid-cols-1 overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-xl shadow-slate-900/5 lg:grid-cols-12 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-black/40">
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
                Start splitting bills fairly in 30 seconds.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-indigo-100">
                Create your free account with email verification—no daily expense caps, no hidden paywalls.
              </p>

              <div className="mt-8 space-y-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                      step === "details"
                        ? "bg-white text-indigo-700"
                        : "bg-emerald-400 text-emerald-950"
                    }`}
                  >
                    {step === "verify-otp" ? <Check className="h-4 w-4" /> : "1"}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Account Details</p>
                    <p className="text-xs text-indigo-200">
                      Name, email, currency &amp; password
                    </p>
                  </div>
                </div>

                <div className="ml-4 h-5 w-px bg-white/25" />

                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                      step === "verify-otp"
                        ? "bg-white text-indigo-700"
                        : "border border-white/40 bg-white/10 text-white"
                    }`}
                  >
                    2
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">
                      Email OTP Verification
                    </p>
                    <p className="text-xs text-indigo-200">
                      Confirm your 6-digit email code
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3 border-t border-white/15 pt-6 text-xs text-indigo-100">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />
                <span>Unlimited groups, friends &amp; expense splits</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-300" />
                <span>Paise-accurate Decimal calculations</span>
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-10 lg:col-span-7 lg:p-12">
            <div className="mb-6 flex items-center justify-between lg:hidden">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white">
                  <Wallet className="h-5 w-5" />
                </div>
                <span className="font-display text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                  Split
                  <span className="text-indigo-600 dark:text-indigo-400">Mate</span>
                </span>
              </div>
              <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                Step {step === "details" ? "1 of 2" : "2 of 2"}
              </span>
            </div>

            {errorMessage && (
              <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/50 dark:text-rose-300">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                <span>{errorMessage}</span>
              </div>
            )}

            {infoMessage && (
              <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-3 text-xs text-indigo-700 dark:border-indigo-900/60 dark:bg-indigo-950/50 dark:text-indigo-300">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />
                <span>{infoMessage}</span>
              </div>
            )}

            <AnimatePresence mode="wait">
              {step === "details" ? (
                <motion.div
                  key="step-details"
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 12 }}
                  transition={{ duration: 0.25 }}
                >
                  <div>
                    <h1 className="font-display text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
                      Create your free account
                    </h1>
                    <p className="mt-1.5 text-sm text-slate-500 dark:text-zinc-400">
                      Already have an account?{" "}
                      <Link
                        to="/login"
                        className="font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                      >
                        Sign in
                      </Link>
                    </p>
                  </div>

                  <form onSubmit={handleSendEmailOtp} className="mt-6 space-y-4">
                    <div>
                      <label
                        htmlFor="fullName"
                        className="block text-xs font-semibold text-slate-700 dark:text-zinc-300"
                      >
                        Full Name
                      </label>
                      <div className="relative mt-1.5">
                        <User className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                          id="fullName"
                          type="text"
                          autoComplete="name"
                          placeholder="Phanindra Dogiparti"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          required
                          className="h-11 w-full rounded-xl border border-slate-200 bg-white pr-3.5 pl-10 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
                      <div className="sm:col-span-7">
                        <label
                          htmlFor="regEmail"
                          className="block text-xs font-semibold text-slate-700 dark:text-zinc-300"
                        >
                          Email Address
                        </label>
                        <div className="relative mt-1.5">
                          <Mail className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <input
                            id="regEmail"
                            type="email"
                            autoComplete="email"
                            placeholder="you@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="h-11 w-full rounded-xl border border-slate-200 bg-white pr-3.5 pl-10 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                          />
                        </div>
                      </div>

                      <div className="sm:col-span-5">
                        <label
                          htmlFor="currency"
                          className="block text-xs font-semibold text-slate-700 dark:text-zinc-300"
                        >
                          Default Currency
                        </label>
                        <div className="relative mt-1.5">
                          <Globe className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <select
                            id="currency"
                            value={currency}
                            onChange={(e) => setCurrency(e.target.value)}
                            className="h-11 w-full rounded-xl border border-slate-200 bg-white pr-3 pl-10 text-sm text-slate-900 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                          >
                            {CURRENCIES.map((c) => (
                              <option key={c.code} value={c.code}>
                                {c.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="regPassword"
                        className="block text-xs font-semibold text-slate-700 dark:text-zinc-300"
                      >
                        Password
                      </label>
                      <div className="relative mt-1.5">
                        <Lock className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                          id="regPassword"
                          type={showPassword ? "text" : "password"}
                          autoComplete="new-password"
                          placeholder="Create a strong password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          className="h-11 w-full rounded-xl border border-slate-200 bg-white pr-11 pl-10 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          aria-label={
                            showPassword ? "Hide password" : "Show password"
                          }
                          className="absolute top-1/2 right-3 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 cursor-pointer"
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-2">
                        {[
                          { ok: passwordChecks.length, label: "8+ characters" },
                          { ok: passwordChecks.uppercase, label: "1 uppercase" },
                          { ok: passwordChecks.number, label: "1 number" },
                        ].map((rule) => (
                          <span
                            key={rule.label}
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium transition ${
                              rule.ok
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                                : "bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400"
                            }`}
                          >
                            <Check className="h-3 w-3" />
                            {rule.label}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="confirmPassword"
                        className="block text-xs font-semibold text-slate-700 dark:text-zinc-300"
                      >
                        Confirm Password
                      </label>
                      <div className="relative mt-1.5">
                        <Lock className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                          id="confirmPassword"
                          type={showPassword ? "text" : "password"}
                          autoComplete="new-password"
                          placeholder="Re-enter your password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          required
                          className="h-11 w-full rounded-xl border border-slate-200 bg-white pr-3.5 pl-10 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white shadow-md shadow-indigo-600/20 transition hover:bg-indigo-700 disabled:opacity-60 dark:bg-indigo-500 dark:hover:bg-indigo-600 cursor-pointer"
                    >
                      {isLoading ? (
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      ) : (
                        <>
                          Continue &amp; Send Email OTP
                          <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </button>
                  </form>
                </motion.div>
              ) : (
                <motion.div
                  key="step-otp"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.25 }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setStep("details");
                      setErrorMessage(null);
                      setInfoMessage(null);
                      setDevOtpHint(null);
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400 cursor-pointer"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Edit email or details
                  </button>

                  <div className="mt-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
                    <Mail className="h-6 w-6" />
                  </div>

                  <h1 className="mt-4 font-display text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
                    Verify your email address
                  </h1>
                  <p className="mt-1.5 text-sm text-slate-500 dark:text-zinc-400">
                    Enter the 6-digit verification code sent to{" "}
                    <span className="font-semibold text-slate-800 dark:text-zinc-200">
                      {email.trim().toLowerCase()}
                    </span>
                  </p>

                  {devOtpHint && (
                    <div className="mt-4 flex items-center justify-between rounded-xl border border-amber-200/80 bg-amber-50/70 px-3.5 py-2.5 text-xs text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-300">
                      <span>
                        Dev OTP:{" "}
                        <strong className="font-mono font-bold">{devOtpHint}</strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => setOtpDigits(devOtpHint.split(""))}
                        className="font-semibold underline hover:no-underline cursor-pointer"
                      >
                        Auto-fill
                      </button>
                    </div>
                  )}

                  <form onSubmit={handleVerifyOtp} className="mt-6 space-y-6">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                        Verification Code
                      </label>
                      <div className="mt-2 grid grid-cols-6 gap-2 sm:gap-3">
                        {otpDigits.map((digit, index) => (
                          <input
                            key={index}
                            ref={(el) => {
                              otpRefs.current[index] = el;
                            }}
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            value={digit}
                            onChange={(e) => handleOtpChange(index, e.target.value)}
                            onKeyDown={(e) => handleOtpKeyDown(index, e)}
                            onPaste={handleOtpPaste}
                            aria-label={`OTP digit ${index + 1}`}
                            className="h-12 w-full rounded-xl border border-slate-200 bg-white text-center font-mono text-lg font-bold text-slate-900 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 sm:h-14 sm:text-xl dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                          />
                        ))}
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading || otpDigits.join("").length !== 6}
                      className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white shadow-md shadow-indigo-600/20 transition hover:bg-indigo-700 disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-600 cursor-pointer"
                    >
                      {isLoading ? (
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      ) : (
                        <>
                          Verify Email &amp; Create Account
                          <CheckCircle2 className="h-4 w-4" />
                        </>
                      )}
                    </button>

                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400">
                      <span>Didn&apos;t receive the email? Check spam or</span>
                      <button
                        type="button"
                        disabled={resendTimer > 0 || isLoading}
                        onClick={handleResendCode}
                        className="inline-flex items-center gap-1 font-semibold text-indigo-600 disabled:text-slate-400 dark:text-indigo-400 dark:disabled:text-zinc-600 cursor-pointer"
                      >
                        <RefreshCw className="h-3 w-3" />
                        {resendTimer > 0
                          ? `Resend in ${resendTimer}s`
                          : "Resend OTP"}
                      </button>
                    </div>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
}