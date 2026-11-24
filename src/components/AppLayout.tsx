import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeftRight,
  Bell,
  Check,
  FolderKanban,
  Home,
  Loader2,
  LogOut,
  Moon,
  Plus,
  Receipt,
  Sun,
  UserCircle2,
  Users,
  Wallet,
} from "lucide-react";

const API_BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");

interface StoredUser {
  id?: string;
  fullName?: string;
  name?: string;
  email: string;
}

interface NotificationItem {
  id: string;
  type: "EXPENSE_CREATED" | "EXPENSE_UPDATED" | "SETTLEMENT";
  title: string;
  message: string;
  groupId: string;
  groupName: string;
  amount: number;
  currency: string;
  createdAt: string;
}

interface AppLayoutProps {
  title: string;
  subtitle?: string;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
}

function getNotificationPreferences() {
  try {
    const profile = JSON.parse(localStorage.getItem("splitmate_profile") || "{}");
    return {
      expenses: profile.notifyExpenses !== false,
      settlements: profile.notifySettlements !== false,
    };
  } catch {
    return { expenses: true, settlements: true };
  }
}

function getAuthHeaders(): HeadersInit {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = localStorage.getItem("splitmate_token");
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function formatNotificationAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatNotificationTime(value: string): string {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "";
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(timestamp);
}

export default function AppLayout({
  title,
  subtitle,
  headerActions,
  children,
}: AppLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const currentUser: StoredUser = useMemo(() => {
    try {
      const raw = localStorage.getItem("splitmate_user");
      return raw
        ? JSON.parse(raw)
        : { fullName: "Phanindra Dogiparti", email: "phanindra@splitmate.app" };
    } catch {
      return { fullName: "Phanindra Dogiparti", email: "phanindra@splitmate.app" };
    }
  }, [location.pathname]);

  const displayName =
    currentUser.fullName ||
    currentUser.name ||
    currentUser.email?.split("@")[0] ||
    "User";

  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  const notificationReadKey = `splitmate_notifications_last_read:${currentUser.email.toLowerCase()}`;
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  const [lastReadAt, setLastReadAt] = useState(
    () => Number(localStorage.getItem(notificationReadKey)) || 0,
  );
  const unreadNotificationCount = notifications.filter(
    (notification) => new Date(notification.createdAt).getTime() > lastReadAt,
  ).length;

  const fetchNotifications = useCallback(async () => {
    if (!localStorage.getItem("splitmate_token")) {
      setNotifications([]);
      setNotificationsError(null);
      return;
    }

    setNotificationsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/notifications`, {
        headers: getAuthHeaders(),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        data?: NotificationItem[];
        message?: string;
      };
      if (!response.ok) {
        throw new Error(payload.message || "Unable to load notifications.");
      }

      const preferences = getNotificationPreferences();
      const list = Array.isArray(payload.data) ? payload.data : [];
      setNotifications(
        list.filter((notification) =>
          notification.type === "SETTLEMENT"
            ? preferences.settlements
            : preferences.expenses,
        ),
      );
      setNotificationsError(null);
    } catch (error) {
      setNotificationsError(
        error instanceof Error ? error.message : "Unable to load notifications.",
      );
    } finally {
      setNotificationsLoading(false);
    }
  }, []);

  const PageIcon = location.pathname.startsWith("/groups/")
    ? FolderKanban
    : location.pathname === "/group"
      ? FolderKanban
      : location.pathname === "/expenses"
        ? Receipt
        : location.pathname === "/friends"
          ? Users
          : location.pathname === "/transactions"
            ? ArrowLeftRight
            : location.pathname === "/profile"
              ? UserCircle2
              : Home;

  const [darkMode, setDarkMode] = useState<boolean>(() => {
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

  useEffect(() => {
    setLastReadAt(Number(localStorage.getItem(notificationReadKey)) || 0);
  }, [notificationReadKey]);

  useEffect(() => {
    void fetchNotifications();
    const interval = window.setInterval(() => void fetchNotifications(), 60_000);
    return () => window.clearInterval(interval);
  }, [fetchNotifications, location.pathname]);

  function markNotificationsRead() {
    const readAt = Date.now();
    localStorage.setItem(notificationReadKey, String(readAt));
    setLastReadAt(readAt);
  }

  function toggleNotifications() {
    const nextOpen = !notificationsOpen;
    setNotificationsOpen(nextOpen);
    if (nextOpen) {
      markNotificationsRead();
      void fetchNotifications();
    }
  }

  function handleLogout() {
    setNotificationsOpen(false);
    navigate("/logout-confirmation");
  }

  const navLinks = [
    { to: "/group", label: "Groups", icon: FolderKanban },
    { to: "/expenses", label: "Add Expense", icon: Plus },
    { to: "/transactions", label: "Transactions", icon: ArrowLeftRight },
    { to: "/friends", label: "Friends", icon: Users },
    { to: "/profile", label: "Profile & UPI", icon: UserCircle2 },
  ];

  return (
    <div className="min-h-screen bg-slate-50 pb-[calc(5rem+env(safe-area-inset-bottom))] text-slate-900 transition-colors duration-200 lg:pb-0 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="flex min-h-screen">
        {/* ===================================================================
            UNIFIED STICKY DESKTOP SIDEBAR WITH USERNAME & LOGOUT AT BOTTOM
        =================================================================== */}
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col justify-between border-r border-slate-200/80 bg-white p-5 lg:flex dark:border-zinc-800 dark:bg-zinc-900">
          <div className="overflow-y-auto">
            <Link to="/" className="flex items-center gap-2.5 px-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-600/25">
                <Wallet className="h-5 w-5" />
              </div>
              <span className="font-display text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                Split<span className="text-indigo-600 dark:text-indigo-400">Mate</span>
              </span>
            </Link>

            <Link
              to="/expenses"
              className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white shadow-md shadow-indigo-600/20 transition hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" />
              Add Expense
            </Link>

            <nav className="mt-6 space-y-1">
              {navLinks.map((item) => {
                const Icon = item.icon;
                const isActive =
                  item.to === "/group"
                    ? location.pathname === "/group" ||
                      location.pathname.startsWith("/groups/")
                    : location.pathname === item.to;

                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm transition ${
                      isActive
                        ? "bg-indigo-50 font-semibold text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300"
                        : "font-medium text-slate-600 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800/70"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Bottom Pinned User Profile & Logout Footer */}
          <div className="space-y-2 border-t border-slate-200/80 pt-4 dark:border-zinc-800">
            <Link
              to="/profile"
              className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 transition hover:border-indigo-200 hover:bg-indigo-50/40 dark:border-zinc-800 dark:bg-zinc-950/60 dark:hover:border-indigo-800"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
                {initials || "U"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
                  {displayName}
                </p>
                <p className="truncate text-[11px] text-slate-500 dark:text-zinc-400">
                  {currentUser.email}
                </p>
              </div>
            </Link>

            <button
              type="button"
              onClick={handleLogout}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-rose-200/80 bg-rose-50/70 px-3.5 text-xs font-bold text-rose-600 transition hover:bg-rose-100 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-400 dark:hover:bg-rose-950/60 cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </aside>

        {/* ===================================================================
            RIGHT WORKSPACE (STICKY TOP BAR + PAGE CONTENT)
        =================================================================== */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/85">
            <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:gap-4 sm:px-6 lg:px-8">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span
                  aria-hidden="true"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/70 dark:text-indigo-400"
                >
                  <PageIcon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <h1 className="truncate whitespace-nowrap font-display text-lg font-extrabold tracking-tight text-slate-900 sm:text-xl dark:text-white">
                    {title}
                  </h1>
                  {subtitle && (
                    <p className="hidden text-xs text-slate-500 sm:block dark:text-zinc-400">
                      {subtitle}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                {headerActions}

                {/* Profile chip shown on desktop (lg+) only; mobile uses bottom bar */}
                <Link
                  to="/profile"
                  title="Profile & UPI Settings"
                  aria-label="Profile and UPI settings"
                  className="hidden h-9 shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 lg:inline-flex dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-[11px] font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                    {initials || "U"}
                  </span>
                  <span>{displayName}</span>
                </Link>

                {/* Theme toggle available on both mobile & desktop */}
                <button
                  type="button"
                  onClick={() => setDarkMode(!darkMode)}
                  aria-label="Toggle theme"
                  title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 cursor-pointer"
                >
                  {darkMode ? (
                    <Sun className="h-4 w-4 text-amber-400" />
                  ) : (
                    <Moon className="h-4 w-4" />
                  )}
                </button>

                {notificationsOpen && (
                  <button
                    type="button"
                    aria-label="Close notifications"
                    onClick={() => setNotificationsOpen(false)}
                    className="fixed inset-0 z-40 cursor-default bg-slate-950/10 sm:bg-transparent"
                  />
                )}
                <div className={`relative ${notificationsOpen ? "z-50" : ""}`}>
                  <button
                    type="button"
                    onClick={toggleNotifications}
                    aria-label="Notifications"
                    aria-haspopup="dialog"
                    aria-expanded={notificationsOpen}
                    className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 cursor-pointer"
                  >
                    <Bell className="h-4 w-4" />
                    {unreadNotificationCount > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-600 px-1 text-[9px] font-bold text-white">
                        {unreadNotificationCount > 9 ? "9+" : unreadNotificationCount}
                      </span>
                    )}
                  </button>

                  {notificationsOpen && (
                    <section
                      role="dialog"
                      aria-label="Notifications"
                      className="fixed top-14 right-2 left-2 z-50 flex max-h-[min(70dvh,28rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:absolute sm:top-full sm:right-0 sm:left-auto sm:mt-2 sm:w-96 dark:border-zinc-800 dark:bg-zinc-900"
                    >
                      <header className="flex items-center justify-between gap-3 border-b border-slate-100 p-4 dark:border-zinc-800">
                        <div>
                          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                            Notifications
                          </h2>
                          <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                            Recent group expenses and payments
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={markNotificationsRead}
                          className="text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
                        >
                          <Check className="mr-1 inline h-3.5 w-3.5" />
                          Mark read
                        </button>
                      </header>

                      <div className="overflow-y-auto">
                        {notificationsLoading && notifications.length === 0 ? (
                          <div className="flex items-center justify-center gap-2 p-8 text-sm text-slate-500 dark:text-zinc-400">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading notifications
                          </div>
                        ) : notificationsError ? (
                          <div className="p-4 text-sm">
                            <p className="text-rose-600 dark:text-rose-400">
                              {notificationsError}
                            </p>
                            <button
                              type="button"
                              onClick={() => void fetchNotifications()}
                              className="mt-2 font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
                            >
                              Try again
                            </button>
                          </div>
                        ) : notifications.length === 0 ? (
                          <p className="p-8 text-center text-sm text-slate-500 dark:text-zinc-400">
                            No notifications yet.
                          </p>
                        ) : (
                          notifications.map((notification) => {
                            const Icon =
                              notification.type === "SETTLEMENT" ? ArrowLeftRight : Receipt;
                            const isUnread =
                              new Date(notification.createdAt).getTime() > lastReadAt;
                            return (
                              <Link
                                key={notification.id}
                                to={`/groups/${notification.groupId}`}
                                onClick={() => setNotificationsOpen(false)}
                                className="flex gap-3 border-b border-slate-100 p-3.5 transition hover:bg-slate-50 dark:border-zinc-800 dark:hover:bg-zinc-800/60"
                              >
                                <span className="relative mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
                                  <Icon className="h-4 w-4" />
                                  {isUnread && (
                                    <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-indigo-600 dark:border-zinc-900" />
                                  )}
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="flex items-start justify-between gap-2">
                                    <span className="text-xs font-bold text-slate-800 dark:text-zinc-100">
                                      {notification.title}
                                    </span>
                                    <span className="shrink-0 text-[10px] text-slate-400">
                                      {formatNotificationTime(notification.createdAt)}
                                    </span>
                                  </span>
                                  <span className="mt-0.5 block truncate text-xs text-slate-600 dark:text-zinc-300">
                                    {notification.message} · {notification.groupName}
                                  </span>
                                  <span className="mt-1 block text-[11px] font-semibold tabular-nums text-indigo-600 dark:text-indigo-400">
                                    {formatNotificationAmount(
                                      notification.amount,
                                      notification.currency,
                                    )}
                                  </span>
                                </span>
                              </Link>
                            );
                          })
                        )}
                      </div>
                      {notificationsLoading && notifications.length > 0 && (
                        <div className="flex items-center justify-center gap-2 border-t border-slate-100 p-2 text-[11px] text-slate-500 dark:border-zinc-800 dark:text-zinc-400">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Updating
                        </div>
                      )}
                    </section>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleLogout}
                  title="Logout"
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-600 transition hover:bg-rose-100 lg:hidden dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-400"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
          </header>

          <main className="mx-auto w-full min-w-0 max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </main>
        </div>
      </div>

      {/* =====================================================================
          UNIFIED MOBILE BOTTOM TAB BAR (< 1024px) WITH PROFILE TAB
      ===================================================================== */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex h-[calc(4rem+env(safe-area-inset-bottom))] items-center justify-around border-t border-slate-200 bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden dark:border-zinc-800 dark:bg-zinc-950/95">
        <NavLink
          to="/group"
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 text-[11px] font-medium ${
              isActive ? "text-indigo-600 dark:text-indigo-400" : "text-slate-500"
            }`
          }
        >
          <FolderKanban className="h-5 w-5" />
          Groups
        </NavLink>

        <NavLink
          to="/transactions"
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 text-[11px] font-medium ${
              isActive ? "text-indigo-600 dark:text-indigo-400" : "text-slate-500"
            }`
          }
        >
          <ArrowLeftRight className="h-5 w-5" />
          Activity
        </NavLink>

        <Link
          to="/expenses"
          aria-label="Add Expense"
          className="-mt-6 flex h-13 w-13 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-600/35 transition active:scale-95"
        >
          <Plus className="h-6 w-6" />
        </Link>

        <NavLink
          to="/friends"
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 text-[11px] font-medium ${
              isActive ? "text-indigo-600 dark:text-indigo-400" : "text-slate-500"
            }`
          }
        >
          <Users className="h-5 w-5" />
          Friends
        </NavLink>

        <NavLink
          to="/profile"
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 text-[11px] font-medium ${
              isActive ? "text-indigo-600 dark:text-indigo-400" : "text-slate-500"
            }`
          }
        >
          <UserCircle2 className="h-5 w-5" />
          Profile
        </NavLink>
      </nav>
    </div>
  );
}