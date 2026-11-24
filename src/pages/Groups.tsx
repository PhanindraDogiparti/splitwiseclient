import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpDown,
  ArrowUpRight,
  Check,
  Filter,
  FolderKanban,
  Loader2,
  Pencil,
  Plus,
  Receipt,
  RotateCcw,
  Scale,
  SlidersHorizontal,
  Share2,
  Tag,
  Users,
  X,
} from "lucide-react";
import AppLayout from "../components/AppLayout";
import ShareModal from "../components/ShareModal";

const API_BASE_URL =
  (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");

type GroupType = "TRIP" | "ROOMMATE" | "FRIENDS" | "CUSTOM";
type BalanceFilter = "ALL" | "TO_RECEIVE" | "TO_GIVE" | "SETTLED";
type SortOption = "DEFAULT" | "MY_SPEND_DESC" | "GROUP_SPEND_DESC" | "BALANCE_DESC";

interface GroupMemberItem {
  id: string;
  name: string;
  email: string;
  isCurrentUser: boolean;
  role: "ADMIN" | "MEMBER";
  netBalance: number;
}

interface GroupExpenseSummary {
  id: string;
  title: string;
  paidById?: string;
  paidBy: string;
  amount: number;
  yourShare?: number;
  splitType: string;
  date: string;
}

interface GroupItem {
  id: string;
  name: string;
  description: string;
  type: GroupType;
  customTypeLabel?: string;
  currency: string;
  simplifyDebts: boolean;
  totalSpend: number;
  myTotalShare: number;
  members: GroupMemberItem[];
  recentExpenses: GroupExpenseSummary[];
}

const TYPE_LABELS: Record<GroupType, string> = {
  TRIP: "Trip",
  ROOMMATE: "Roommate",
  FRIENDS: "Friends",
  CUSTOM: "Custom",
};

function formatINR(value: number, currency = "INR"): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem("splitmate_token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

function getCurrentUserEmail(): string {
  try {
    const user = JSON.parse(localStorage.getItem("splitmate_user") || "{}");
    return typeof user.email === "string" ? user.email.trim().toLowerCase() : "";
  } catch {
    return "";
  }
}

function normalizeGroupType(rawType: unknown): GroupType {
  const upper = String(rawType || "FRIENDS").toUpperCase();
  if (upper === "TRIP" || upper === "ROOMMATE" || upper === "FRIENDS" || upper === "CUSTOM") {
    return upper;
  }
  return "CUSTOM";
}

function normalizeGroupFromApi(raw: Record<string, unknown>): GroupItem {
  const id = String(raw.id ?? raw._id ?? `grp_${Date.now()}`);
  const currentUserEmail = getCurrentUserEmail();
  const rawMembers = Array.isArray(raw.members) ? raw.members : [];
  const members: GroupMemberItem[] = rawMembers.map((m, idx) => {
    const memberObj = (m && typeof m === "object" ? m : {}) as Record<string, unknown>;
    const nestedUser =
      memberObj.user && typeof memberObj.user === "object"
        ? (memberObj.user as Record<string, unknown>)
        : {};

    const rawId = String(memberObj.userId ?? memberObj.id ?? memberObj._id ?? `m_${idx}`);
    const email = String(memberObj.email ?? nestedUser.email ?? "");
    const isCurrentUser =
      memberObj.isCurrentUser === true ||
      rawId === "you" ||
      rawId === "current_user" ||
      (Boolean(currentUserEmail) && email.trim().toLowerCase() === currentUserEmail);

    return {
      id: rawId,
      name: String(
        memberObj.name ??
          memberObj.fullName ??
          nestedUser.name ??
          nestedUser.fullName ??
          (isCurrentUser ? "You" : `Member ${idx + 1}`)
      ),
      email,
      isCurrentUser,
      role: String(memberObj.role || "MEMBER").toUpperCase() === "ADMIN" ? "ADMIN" : "MEMBER",
      netBalance: Number(memberObj.netBalance ?? memberObj.balance ?? 0) || 0,
    };
  });

  const rawExpenses = Array.isArray(raw.expenses)
    ? raw.expenses
    : Array.isArray(raw.recentExpenses)
      ? raw.recentExpenses
      : [];

  const recentExpenses: GroupExpenseSummary[] = rawExpenses.map((e, idx) => {
    const expObj = (e && typeof e === "object" ? e : {}) as Record<string, unknown>;
    const amount = Number(expObj.amount ?? expObj.totalAmount ?? 0) || 0;
    return {
      id: String(expObj.id ?? expObj._id ?? `ge_${idx}`),
      title: String(expObj.title ?? expObj.description ?? "Expense"),
      paidById: expObj.paidByMemberId || expObj.paidById
        ? String(expObj.paidByMemberId ?? expObj.paidById)
        : undefined,
      paidBy: String(expObj.paidByName ?? expObj.paidBy ?? "Member"),
      amount,
      yourShare:
        expObj.yourShare !== undefined ? Number(expObj.yourShare) || 0 : undefined,
      splitType: String(expObj.splitType ?? expObj.splitMethod ?? "EQUAL"),
      date: String(expObj.date ?? expObj.createdAt ?? ""),
    };
  });

  const computedSpend = recentExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalSpend =
    raw.totalSpend !== undefined ? Number(raw.totalSpend) || 0 : computedSpend;
  const computedMyShare = recentExpenses.reduce(
    (sum, expense) =>
      sum +
      (typeof expense.yourShare === "number"
        ? expense.yourShare
        : expense.amount / Math.max(1, members.length)),
    0,
  );
  return {
    id,
    name: String(raw.name ?? "Untitled Group"),
    description: String(raw.description ?? "Shared group expenses"),
    type: normalizeGroupType(raw.type),
    customTypeLabel: raw.customTypeLabel ? String(raw.customTypeLabel) : undefined,
    currency: String(raw.currency ?? "INR"),
    simplifyDebts: raw.simplifyDebts !== false,
    totalSpend,
    myTotalShare:
      raw.myTotalShare !== undefined
        ? Number(raw.myTotalShare) || 0
        : Math.round(computedMyShare * 100) / 100,
    members:
      members.length > 0
        ? members
        : [{
            id: "you",
            name: "You",
            email: "",
            isCurrentUser: true,
            role: "ADMIN",
            netBalance: 0,
          }],
    recentExpenses,
  };
}

function computeGroupTransfers(group: GroupItem) {
  const debtors = group.members
    .filter((m) => m.netBalance < 0)
    .map((m) => ({ id: m.id, name: m.name, amount: Math.abs(m.netBalance) }))
    .sort((a, b) => b.amount - a.amount);

  const creditors = group.members
    .filter((m) => m.netBalance > 0)
    .map((m) => ({ id: m.id, name: m.name, amount: m.netBalance }))
    .sort((a, b) => b.amount - a.amount);

  const transfers: Array<{
    fromId: string;
    from: string;
    toId: string;
    to: string;
    amount: number;
  }> = [];

  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].amount, creditors[j].amount);
    if (pay > 0.009) {
      transfers.push({
        fromId: debtors[i].id,
        from: debtors[i].name,
        toId: creditors[j].id,
        to: creditors[j].name,
        amount: Math.round(pay * 100) / 100,
      });
    }
    debtors[i].amount -= pay;
    creditors[j].amount -= pay;
    if (debtors[i].amount < 0.01) i++;
    if (creditors[j].amount < 0.01) j++;
  }

  return transfers;
}

