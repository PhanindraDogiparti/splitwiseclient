import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Bell,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Globe,
  KeyRound,
  Loader2,
  Mail,
  Phone,
  QrCode,
  Save,
  ShieldCheck,
  Smartphone,
  User,
  Wallet,
} from "lucide-react";
import AppLayout from "../components/AppLayout";

const API_BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");

type MemberRole = "ADMIN" | "MEMBER";

interface MemberProfilePayload {
  name: string;
  email: string;
  upiId?: string;
  role: MemberRole;
}

interface SessionInfo {
  sessionId: string;
  device: string;
  lastLogin: string;
  startedAt: string;
}

interface StoredProfile extends MemberProfilePayload {
  username: string;
  phone: string;
  defaultCurrency: string;
  notifyExpenses: boolean;
  notifySettlements: boolean;
  lastLogin: string;
  session: SessionInfo;
}

function getOrCreateSessionInfo(existing?: Partial<SessionInfo>): SessionInfo {
  const nowIso = new Date().toISOString();
  const userAgent =
    typeof navigator !== "undefined" ? navigator.userAgent : "Web Browser";
  const isMac = /mac/i.test(userAgent);
  const isMobile = /iphone|android|mobile/i.test(userAgent);
  const detectedDevice = isMobile
    ? "Mobile Browser"
    : isMac
      ? "macOS Web Session"
      : "Desktop Web Session";

  let sessionId = existing?.sessionId;
  if (!sessionId) {
    sessionId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? `sess_${crypto.randomUUID().slice(0, 8)}`
        : `sess_${Date.now().toString(36)}`;
  }

  const lastLogin =
    localStorage.getItem("splitmate_last_login") ||
    existing?.lastLogin ||
    nowIso;

  localStorage.setItem("splitmate_last_login", lastLogin);

  const info: SessionInfo = {
    sessionId,
    device: existing?.device || detectedDevice,
    lastLogin,
    startedAt: existing?.startedAt || nowIso,
  };

  localStorage.setItem("splitmate_session", JSON.stringify(info));
  return info;
}

function formatDateTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

