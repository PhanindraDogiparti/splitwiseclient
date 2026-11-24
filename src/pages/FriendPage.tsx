import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  Copy,
  FolderKanban,
  Loader2,
  Mail,
  Plus,
  Search,
  Scale,
  Smartphone,
  UserPlus,
  Users,
} from "lucide-react";
import AppLayout from "../components/AppLayout";

interface FriendItem {
  email: string;
  name: string;
  upiId: string;
  totalOwedToMe: number; // Positive = they owe user
  totalOwedByMe: number; // Positive = user owes them
  sharedGroups: string[];
}

function formatINR(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export default function FriendsPage() {
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchFriends() {
      try {
        const token = localStorage.getItem("splitmate_token");
        const res = await fetch(
          `${(import.meta.env.VITE_API_URL || "").replace(/\/+$/, "")}/api/v1/friends`,
          {
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
          }
        );
        if (!res.ok) throw new Error("Failed to fetch friends");
        const data = await res.json();
        const list = Array.isArray(data?.data?.friends)
          ? data.data.friends
          : Array.isArray(data?.data)
            ? data.data
            : [];
        setFriends(list);
      } catch (err) {
        console.error("Failed to fetch friends:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchFriends();
  }, []);

  const summary = useMemo(() => {
    let totalOwedToMe = 0;
    let totalOwedByMe = 0;

    friends.forEach((f) => {
      totalOwedToMe += Number(f.totalOwedToMe) || 0;
      totalOwedByMe += Number(f.totalOwedByMe) || 0;
    });

    return {
      totalOwedToMe: Math.round(totalOwedToMe * 100) / 100,
      totalOwedByMe: Math.round(totalOwedByMe * 100) / 100,
      netBalance: Math.round((totalOwedToMe - totalOwedByMe) * 100) / 100,
    };
  }, [friends]);

  const filteredFriends = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return friends;
    return friends.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        f.email.toLowerCase().includes(q) ||
        f.upiId?.toLowerCase().includes(q)
    );
  }, [friends, searchQuery]);

  function handleSendFriendRequest(e: React.FormEvent) {
    e.preventDefault();
    const clean = inviteEmail.trim().toLowerCase();
    if (!clean) return;
    if (friends.some((f) => f.email.toLowerCase() === clean)) return;

    setFriends((prev) => [
      {
        name: clean.split("@")[0],
        email: clean,
        upiId: `${clean.split("@")[0]}@upi`,
        totalOwedToMe: 0,
        totalOwedByMe: 0,
        sharedGroups: [],
      },
      ...prev,
    ]);
    setInviteEmail("");
  }

  return (
    <AppLayout
      title="Friends & 1-on-1 Balances"
      subtitle="Combined balances across shared groups and direct non-group expenses"
      headerActions={
        <Link
          to="/add-expense"
          className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 text-xs font-semibold text-white shadow-xs transition hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" />
          Split 1-on-1
        </Link>
      }
    >
      <div className="space-y-6">
        {/* Compact Summary Strip (2x2 on mobile, 3-col on desktop) */}
        <section className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-emerald-200/80 bg-white p-3 shadow-2xs sm:rounded-2xl sm:p-5 dark:border-emerald-900/50 dark:bg-zinc-900">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-[10px] font-bold uppercase tracking-wider text-emerald-600 sm:text-xs dark:text-emerald-400">
                Friends Owe You
              </span>
              <span className="hidden h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 sm:flex dark:bg-emerald-950 dark:text-emerald-400">
                <ArrowDownLeft className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-1.5 truncate font-display text-base font-extrabold text-emerald-600 tabular-nums sm:mt-2 sm:text-2xl dark:text-emerald-400">
              {formatINR(summary.totalOwedToMe)}
            </p>
            <p className="mt-0.5 truncate text-[10px] text-slate-500 sm:mt-1 sm:text-xs dark:text-zinc-400">
              Receivable from friends
            </p>
          </div>

          <div className="rounded-xl border border-rose-200/80 bg-white p-3 shadow-2xs sm:rounded-2xl sm:p-5 dark:border-rose-900/50 dark:bg-zinc-900">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-[10px] font-bold uppercase tracking-wider text-rose-600 sm:text-xs dark:text-rose-400">
                You Owe Friends
              </span>
              <span className="hidden h-8 w-8 items-center justify-center rounded-xl bg-rose-50 text-rose-600 sm:flex dark:bg-rose-950 dark:text-rose-400">
                <ArrowUpRight className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-1.5 truncate font-display text-base font-extrabold text-rose-600 tabular-nums sm:mt-2 sm:text-2xl dark:text-rose-400">
              {formatINR(summary.totalOwedByMe)}
            </p>
            <p className="mt-0.5 truncate text-[10px] text-slate-500 sm:mt-1 sm:text-xs dark:text-zinc-400">
              Payable to friends
            </p>
          </div>

          <div className="col-span-2 rounded-xl border border-indigo-200/80 bg-white p-3 shadow-2xs sm:rounded-2xl sm:p-5 lg:col-span-1 dark:border-indigo-900/50 dark:bg-zinc-900">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-[10px] font-bold uppercase tracking-wider text-indigo-600 sm:text-xs dark:text-indigo-400">
                Net Friend Balance
              </span>
              <span className="hidden h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 sm:flex dark:bg-indigo-950 dark:text-indigo-400">
                <Scale className="h-4 w-4" />
              </span>
            </div>
            <p
              className={`mt-1.5 truncate font-display text-base font-extrabold tabular-nums sm:mt-2 sm:text-2xl ${
                summary.netBalance > 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : summary.netBalance < 0
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-slate-800 dark:text-zinc-200"
              }`}
            >
              {summary.netBalance > 0
                ? `+${formatINR(summary.netBalance)}`
                : summary.netBalance < 0
                  ? `-${formatINR(Math.abs(summary.netBalance))}`
                  : "₹0.00"}
            </p>
            <p className="mt-0.5 truncate text-[10px] text-slate-500 sm:mt-1 sm:text-xs dark:text-zinc-400">
              {friends.length} connected {friends.length === 1 ? "friend" : "friends"}
            </p>
          </div>
        </section>

        {/* Add Friend & Search Row */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <form
            onSubmit={handleSendFriendRequest}
            className="flex items-center gap-2 rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-2xs sm:p-4 lg:col-span-7 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="relative flex-1">
              <Mail className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                required
                placeholder="Add friend by email address..."
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pr-3.5 pl-10 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
              />
            </div>
            <button
              type="submit"
              className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-indigo-600 px-4 text-xs font-semibold text-white shadow-xs transition hover:bg-indigo-700 cursor-pointer"
            >
              <UserPlus className="h-4 w-4" />
              <span>Add Friend</span>
            </button>
          </form>

          <div className="flex items-center rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-2xs sm:p-4 lg:col-span-5 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="relative w-full">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name, email, or UPI..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pr-3.5 pl-10 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* Friends Cards Grid */}
        {loading ? (
          <div className="flex items-center justify-center rounded-3xl border border-slate-200 bg-white p-12 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center gap-2.5 text-sm font-medium text-slate-600 dark:text-zinc-300">
              <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
              <span>Loading friends and balances...</span>
            </div>
          </div>
        ) : filteredFriends.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
              <Users className="h-6 w-6" />
            </div>
            <h2 className="mt-3 font-display text-lg font-bold text-slate-900 dark:text-white">
              {searchQuery.trim() ? "No matching friends found" : "No friends added yet"}
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
              {searchQuery.trim()
                ? "Try a different name or email address."
                : "Add a friend using their email address above to track 1-on-1 splits."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {filteredFriends.map((friend) => {
              const owesYou = friend.totalOwedToMe > 0;
              const youOwe = friend.totalOwedByMe > 0;

              return (
                <div
                  key={friend.email}
                  className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xs transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-indigo-700"
                >
                  <div
                    className={`h-1.5 w-full ${
                      owesYou
                        ? "bg-emerald-500"
                        : youOwe
                          ? "bg-rose-500"
                          : "bg-slate-200 dark:bg-zinc-800"
                    }`}
                  />

                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-100 font-display text-sm font-extrabold text-indigo-700 ring-1 ring-indigo-200/70 dark:bg-indigo-950 dark:text-indigo-300 dark:ring-indigo-800/60">
                          {friend.name
                            .split(" ")
                            .slice(0, 2)
                            .map((n) => n[0]?.toUpperCase())
                            .join("")}
                        </div>
                        <div className="min-w-0">
                          <h2 className="truncate font-display text-base font-bold text-slate-900 group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-400">
                            {friend.name}
                          </h2>
                          <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-slate-500 dark:text-zinc-400">
                            <Mail className="h-3 w-3 shrink-0 text-slate-400" />
                            <span className="truncate">{friend.email}</span>
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Net Balance
                        </p>
                        <p
                          className={`mt-0.5 font-display text-sm font-extrabold tabular-nums sm:text-base ${
                            owesYou
                              ? "text-emerald-600 dark:text-emerald-400"
                              : youOwe
                                ? "text-rose-600 dark:text-rose-400"
                                : "text-slate-500 dark:text-zinc-400"
                          }`}
                        >
                          {owesYou
                            ? `Owes you ${formatINR(friend.totalOwedToMe)}`
                            : youOwe
                              ? `You owe ${formatINR(friend.totalOwedByMe)}`
                              : "Settled up"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3.5 text-xs dark:border-zinc-800">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {friend.sharedGroups.length > 0 ? (
                          friend.sharedGroups.map((g) => (
                            <span
                              key={g}
                              className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:bg-zinc-800 dark:text-zinc-300"
                            >
                              <FolderKanban className="h-3 w-3 text-indigo-500" />
                              {g}
                            </span>
                          ))
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-indigo-50/70 px-2.5 py-1 text-[11px] font-medium text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
                            <Users className="h-3 w-3" />
                            Direct 1-on-1 friend
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(friend.upiId);
                          setCopiedId(friend.email);
                          setTimeout(() => setCopiedId(null), 2000);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-600 transition hover:border-indigo-300 hover:bg-indigo-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-indigo-400 dark:hover:border-indigo-700 cursor-pointer"
                      >
                        {copiedId === friend.email ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-500" />
                            <span>Copied UPI</span>
                          </>
                        ) : (
                          <>
                            <Smartphone className="h-3 w-3 text-slate-400" />
                            <span>{friend.upiId}</span>
                            <Copy className="h-3 w-3 opacity-75" />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}