function getPersonalGroupSpend(group: GroupItem) {
  return {
    yourShare: group.myTotalShare,
  };
}

export default function GroupsPage() {
  const navigate = useNavigate();

  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [submittingGroup, setSubmittingGroup] = useState<boolean>(false);

  // Filter & Sort States
  const [selectedType, setSelectedType] = useState<"ALL" | GroupType>("ALL");
  const [balanceFilter, setBalanceFilter] = useState<BalanceFilter>("ALL");
  const [sortBy, setSortBy] = useState<SortOption>("DEFAULT");

  // Balance & Filter Modal States
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [draftType, setDraftType] = useState<"ALL" | GroupType>("ALL");
  const [draftBalance, setDraftBalance] = useState<BalanceFilter>("ALL");
  const [draftSort, setDraftSort] = useState<SortOption>("DEFAULT");

  // Create Group Modal States
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newType, setNewType] = useState<GroupType>("TRIP");
  const [customCategoryName, setCustomCategoryName] = useState("");
  const [newCurrency, setNewCurrency] = useState("INR");
  const [newSimplify, setNewSimplify] = useState(true);
  const [newInviteEmails, setNewInviteEmails] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  // Share Modal States
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [generatingToken, setGeneratingToken] = useState(false);

  // Edit Group Modal States
  const [editOpen, setEditOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<GroupItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editType, setEditType] = useState<GroupType>("TRIP");
  const [editCustomLabel, setEditCustomLabel] = useState("");
  const [editCurrency, setEditCurrency] = useState("INR");
  const [editSimplify, setEditSimplify] = useState(true);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  async function handleEditGroupClick(group: GroupItem) {
    setEditingGroup(group);
    setEditName(group.name);
    setEditDesc(group.description);
    setEditType(group.type);
    setEditCustomLabel(group.customTypeLabel || "");
    setEditCurrency(group.currency);
    setEditSimplify(group.simplifyDebts);
    setEditError(null);
    setEditOpen(true);
  }

  async function handleUpdateGroup() {
    if (!editingGroup || editSubmitting) return;

    if (!editName.trim()) {
      setEditError("Group name is required.");
      return;
    }
    if (editType === "CUSTOM" && !editCustomLabel.trim()) {
      setEditError("Custom group type label is required.");
      return;
    }

    setEditSubmitting(true);
    setEditError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/groups/${encodeURIComponent(editingGroup.id)}`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: editName.trim(),
          description: editDesc.trim(),
          type: editType,
          ...(editType === "CUSTOM" ? { customTypeLabel: editCustomLabel.trim() } : {}),
          currency: editCurrency,
          simplifyDebts: editSimplify,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.message || "Failed to update group.");
      }

      const updatedRaw = payload.data as Record<string, unknown>;
      const updated = normalizeGroupFromApi(updatedRaw);
      setGroups((prev) => prev.map((g) => (g.id === editingGroup.id ? updated : g)));
      setEditOpen(false);
      setEditingGroup(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Failed to update group.");
    } finally {
      setEditSubmitting(false);
    }
  }

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/groups`, {
        headers: getAuthHeaders(),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.message || "Failed to load groups from server.");
      }
      const list = Array.isArray(payload.data)
        ? payload.data
        : Array.isArray(payload)
          ? payload
          : [];
      setGroups(list.map((item: Record<string, unknown>) => normalizeGroupFromApi(item)));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : `Could not connect to backend at ${API_BASE_URL}.`
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedType !== "ALL") count++;
    if (balanceFilter !== "ALL") count++;
    if (sortBy !== "DEFAULT") count++;
    return count;
  }, [selectedType, balanceFilter, sortBy]);

  function openFilterModal() {
    setDraftType(selectedType);
    setDraftBalance(balanceFilter);
    setDraftSort(sortBy);
    setFilterModalOpen(true);
  }

  function applyFilterModal() {
    setSelectedType(draftType);
    setBalanceFilter(draftBalance);
    setSortBy(draftSort);
    setFilterModalOpen(false);
  }

  function resetAllFilters() {
    setSelectedType("ALL");
    setBalanceFilter("ALL");
    setSortBy("DEFAULT");
    setDraftType("ALL");
    setDraftBalance("ALL");
    setDraftSort("DEFAULT");
    setFilterModalOpen(false);
  }

  const overallSummary = useMemo(() => {
    let totalToReceive = 0;
    let totalToGive = 0;
    let totalMyPersonalSpend = 0;

    groups.forEach((grp) => {
      const me = grp.members.find((member) => member.isCurrentUser);
      const bal = me?.netBalance ?? 0;
      if (bal > 0) totalToReceive += bal;
      if (bal < 0) totalToGive += Math.abs(bal);

      const { yourShare } = getPersonalGroupSpend(grp);
      totalMyPersonalSpend += yourShare;
    });

    const netBalance = totalToReceive - totalToGive;
    return {
      totalToReceive,
      totalToGive,
      netBalance,
      totalMyPersonalSpend: Math.round(totalMyPersonalSpend * 100) / 100,
    };
  }, [groups]);

  const filteredGroups = useMemo(() => {
    const filtered = groups.filter((g) => {
      const matchesType = selectedType === "ALL" || g.type === selectedType;

      const me = g.members.find((member) => member.isCurrentUser);
      const myBal = me?.netBalance ?? 0;
      const matchesBalance =
        balanceFilter === "ALL" ||
        (balanceFilter === "TO_RECEIVE" && myBal > 0.01) ||
        (balanceFilter === "TO_GIVE" && myBal < -0.01) ||
        (balanceFilter === "SETTLED" && Math.abs(myBal) <= 0.01);

      return matchesType && matchesBalance;
    });

    if (sortBy === "DEFAULT") return filtered;

    return [...filtered].sort((a, b) => {
      if (sortBy === "MY_SPEND_DESC") {
        return getPersonalGroupSpend(b).yourShare - getPersonalGroupSpend(a).yourShare;
      }
      if (sortBy === "GROUP_SPEND_DESC") {
        return b.totalSpend - a.totalSpend;
      }
      const balA = Math.abs(a.members.find((member) => member.isCurrentUser)?.netBalance ?? 0);
      const balB = Math.abs(b.members.find((member) => member.isCurrentUser)?.netBalance ?? 0);
      return balB - balA;
    });
  }, [groups, selectedType, balanceFilter, sortBy]);

  async function handleCreateGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim() || submittingGroup) return;
    if (newType === "CUSTOM" && !customCategoryName.trim()) return;

    const inviteEmails = [...new Set(newInviteEmails
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean))];
    const members = inviteEmails.map((email) => ({
      name: email.split("@")[0],
      email,
      role: "MEMBER" as const,
    }));

    setSubmittingGroup(true);
    setError(null);
    setCreateError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/groups`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: newName.trim(),
          description: newDesc.trim() || "Shared group expenses",
          type: newType,
          ...(newType === "CUSTOM" ? { customTypeLabel: customCategoryName.trim() } : {}),
          currency: newCurrency,
          simplifyDebts: newSimplify,
          members,
        }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.message || "Failed to create group.");
      }

      const createdRaw =
        payload.data && typeof payload.data === "object"
          ? (payload.data as Record<string, unknown>)
          : (payload as Record<string, unknown>);
      const created = normalizeGroupFromApi(createdRaw);

      setGroups((prev) => [created, ...prev]);
      setNewName("");
      setNewDesc("");
      setCustomCategoryName("");
      setNewInviteEmails("");
      setCreateOpen(false);
      navigate(`/groups/${created.id}`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create group.");
    } finally {
      setSubmittingGroup(false);
    }
  }

  async function handleGenerateShareToken(groupId: string) {
    setGeneratingToken(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/groups/${encodeURIComponent(groupId)}/share-token`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ ttlHours: 24 }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.message || "Failed to generate share link.");
      }
      setShareToken(payload.data.token);
      setShareModalOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate share link.");
    } finally {
      setGeneratingToken(false);
    }
  }

  return (
    <AppLayout
      title="My Groups & Balances"
      subtitle="Track your personal share, group totals, and simplified settlements across every group"
      headerActions={
        <button
          onClick={() => {
            setCreateError(null);
            setCreateOpen(true);
          }}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 text-xs font-semibold text-white shadow-xs transition hover:bg-indigo-700 cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          Create Group
        </button>
      }
    >
      <div className="space-y-6">
        {/* Error Banner */}
        {error && (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={fetchGroups}
              className="rounded-lg bg-rose-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-rose-700 cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {/* 4-CARD OVERALL GROUPS FINANCIAL SUMMARY BANNER (COMPACT 2x2 ON MOBILE) */}
        <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
          <div className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-2xs sm:rounded-2xl sm:p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between gap-1.5">
              <span className="truncate text-[10px] font-bold uppercase tracking-wider text-slate-600 sm:text-xs dark:text-zinc-300">
                Your Spend
              </span>
              <span className="hidden h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-700 sm:flex dark:bg-zinc-800 dark:text-zinc-300">
                <Receipt className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-1.5 font-display text-base font-extrabold text-slate-900 tabular-nums sm:mt-2.5 sm:text-2xl dark:text-white">
              {formatINR(overallSummary.totalMyPersonalSpend)}
            </p>
            <p className="mt-0.5 truncate text-[10px] text-slate-500 sm:mt-1 sm:text-xs dark:text-zinc-400">
              Your share across {groups.length} groups
            </p>
          </div>

          <div className="rounded-xl border border-rose-200/80 bg-white p-3 shadow-2xs sm:rounded-2xl sm:p-5 dark:border-rose-900/50 dark:bg-zinc-900">
            <div className="flex items-center justify-between gap-1.5">
              <span className="truncate text-[10px] font-bold uppercase tracking-wider text-rose-600 sm:text-xs dark:text-rose-400">
                To Give
              </span>
              <span className="hidden h-8 w-8 items-center justify-center rounded-xl bg-rose-50 text-rose-600 sm:flex dark:bg-rose-950 dark:text-rose-400">
                <ArrowUpRight className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-1.5 font-display text-base font-extrabold text-rose-600 tabular-nums sm:mt-2.5 sm:text-2xl dark:text-rose-400">
              {formatINR(overallSummary.totalToGive)}
            </p>
            <p className="mt-0.5 truncate text-[10px] text-slate-500 sm:mt-1 sm:text-xs dark:text-zinc-400">
              Total you owe in groups
            </p>
          </div>

          <div className="rounded-xl border border-emerald-200/80 bg-white p-3 shadow-2xs sm:rounded-2xl sm:p-5 dark:border-emerald-900/50 dark:bg-zinc-900">
            <div className="flex items-center justify-between gap-1.5">
              <span className="truncate text-[10px] font-bold uppercase tracking-wider text-emerald-600 sm:text-xs dark:text-emerald-400">
                To Receive
              </span>
              <span className="hidden h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 sm:flex dark:bg-emerald-950 dark:text-emerald-400">
                <ArrowDownLeft className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-1.5 font-display text-base font-extrabold text-emerald-600 tabular-nums sm:mt-2.5 sm:text-2xl dark:text-emerald-400">
              {formatINR(overallSummary.totalToReceive)}
            </p>
            <p className="mt-0.5 truncate text-[10px] text-slate-500 sm:mt-1 sm:text-xs dark:text-zinc-400">
              Total friends owe you
            </p>
          </div>

          <div className="rounded-xl border border-indigo-200/80 bg-white p-3 shadow-2xs sm:rounded-2xl sm:p-5 dark:border-indigo-900/50 dark:bg-zinc-900">
            <div className="flex items-center justify-between gap-1.5">
              <span className="truncate text-[10px] font-bold uppercase tracking-wider text-indigo-600 sm:text-xs dark:text-indigo-400">
                Net Position
              </span>
              <span className="hidden h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 sm:flex dark:bg-indigo-950 dark:text-indigo-400">
                <Scale className="h-4 w-4" />
              </span>
            </div>
            <p
              className={`mt-1.5 truncate font-display text-base font-extrabold tabular-nums sm:mt-2.5 sm:text-2xl ${
                overallSummary.netBalance > 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : overallSummary.netBalance < 0
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-slate-800 dark:text-zinc-200"
              }`}
            >
              {overallSummary.netBalance > 0
                ? `+${formatINR(overallSummary.netBalance)}`
                : overallSummary.netBalance < 0
                  ? `-${formatINR(Math.abs(overallSummary.netBalance))}`
                  : "₹0.00"}
            </p>
            <p className="mt-0.5 truncate text-[10px] text-slate-500 sm:mt-1 sm:text-xs dark:text-zinc-400">
              {overallSummary.netBalance > 0
                ? "Net receivable"
                : overallSummary.netBalance < 0
                  ? "Net payable"
                  : "All settled"}
            </p>
          </div>
        </section>

        {/* BALANCE/FILTER MODAL TRIGGER */}
        <div className="flex justify-end">
          <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={resetAllFilters}
                className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset
              </button>
            )}

            <button
              type="button"
              onClick={openFilterModal}
              className={`inline-flex h-10 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl border px-4 text-xs font-semibold transition sm:flex-none cursor-pointer ${
                activeFilterCount > 0
                  ? "border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Balance &amp; Filters</span>
              {activeFilterCount > 0 && (
                <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 px-1.5 text-[10px] font-bold text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* LOADING / EMPTY / GROUP CARDS GRID */}
        {loading ? (
          <div className="flex items-center justify-center rounded-3xl border border-slate-200 bg-white p-12 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center gap-2.5 text-sm font-medium text-slate-600 dark:text-zinc-300">
              <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
              <span>Loading groups from database...</span>
            </div>
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <FolderKanban className="mx-auto h-10 w-10 text-slate-400" />
            <h2 className="mt-3 font-display text-lg font-bold text-slate-900 dark:text-white">
              {activeFilterCount > 0 ? "No matching groups found" : "No groups yet"}
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
              {activeFilterCount > 0
                ? "Try resetting your filters or create a new group."
                : "Create your first group to start splitting expenses."}
            </p>
            {activeFilterCount > 0 ? (
              <button
                onClick={resetAllFilters}
                className="mt-5 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 cursor-pointer"
              >
                <RotateCcw className="h-4 w-4" />
                Reset All Filters
              </button>
            ) : (
              <button
                onClick={() => setCreateOpen(true)}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                Create First Group
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredGroups.map((group) => {
              const myMember = group.members.find((member) => member.isCurrentUser);
              const myBalance = myMember?.netBalance ?? 0;
              const transfers = computeGroupTransfers(group);
              const myGiveTransfers = transfers.filter((t) => t.fromId === myMember?.id);
              const myReceiveTransfers = transfers.filter((t) => t.toId === myMember?.id);
              const personalSpend = getPersonalGroupSpend(group);

              const badgeText =
                group.type === "CUSTOM" && group.customTypeLabel
                  ? group.customTypeLabel
                  : TYPE_LABELS[group.type];

              return (
                <div
                  key={group.id}
                  onClick={() => navigate(`/groups/${group.id}`)}
                  className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xs transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-indigo-700 cursor-pointer"
                >
                  <div
                    className={`h-1.5 w-full ${
                      myBalance > 0
                        ? "bg-emerald-500"
                        : myBalance < 0
                          ? "bg-rose-500"
                          : "bg-slate-200 dark:bg-zinc-800"
                    }`}
                  />

                  <div className="flex flex-1 flex-col justify-between p-5">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                          {group.type === "CUSTOM" && <Tag className="h-3 w-3" />}
                          {badgeText}
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-zinc-400">
                          <Users className="h-3.5 w-3.5" />
                          {group.members.length} members
                        </span>
                      </div>

                      <h2 className="mt-3 font-display text-lg font-bold text-slate-900 group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-400">
                        {group.name}
                      </h2>
                      <p className="mt-1 line-clamp-1 text-xs text-slate-500 dark:text-zinc-400">
                        {group.description}
                      </p>

                      {/* Personal share and total spend for this group */}
                      <div className="mt-3.5 grid grid-cols-2 gap-2 rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 dark:border-zinc-800 dark:bg-zinc-950/60">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Your Spend (Share)
                          </p>
                          <p className="mt-0.5 font-display text-sm font-extrabold text-slate-900 tabular-nums dark:text-white">
                            {formatINR(personalSpend.yourShare, group.currency)}
                          </p>
                        </div>
                        <div className="border-l border-slate-200/80 pl-2.5 dark:border-zinc-800">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Total Group Spend
                          </p>
                          <p className="mt-0.5 font-display text-sm font-extrabold text-indigo-600 tabular-nums dark:text-indigo-400">
                            {formatINR(group.totalSpend, group.currency)}
                          </p>
                        </div>
                      </div>

                      {/* Net Settlement Status Box */}
                      <div
                        className={`mt-3 rounded-xl border p-3 ${
                          myBalance > 0
                            ? "border-emerald-200/80 bg-emerald-50/70 dark:border-emerald-900/50 dark:bg-emerald-950/30"
                            : myBalance < 0
                              ? "border-rose-200/80 bg-rose-50/70 dark:border-rose-900/50 dark:bg-rose-950/30"
                              : "border-slate-200/80 bg-slate-50/80 dark:border-zinc-800 dark:bg-zinc-950/60"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-300">
                            {myBalance > 0
                              ? "You Will Receive"
                              : myBalance < 0
                                ? "You Need to Give"
                                : "Your Group Status"}
                          </span>
                          <span
                            className={`font-display text-sm font-extrabold tabular-nums ${
                              myBalance > 0
                                ? "text-emerald-600 dark:text-emerald-400"
                                : myBalance < 0
                                  ? "text-rose-600 dark:text-rose-400"
                                  : "text-slate-600 dark:text-zinc-400"
                            }`}
                          >
                            {myBalance > 0
                              ? formatINR(myBalance, group.currency)
                              : myBalance < 0
                                ? formatINR(Math.abs(myBalance), group.currency)
                                : "Settled Up"}
                          </span>
                        </div>

                        {myGiveTransfers.length > 0 && (
                          <div className="mt-2 space-y-1 border-t border-rose-200/60 pt-2 text-[11px] text-rose-700 dark:border-rose-900/40 dark:text-rose-300">
                            {myGiveTransfers.map((t, idx) => (
                              <div key={idx} className="flex justify-between">
                                <span>Give to {t.to}</span>
                                <span className="font-bold tabular-nums">
                                  {formatINR(t.amount, group.currency)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        {myReceiveTransfers.length > 0 && (
                          <div className="mt-2 space-y-1 border-t border-emerald-200/60 pt-2 text-[11px] text-emerald-700 dark:border-emerald-900/40 dark:text-emerald-300">
                            {myReceiveTransfers.map((t, idx) => (
                              <div key={idx} className="flex justify-between">
                                <span>From {t.from}</span>
                                <span className="font-bold tabular-nums">
                                  +{formatINR(t.amount, group.currency)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs dark:border-zinc-800">
                      <span className="ml-auto font-semibold text-indigo-600 group-hover:underline dark:text-indigo-400">
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditGroupClick(group);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 cursor-pointer"
                          aria-label="Edit group"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleGenerateShareToken(group.id);
                          }}
                          disabled={generatingToken}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 cursor-pointer disabled:opacity-50"
                          aria-label="Share group"
                        >
                          <Share2 className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">{generatingToken ? "..." : "Share"}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* BALANCE & FILTER MODAL */}
      {filterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-xs sm:items-center sm:p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="group-filter-title"
            className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-slate-200 bg-white p-4 shadow-2xl sm:rounded-3xl sm:p-6 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-zinc-800">
              <div className="flex min-w-0 items-center gap-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
                  <Filter className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <h3
                    id="group-filter-title"
                    className="font-display text-base font-bold text-slate-900 dark:text-white"
                  >
                    Balance &amp; Group Filters
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                    Filter groups by balance, category, or sort order
                  </p>
                </div>
              </div>

              <button
                type="button"
                aria-label="Close filters"
                onClick={() => setFilterModalOpen(false)}
                className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 space-y-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                  Your Balance Status
                </label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {[
                    { id: "ALL" as BalanceFilter, label: "All Balances" },
                    { id: "TO_RECEIVE" as BalanceFilter, label: "You Will Receive" },
                    { id: "TO_GIVE" as BalanceFilter, label: "You Need to Give" },
                    { id: "SETTLED" as BalanceFilter, label: "Settled Up" },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setDraftBalance(item.id)}
                      className={`min-h-9 rounded-xl border px-2.5 py-2 text-xs font-semibold transition cursor-pointer ${
                        draftBalance === item.id
                          ? "border-indigo-600 bg-indigo-600 text-white shadow-2xs"
                          : "border-slate-200 bg-slate-50/70 text-slate-700 hover:bg-slate-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                  Group Category
                </label>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(["ALL", "TRIP", "ROOMMATE", "FRIENDS", "CUSTOM"] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setDraftType(tab)}
                      className={`min-h-8 rounded-xl border px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                        draftType === tab
                          ? "border-slate-900 bg-slate-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                          : "border-slate-200 bg-slate-50/70 text-slate-600 hover:bg-slate-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300"
                      }`}
                    >
                      {tab === "ALL" ? "All Categories" : TYPE_LABELS[tab]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label
                  htmlFor="group-sort-order"
                  className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400"
                >
                  <ArrowUpDown className="h-3.5 w-3.5 text-indigo-500" />
                  Sort Groups
                </label>
                <select
                  id="group-sort-order"
                  value={draftSort}
                  onChange={(e) => setDraftSort(e.target.value as SortOption)}
                  className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 cursor-pointer"
                >
                  <option value="DEFAULT">Default Order</option>
                  <option value="MY_SPEND_DESC">Highest Your Spend</option>
                  <option value="GROUP_SPEND_DESC">Highest Group Spend</option>
                  <option value="BALANCE_DESC">Highest Balance Due</option>
                </select>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between gap-2.5 border-t border-slate-100 pt-4 dark:border-zinc-800">
              <button
                type="button"
                onClick={resetAllFilters}
                className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50 sm:px-4 dark:border-zinc-800 dark:text-zinc-300 cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset All
              </button>

              <button
                type="button"
                onClick={applyFilterModal}
                className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 text-xs font-bold text-white shadow-xs transition hover:bg-indigo-700 sm:px-5 cursor-pointer"
              >
                <Check className="h-4 w-4" />
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE GROUP MODAL */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-xs sm:items-center sm:p-4">
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-slate-200 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl sm:p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-zinc-800">
              <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                Create New Group
              </h3>
              <button
                onClick={() => setCreateOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {createError && (
              <div
                role="alert"
                className="mt-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{createError}</p>
              </div>
            )}

            <form onSubmit={handleCreateGroup} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  Group Name
                </label>
                <input
                  required
                  placeholder="e.g. Manali Winter Trip"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-950"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                    Group Type
                  </label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as GroupType)}
                    className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-950"
                  >
                    <option value="TRIP">Trip</option>
                    <option value="ROOMMATE">Roommate</option>
                    <option value="FRIENDS">Friends</option>
                    <option value="CUSTOM">Custom</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                    Currency
                  </label>
                  <select
                    value={newCurrency}
                    onChange={(e) => setNewCurrency(e.target.value)}
                    className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-950"
                  >
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                  </select>
                </div>
              </div>

              {newType === "CUSTOM" && (
                <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-3 dark:border-indigo-800/60 dark:bg-indigo-950/30">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                    <Tag className="h-3.5 w-3.5" />
                    Custom Group Type Label
                  </label>
                  <input
                    required
                    placeholder="e.g. Office Lunch Club, Family Event, Sports Team"
                    value={customCategoryName}
                    onChange={(e) => setCustomCategoryName(e.target.value)}
                    className="mt-1.5 h-10 w-full rounded-xl border border-indigo-200 bg-white px-3 text-sm outline-none focus:border-indigo-500 dark:border-indigo-800 dark:bg-zinc-950"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  Description (Optional)
                </label>
                <input
                  placeholder="Hotels, food & cabs"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-950"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  Initial Member Emails (comma-separated)
                </label>
                <input
                  placeholder="rohan@example.com, ananya@example.com"
                  value={newInviteEmails}
                  onChange={(e) => {
                    setNewInviteEmails(e.target.value);
                    setCreateError(null);
                  }}
                  className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-950"
                />
                <p className="mt-1.5 text-xs text-slate-500 dark:text-zinc-400">
                  Only registered SplitMate users can be added.
                </p>
              </div>

              <label className="flex items-center justify-between rounded-xl border border-slate-200 p-3 dark:border-zinc-800 cursor-pointer">
                <div>
                  <p className="text-xs font-semibold text-slate-800 dark:text-zinc-200">
                    Simplify Group Debts
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                    Automatically minimize total repayments between members
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={newSimplify}
                  onChange={(e) => setNewSimplify(e.target.checked)}
                  className="h-4 w-4 rounded text-indigo-600"
                />
              </label>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600 dark:border-zinc-800 dark:text-zinc-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingGroup}
                  className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 cursor-pointer"
                >
                  {submittingGroup && <Loader2 className="h-4 w-4 animate-spin" />}
                  {submittingGroup ? "Creating..." : "Create Group"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT GROUP MODAL */}
      {editOpen && editingGroup && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-xs sm:items-center sm:p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-group-title"
            className="max-h-[92dvh] w-full max-w-lg overflow-hidden rounded-t-3xl border border-slate-200 bg-white shadow-2xl sm:rounded-3xl dark:border-zinc-800 dark:bg-zinc-900"
          >
            <header className="flex items-start justify-between gap-3 border-b border-slate-100 p-4 sm:p-5 dark:border-zinc-800">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
                  <Pencil className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h2 id="edit-group-title" className="truncate font-display text-base font-bold text-slate-900 dark:text-white">
                    Edit Group
                  </h2>
                  <p className="truncate text-xs text-slate-500 dark:text-zinc-400">
                    Update group details
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                aria-label="Close edit group"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="max-h-[calc(92dvh-4.5rem)] space-y-5 overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-5">
              {editError && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>{editError}</p>
                </div>
              )}

              <form onSubmit={handleUpdateGroup} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                    Group Name
                  </label>
                  <input
                    required
                    placeholder="e.g. Manali Winter Trip"
                    value={editName}
                    onChange={(e) => {
                      setEditName(e.target.value);
                      setEditError(null);
                    }}
                    className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-950"
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                      Group Type
                    </label>
                    <select
                      value={editType}
                      onChange={(e) => setEditType(e.target.value as GroupType)}
                      className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-950"
                    >
                      <option value="TRIP">Trip</option>
                      <option value="ROOMMATE">Roommate</option>
                      <option value="FRIENDS">Friends</option>
                      <option value="CUSTOM">Custom</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                      Currency
                    </label>
                    <select
                      value={editCurrency}
                      onChange={(e) => setEditCurrency(e.target.value)}
                      className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-950"
                    >
                      <option value="INR">INR (₹)</option>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                    </select>
                  </div>
                </div>

                {editType === "CUSTOM" && (
                  <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-3 dark:border-indigo-800/60 dark:bg-indigo-950/30">
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                      <Tag className="h-3.5 w-3.5" />
                      Custom Group Type Label
                    </label>
                    <input
                      required
                      placeholder="e.g. Office Lunch Club, Family Event, Sports Team"
                      value={editCustomLabel}
                      onChange={(e) => setEditCustomLabel(e.target.value)}
                      className="mt-1.5 h-10 w-full rounded-xl border border-indigo-200 bg-white px-3 text-sm outline-none focus:border-indigo-500 dark:border-indigo-800 dark:bg-zinc-950"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                    Description (Optional)
                  </label>
                  <input
                    placeholder="Hotels, food & cabs"
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-950"
                  />
                </div>

                <label className="flex items-center justify-between rounded-xl border border-slate-200 p-3 dark:border-zinc-800 cursor-pointer">
                  <div>
                    <p className="text-xs font-semibold text-slate-800 dark:text-zinc-200">
                      Simplify Group Debts
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                      Automatically minimize total repayments between members
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={editSimplify}
                    onChange={(e) => setEditSimplify(e.target.checked)}
                    className="h-4 w-4 rounded text-indigo-600"
                  />
                </label>

                <div className="flex justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditOpen(false)}
                    className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600 dark:border-zinc-800 dark:text-zinc-300 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={editSubmitting}
                    className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 cursor-pointer"
                  >
                    {editSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    {editSubmitting ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            </div>
          </section>
        </div>
      )}

      {/* SHARE MODAL */}
      <ShareModal
        groupId={shareToken ? "current" : ""}
        isOpen={shareModalOpen}
        setIsOpen={setShareModalOpen}
        token={shareToken ?? undefined}
      />
    </AppLayout>
  );
}