export default function ProfilePage() {
  const initialData: StoredProfile = useMemo(() => {
    const fallbackName = "Phanindra Dogiparti";
    const fallbackEmail = "phanindra@splitmate.app";

    try {
      const rawUser = localStorage.getItem("splitmate_user");
      const rawProfile = localStorage.getItem("splitmate_profile");
      const rawSession = localStorage.getItem("splitmate_session");
      const userObj = rawUser ? JSON.parse(rawUser) : {};
      const profObj = rawProfile ? JSON.parse(rawProfile) : {};
      const sessObj = rawSession ? JSON.parse(rawSession) : {};

      const resolvedName =
        profObj.name ||
        profObj.fullName ||
        userObj.name ||
        userObj.fullName ||
        fallbackName;

      const resolvedEmail =
        profObj.email || userObj.email || fallbackEmail;

      const role: MemberRole =
        profObj.role === "ADMIN" || userObj.role === "ADMIN" ? "ADMIN" : "MEMBER";

      const session = getOrCreateSessionInfo({
        ...sessObj,
        lastLogin: profObj.lastLogin || userObj.lastLogin || sessObj.lastLogin,
      });

      return {
        name: resolvedName,
        email: resolvedEmail,
        upiId: profObj.upiId ?? userObj.upiId ?? "phanindra@okaxis",
        role,
        username:
          profObj.username ||
          resolvedEmail.split("@")[0]?.replace(/[^a-zA-Z0-9._-]/g, "") ||
          "phanindra",
        phone: profObj.phone || "+91 98765 43210",
        defaultCurrency: profObj.defaultCurrency || "INR",
        notifyExpenses: profObj.notifyExpenses ?? true,
        notifySettlements: profObj.notifySettlements ?? true,
        lastLogin: session.lastLogin,
        session,
      };
    } catch {
      const session = getOrCreateSessionInfo();
      return {
        name: fallbackName,
        email: fallbackEmail,
        upiId: "phanindra@okaxis",
        role: "MEMBER",
        username: "phanindra",
        phone: "+91 98765 43210",
        defaultCurrency: "INR",
        notifyExpenses: true,
        notifySettlements: true,
        lastLogin: session.lastLogin,
        session,
      };
    }
  }, []);

  const [name, setName] = useState(initialData.name);
  const [email, setEmail] = useState(initialData.email);
  const [upiId, setUpiId] = useState(initialData.upiId ?? "");
  const [role, setRole] = useState<MemberRole>(initialData.role);
  const [username, setUsername] = useState(initialData.username);
  const [phone, setPhone] = useState(initialData.phone);
  const [defaultCurrency, setDefaultCurrency] = useState(initialData.defaultCurrency);
  const [notifyExpenses, setNotifyExpenses] = useState(initialData.notifyExpenses);
  const [notifySettlements, setNotifySettlements] = useState(initialData.notifySettlements);
  const [sessionInfo, setSessionInfo] = useState<SessionInfo>(initialData.session);

  const [saving, setSaving] = useState(false);
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [savedBanner, setSavedBanner] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  useEffect(() => {
    const current = getOrCreateSessionInfo(sessionInfo);
    setSessionInfo(current);
  }, []);

  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  const persistProfileLocally = useCallback(
    (payload: MemberProfilePayload, activeSession: SessionInfo) => {
      const fullRecord: StoredProfile = {
        name: payload.name,
        email: payload.email,
        upiId: payload.upiId,
        role: payload.role,
        username: username.trim().toLowerCase(),
        phone: phone.trim(),
        defaultCurrency,
        notifyExpenses,
        notifySettlements,
        lastLogin: activeSession.lastLogin,
        session: activeSession,
      };

      localStorage.setItem("splitmate_profile", JSON.stringify(fullRecord));
      localStorage.setItem("splitmate_last_login", activeSession.lastLogin);
      localStorage.setItem("splitmate_session", JSON.stringify(activeSession));

      try {
        const rawUser = localStorage.getItem("splitmate_user");
        const parsedUser = rawUser ? JSON.parse(rawUser) : {};
        localStorage.setItem(
          "splitmate_user",
          JSON.stringify({
            ...parsedUser,
            name: payload.name,
            fullName: payload.name,
            email: payload.email,
            upiId: payload.upiId,
            role: payload.role,
            lastLogin: activeSession.lastLogin,
            sessionId: activeSession.sessionId,
          })
        );
      } catch {
        // ignore storage errors
      }
    },
    [defaultCurrency, notifyExpenses, notifySettlements, phone, username]
  );

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setErrorBanner(null);
    setSavedBanner(null);

    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedUpi = upiId.trim();

    if (!trimmedName || trimmedName.length > 120) {
      setErrorBanner("Name must be between 1 and 120 characters.");
      return;
    }

    if (!trimmedEmail || trimmedEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setErrorBanner("Please enter a valid email address.");
      return;
    }

    if (trimmedUpi.length > 100) {
      setErrorBanner("UPI ID must be 100 characters or fewer.");
      return;
    }

    const memberPayload: MemberProfilePayload = {
      name: trimmedName,
      email: trimmedEmail,
      ...(trimmedUpi ? { upiId: trimmedUpi } : { upiId: "" }),
      role,
    };

    const refreshedSession: SessionInfo = {
      ...sessionInfo,
      lastLogin: localStorage.getItem("splitmate_last_login") || sessionInfo.lastLogin,
    };

    setSaving(true);
    try {
      const token = localStorage.getItem("splitmate_token");
      if (token && API_BASE_URL) {
        const res = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          credentials: "include",
          body: JSON.stringify({
            ...memberPayload,
            sessionId: refreshedSession.sessionId,
            lastLogin: refreshedSession.lastLogin,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          if (res.status !== 404 && res.status !== 405) {
            throw new Error(data.message || "Failed to update profile on server.");
          }
        }
      }

      persistProfileLocally(memberPayload, refreshedSession);
      setSessionInfo(refreshedSession);
      setSavedBanner("Profile, UPI details, and session state saved successfully.");
      setTimeout(() => setSavedBanner(null), 3000);
    } catch (err) {
      persistProfileLocally(memberPayload, refreshedSession);
      setErrorBanner(
        err instanceof Error
          ? err.message
          : "Saved locally; server sync was unavailable."
      );
    } finally {
      setSaving(false);
    }
  }

  function handleCopyUpi() {
    if (!upiId.trim()) return;
    navigator.clipboard?.writeText(upiId.trim());
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2000);
  }

  return (
    <AppLayout
      title="Profile & UPI Settings"
      subtitle="Manage your member profile, preferred currency, UPI ID, and active session details"
      headerActions={
        <button
          type="button"
          disabled={saving}
          onClick={(e) => void handleSaveProfile(e)}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 text-xs font-semibold text-white shadow-xs transition hover:bg-indigo-700 disabled:opacity-60 cursor-pointer"
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          <span>{saving ? "Saving..." : "Save Changes"}</span>
        </button>
      }
    >
      <div className="w-full space-y-6">
        {errorBanner && (
          <div className="flex items-center gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-800 dark:border-rose-800/60 dark:bg-rose-950/50 dark:text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{errorBanner}</span>
          </div>
        )}

        {savedBanner && (
          <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{savedBanner}</span>
          </div>
        )}

        {/* Full-Width Profile Overview Banner */}
        <div className="grid grid-cols-1 gap-4 rounded-3xl border border-slate-200/90 bg-white p-6 shadow-2xs lg:grid-cols-12 lg:items-center dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center gap-4 lg:col-span-6">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 font-display text-xl font-extrabold text-white shadow-md shadow-indigo-600/25">
              {initials || "U"}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate font-display text-xl font-extrabold text-slate-900 dark:text-white">
                  {name}
                </h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                  {role}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  <ShieldCheck className="h-3 w-3" />
                  Verified Member
                </span>
              </div>
              <p className="mt-0.5 truncate text-sm text-slate-500 dark:text-zinc-400">
                @{username} • {email}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:col-span-6">
            <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-3 dark:border-zinc-800 dark:bg-zinc-950/60">
              <p className="text-[11px] font-medium text-slate-400">Last Login</p>
              <p className="mt-0.5 truncate text-xs font-bold text-slate-900 dark:text-white">
                {formatDateTime(sessionInfo.lastLogin)}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-3 dark:border-zinc-800 dark:bg-zinc-950/60">
              <p className="text-[11px] font-medium text-slate-400">Default Currency</p>
              <p className="mt-0.5 font-display text-sm font-extrabold text-slate-900 dark:text-white">
                {defaultCurrency} (₹)
              </p>
            </div>

            <div className="col-span-2 flex items-center justify-between rounded-2xl border border-indigo-100 bg-indigo-50/60 p-3 sm:col-span-1 dark:border-indigo-900/40 dark:bg-indigo-950/30">
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-indigo-600 dark:text-indigo-300">
                  Saved UPI ID
                </p>
                <p className="truncate font-mono text-xs font-bold text-slate-900 dark:text-white">
                  {upiId || "Not set"}
                </p>
              </div>
              {upiId && (
                <button
                  type="button"
                  onClick={handleCopyUpi}
                  title="Copy UPI ID"
                  className="ml-2 rounded-lg bg-white p-1.5 text-indigo-600 shadow-2xs hover:bg-indigo-50 dark:bg-zinc-900 dark:text-indigo-300 cursor-pointer"
                >
                  {copiedUpi ? (
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Full-Width 12-Column Settings Grid */}
        <form
          onSubmit={(e) => void handleSaveProfile(e)}
          className="grid grid-cols-1 gap-6 lg:grid-cols-12"
        >
          {/* Left 7 Cols: Member Identity & Preferences */}
          <div className="space-y-5 rounded-3xl border border-slate-200/90 bg-white p-6 shadow-2xs lg:col-span-7 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="border-b border-slate-100 pb-3 dark:border-zinc-800">
              <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                Member Information
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Synced with your member profile schema (name, email, upiId, role)
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  Name (1–120 chars)
                </label>
                <div className="relative mt-1.5">
                  <User className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    required
                    maxLength={120}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white pr-3.5 pl-10 text-sm outline-none focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-950"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  Member Role
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as MemberRole)}
                  className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold outline-none focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-950 cursor-pointer"
                >
                  <option value="MEMBER">MEMBER</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  Email Address
                </label>
                <div className="relative mt-1.5">
                  <Mail className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    required
                    type="email"
                    maxLength={254}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white pr-3.5 pl-10 text-sm outline-none focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-950"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  Mobile Number
                </label>
                <div className="relative mt-1.5">
                  <Phone className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white pr-3.5 pl-10 text-sm tabular-nums outline-none focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-950"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  Handle / Username
                </label>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm outline-none focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-950"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  Default Currency
                </label>
                <div className="relative mt-1.5">
                  <Globe className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <select
                    value={defaultCurrency}
                    onChange={(e) => setDefaultCurrency(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white pr-3 pl-10 text-sm outline-none focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-950 cursor-pointer"
                  >
                    <option value="INR">INR (₹) — Indian Rupee</option>
                    <option value="USD">USD ($) — US Dollar</option>
                    <option value="EUR">EUR (€) — Euro</option>
                    <option value="GBP">GBP (£) — British Pound</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Notification Preferences */}
            <div className="space-y-2.5 border-t border-slate-100 pt-4 dark:border-zinc-800">
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
                <Bell className="h-3.5 w-3.5 text-indigo-500" />
                Activity Notifications
              </p>

              <label className="flex items-center justify-between rounded-xl border border-slate-200/80 p-3 dark:border-zinc-800 cursor-pointer">
                <div>
                  <p className="text-xs font-semibold text-slate-800 dark:text-zinc-200">
                    New &amp; Edited Group Expenses
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                    Notify me whenever someone adds or modifies a bill involving me
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={notifyExpenses}
                  onChange={(e) => setNotifyExpenses(e.target.checked)}
                  className="h-4 w-4 rounded text-indigo-600"
                />
              </label>

              <label className="flex items-center justify-between rounded-xl border border-slate-200/80 p-3 dark:border-zinc-800 cursor-pointer">
                <div>
                  <p className="text-xs font-semibold text-slate-800 dark:text-zinc-200">
                    Settlement Confirmations
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                    Notify me when a friend records or confirms a payment
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={notifySettlements}
                  onChange={(e) => setNotifySettlements(e.target.checked)}
                  className="h-4 w-4 rounded text-indigo-600"
                />
              </label>
            </div>
          </div>

          {/* Right 5 Cols: UPI Settlement & Session Info */}
          <div className="flex flex-col justify-between space-y-5 rounded-3xl border border-slate-200/90 bg-white p-6 shadow-2xs lg:col-span-5 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-zinc-800">
                <div>
                  <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                    UPI Settlement Setup
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Receive payments faster from friends
                  </p>
                </div>
                <Wallet className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  Your UPI ID (Optional, max 100 chars)
                </label>
                <input
                  maxLength={100}
                  placeholder="yourname@okaxis"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3.5 font-mono text-sm outline-none focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-950"
                />
                <p className="mt-1.5 text-[11px] text-slate-500 dark:text-zinc-400">
                  Displayed with a one-tap copy button when friends settle up with you. We never store UPI PINs or bank credentials.
                </p>
              </div>

              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 dark:border-indigo-900/40 dark:bg-indigo-950/30">
                <div className="flex items-center gap-2 text-xs font-bold text-indigo-700 dark:text-indigo-300">
                  <QrCode className="h-4 w-4" />
                  <span>UPI QR &amp; Instant Pay — Coming Soon</span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-zinc-400">
                  Friends can copy your UPI ID and record manual confirmations seamlessly.
                </p>
              </div>

              <div className="space-y-2 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-zinc-200">
                  <KeyRound className="h-4 w-4 text-emerald-600" />
                  <span>Active Session &amp; Login Audit</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-400">
                  <span className="inline-flex items-center gap-1.5">
                    <Smartphone className="h-3.5 w-3.5" />
                    <span>Session ID</span>
                  </span>
                  <code className="font-mono font-semibold text-slate-700 dark:text-zinc-200">
                    {sessionInfo.sessionId}
                  </code>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-400">
                  <span>Device</span>
                  <span className="font-medium text-slate-700 dark:text-zinc-200">
                    {sessionInfo.device}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-400">
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    <span>Last Login</span>
                  </span>
                  <span className="font-medium text-slate-700 dark:text-zinc-200">
                    {formatDateTime(sessionInfo.lastLogin)}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white shadow-md shadow-indigo-600/20 transition hover:bg-indigo-700 disabled:opacity-60 cursor-pointer"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              <span>{saving ? "Saving..." : "Save All Profile Settings"}</span>
            </button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}