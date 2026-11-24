import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  CreditCard,
  Divide,
  FileText,
  FolderKanban,
  Loader2,
  Percent,
  Receipt,
  Scale,
  Sparkles,
  UserCheck,
  Users,
} from "lucide-react";
import AppLayout from "../components/AppLayout";

const API_BASE_URL =
  (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");

type SplitMethod = "EQUAL" | "EXACT" | "PERCENTAGE" | "SHARES";

interface MemberOption {
  id: string;
  name: string;
  email: string;
}

interface GroupOption {
  id: string;
  name: string;
  members: MemberOption[];
}

const PAYMENT_MODES = ["UPI", "Credit Card", "Debit Card", "Cash", "Bank Transfer"];

function formatINR(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function sanitizeDecimal(raw: string, maxDecimals = 2): string {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  const parts = cleaned.split(".");
  if (parts.length <= 1) return cleaned;
  return `${parts[0]}.${parts.slice(1).join("").slice(0, maxDecimals)}`;
}

function sanitizeSignedDecimal(raw: string, maxDecimals = 2): string {
  const isNegative = raw.trimStart().startsWith("-");
  const unsigned = sanitizeDecimal(raw, maxDecimals);
  return isNegative ? `-${unsigned}` : unsigned;
}

function preventWheelChange(e: React.WheelEvent<HTMLInputElement>) {
  e.currentTarget.blur();
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

function normalizeMembers(rawMembers: unknown): MemberOption[] {
  if (!Array.isArray(rawMembers)) return [];
  return rawMembers.map((m, idx) => {
    const obj = (m && typeof m === "object" ? m : {}) as Record<string, unknown>;
    const nestedUser =
      obj.user && typeof obj.user === "object"
        ? (obj.user as Record<string, unknown>)
        : {};
    const rawId = String(obj.userId ?? obj.id ?? obj._id ?? `m_${idx}`);
    const isCurrentUser =
      obj.isCurrentUser === true || rawId === "you" || rawId === "current_user";

    return {
      id: isCurrentUser ? "you" : rawId,
      name: String(
        obj.name ??
          obj.fullName ??
          nestedUser.name ??
          nestedUser.fullName ??
          (isCurrentUser ? "You" : `Member ${idx + 1}`)
      ),
      email: String(obj.email ?? nestedUser.email ?? ""),
    };
  });
}

function normalizeGroupOption(raw: Record<string, unknown>): GroupOption {
  const id = String(raw.id ?? raw._id ?? "");
  const members = normalizeMembers(raw.members);
  return {
    id,
    name: String(raw.name ?? "Untitled Group"),
    members:
      members.length > 0
        ? members
        : [{ id: "you", name: "You", email: "" }],
  };
}

export default function Expenses() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryGroupId = searchParams.get("groupId") || "";

  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [loadingGroups, setLoadingGroups] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submittingExpense, setSubmittingExpense] = useState<boolean>(false);

  // Core Form State
  const [title, setTitle] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [groupId, setGroupId] = useState<string>(queryGroupId || "non_group");
  const [paymentMethod, setPaymentMethod] = useState("UPI");
  const [expenseDate, setExpenseDate] = useState(() =>
    new Date().toISOString().split("T")[0]
  );
  const [notes, setNotes] = useState("");

  // Payer State (Single or Multi-Payer)
  const [isMultiPayer, setIsMultiPayer] = useState(false);
  const [singlePayerId, setSinglePayerId] = useState("you");
  const [multiPaidMap, setMultiPaidMap] = useState<Record<string, string>>({});

  // Split State
  const [splitMethod, setSplitMethod] = useState<SplitMethod>("EQUAL");
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>(["you"]);
  const [exactMap, setExactMap] = useState<Record<string, string>>({});
  const [percentMap, setPercentMap] = useState<Record<string, string>>({});
  const [sharesMap, setSharesMap] = useState<Record<string, string>>({});
  const [adjustMap, setAdjustMap] = useState<Record<string, string>>({});

  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  const loadUserGroups = useCallback(async () => {
    setLoadingGroups(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/groups`, {
        headers: getAuthHeaders(),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.message || "Failed to fetch your groups.");
      }

      const rawList = Array.isArray(payload.data)
        ? payload.data
        : Array.isArray(payload)
          ? payload
          : [];
      const fetchedGroups: GroupOption[] = rawList
        .map((item: Record<string, unknown>) => normalizeGroupOption(item))
        .filter((g: GroupOption) => Boolean(g.id));

      setGroups(fetchedGroups);

      const targetId =
        queryGroupId && fetchedGroups.some((g) => g.id === queryGroupId)
          ? queryGroupId
          : fetchedGroups[0]?.id || "non_group";

      setGroupId(targetId);

      const activeGroup = fetchedGroups.find((g) => g.id === targetId);
      if (activeGroup && activeGroup.members.length > 0) {
        setSelectedParticipantIds(activeGroup.members.map((m) => m.id));
      } else {
        setSelectedParticipantIds(["you"]);
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : `Could not connect to backend at ${API_BASE_URL}.`
      );
    } finally {
      setLoadingGroups(false);
    }
  }, [queryGroupId]);

  useEffect(() => {
    loadUserGroups();
  }, [loadUserGroups]);

  const selectedGroup = useMemo<GroupOption>(() => {
    if (groupId === "non_group") {
      return {
        id: "non_group",
        name: "1-on-1 (Non-group)",
        members: [{ id: "you", name: "You", email: "" }],
      };
    }
    return (
      groups.find((g) => g.id === groupId) ??
      groups[0] ?? {
        id: "non_group",
        name: "1-on-1 (Non-group)",
        members: [{ id: "you", name: "You", email: "" }],
      }
    );
  }, [groupId, groups]);

  async function handleSelectGroup(nextId: string) {
    setGroupId(nextId);
    setSearchParams(nextId === "non_group" ? {} : { groupId: nextId });
    setSinglePayerId("you");
    setMultiPaidMap({});
    setExactMap({});
    setPercentMap({});
    setSharesMap({});
    setAdjustMap({});

    if (nextId === "non_group") {
      setSelectedParticipantIds(["you"]);
      return;
    }

    const found = groups.find((g) => g.id === nextId);
    if (found && found.members.length > 1) {
      setSelectedParticipantIds(found.members.map((m) => m.id));
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/groups/${nextId}/members`, {
        headers: getAuthHeaders(),
      });
      const payload = await res.json().catch(() => ({}));
      if (res.ok) {
        const fetchedMembers = normalizeMembers(
          Array.isArray(payload.data) ? payload.data : payload
        );
        if (fetchedMembers.length > 0) {
          setGroups((prev) =>
            prev.map((g) => (g.id === nextId ? { ...g, members: fetchedMembers } : g))
          );
          setSelectedParticipantIds(fetchedMembers.map((m) => m.id));
          return;
        }
      }
    } catch {
      // fall back to cached group members
    }

    setSelectedParticipantIds(found ? found.members.map((m) => m.id) : ["you"]);
  }

  const totalPaise = useMemo(() => {
    const val = parseFloat(amountInput);
    return Number.isFinite(val) && val > 0 ? Math.round(val * 100) : 0;
  }, [amountInput]);

  const payerCheck = useMemo(() => {
    if (totalPaise === 0) {
      return { isValid: false, label: "Enter bill amount", list: [] };
    }

    if (!isMultiPayer) {
      const p =
        selectedGroup.members.find((m) => m.id === singlePayerId) ??
        selectedGroup.members[0];
      return {
        isValid: true,
        label: `${p.name} paid ${formatINR(totalPaise / 100)}`,
        list: [{ userId: p.id, name: p.name, paid: totalPaise / 100 }],
      };
    }

    const list = selectedGroup.members
      .map((m) => ({
        userId: m.id,
        name: m.name,
        paid: Math.max(0, parseFloat(multiPaidMap[m.id] || "0") || 0),
      }))
      .filter((x) => x.paid > 0);

    const paidPaise = Math.round(list.reduce((sum, x) => sum + x.paid * 100, 0));
    const diff = (totalPaise - paidPaise) / 100;

    return {
      isValid: diff === 0 && list.length > 0,
      label:
        diff === 0
          ? "Payer amounts match total"
          : diff > 0
            ? `${formatINR(diff)} left to assign`
            : `${formatINR(Math.abs(diff))} over total`,
      list,
    };
  }, [totalPaise, isMultiPayer, singlePayerId, multiPaidMap, selectedGroup.members]);

  const splitCheck = useMemo(() => {
    const participants: MemberOption[] = selectedGroup.members.filter((m) =>
      selectedParticipantIds.includes(m.id)
    );

    if (totalPaise === 0 || participants.length === 0) {
      return {
        isValid: false,
        hint: "Enter an amount and choose who is splitting",
        rows: [] as Array<{ id: string; name: string; owed: number }>,
      };
    }

    if (splitMethod === "EQUAL") {
      const base = Math.floor(totalPaise / participants.length);
      const rem = totalPaise % participants.length;
      const rows = participants.map((p, i) => ({
        id: p.id,
        name: p.name,
        owed: (base + (i < rem ? 1 : 0)) / 100,
      }));
      return {
        isValid: true,
        hint: `Equal split across ${participants.length} people`,
        rows,
      };
    }

    if (splitMethod === "EXACT") {
      const rows = participants.map((p) => ({
        id: p.id,
        name: p.name,
        owed: Math.max(0, parseFloat(exactMap[p.id] || "0") || 0),
      }));
      const sumPaise = Math.round(rows.reduce((s, r) => s + r.owed * 100, 0));
      const diff = (totalPaise - sumPaise) / 100;
      return {
        isValid: diff === 0,
        hint:
          diff === 0
            ? "Exact amounts match total"
            : diff > 0
              ? `${formatINR(diff)} remaining`
              : `${formatINR(Math.abs(diff))} over-allocated`,
        rows,
      };
    }

    if (splitMethod === "PERCENTAGE") {
      const pcts = participants.map((p) =>
        Math.max(0, parseFloat(percentMap[p.id] || "0") || 0)
      );
      const sumPct = Math.round(pcts.reduce((a, b) => a + b, 0) * 100) / 100;
      const rawPaise = pcts.map((pct) => Math.floor((totalPaise * pct) / 100));
      let rem = totalPaise - rawPaise.reduce((a, b) => a + b, 0);

      const rows = participants.map((p, i) => {
        const extra = rem > 0 ? 1 : 0;
        if (rem > 0) rem -= 1;
        return {
          id: p.id,
          name: p.name,
          owed: (rawPaise[i] + extra) / 100,
        };
      });

      return {
        isValid: sumPct === 100,
        hint:
          sumPct === 100
            ? "Percentages total 100%"
            : `Currently ${sumPct.toFixed(1)}% (needs 100%)`,
        rows,
      };
    }

    const adjs = participants.map((p) =>
      Math.round((parseFloat(adjustMap[p.id] || "0") || 0) * 100)
    );
    const poolPaise = totalPaise - adjs.reduce((a, b) => a + b, 0);
    if (poolPaise < 0) {
      return {
        isValid: false,
        hint: "Adjustments exceed bill amount",
        rows: participants.map((p) => ({ id: p.id, name: p.name, owed: 0 })),
      };
    }

    const shares = participants.map((p) => {
      const val = parseFloat(sharesMap[p.id] ?? "1");
      return Number.isFinite(val) && val >= 0 ? val : 1;
    });
    const totalShares = shares.reduce((a, b) => a + b, 0);
    if (totalShares <= 0) {
      return {
        isValid: false,
        hint: "Assign at least 1 share",
        rows: participants.map((p) => ({ id: p.id, name: p.name, owed: 0 })),
      };
    }

    const rawPaise = shares.map((s) => Math.floor((poolPaise * s) / totalShares));
    let rem = poolPaise - rawPaise.reduce((a, b) => a + b, 0);

    const rows = participants.map((p, i) => {
      const extra = rem > 0 ? 1 : 0;
      if (rem > 0) rem -= 1;
      return {
        id: p.id,
        name: p.name,
        owed: Math.max(0, adjs[i] + rawPaise[i] + extra) / 100,
      };
    });

    return {
      isValid: true,
      hint: `Split across ${totalShares} shares`,
      rows,
    };
  }, [
    selectedGroup.members,
    selectedParticipantIds,
    totalPaise,
    splitMethod,
    exactMap,
    percentMap,
    sharesMap,
    adjustMap,
  ]);

  const yourNetEffect = useMemo(() => {
    const youPaid = payerCheck.list.find((p) => p.userId === "you")?.paid ?? 0;
    const youOwed = splitCheck.rows.find((r) => r.id === "you")?.owed ?? 0;
    return Math.round((youPaid - youOwed) * 100) / 100;
  }, [payerCheck.list, splitCheck.rows]);

  function toggleMember(id: string) {
    setSelectedParticipantIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !payerCheck.isValid || !splitCheck.isValid || submittingExpense) {
      return;
    }

    setSubmittingExpense(true);
    setErrorMessage(null);

    const totalAmount = totalPaise / 100;
    const endpoint =
      groupId && groupId !== "non_group"
        ? `${API_BASE_URL}/api/v1/groups/${groupId}/expenses`
        : `${API_BASE_URL}/api/v1/expenses`;

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          title: title.trim(),
          amount: totalAmount,
          category: "Other",
          paymentMethod,
          date: expenseDate,
          splitType: splitMethod,
          payers: payerCheck.list.map((payer) => ({
            memberId: payer.userId,
            amount: payer.paid,
          })),
          splits: splitCheck.rows.map((participant) => ({
            memberId: participant.id,
            amount: participant.owed,
          })),
          notes: notes.trim() || undefined,
        }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.message || "Failed to save expense.");
      }

      setSuccessBanner(
        `Added "${title.trim()}" (${formatINR(totalAmount)}) to ${selectedGroup.name}`
      );
      if (groupId && groupId !== "non_group") {
        navigate(`/groups/${groupId}`);
      } else {
        navigate("/transactions");
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to save expense to server."
      );
    } finally {
      setSubmittingExpense(false);
    }
  }

  const readyToSave =
    Boolean(title.trim()) &&
    payerCheck.isValid &&
    splitCheck.isValid &&
    !submittingExpense;

  return (
    <AppLayout
      title="Add Expense"
      subtitle={`Adding bill to ${selectedGroup.name}`}
    >
      <div className="w-full">
        {errorMessage && (
          <div className="mb-6 flex items-center gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3.5 text-xs font-semibold text-rose-800 dark:border-rose-800/60 dark:bg-rose-950/50 dark:text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successBanner && (
          <div className="mb-6 flex items-center gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3.5 text-sm font-semibold text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-300">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
            <span>{successBanner}</span>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 gap-6 lg:grid-cols-12"
        >
          <div className="space-y-6 lg:col-span-7">
            <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
                <div className="sm:col-span-7">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                    What was this for?
                  </label>
                  <input
                    required
                    placeholder="e.g. Dinner at Fisherman's Wharf"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/60 px-4 text-base font-semibold text-slate-900 placeholder:font-normal placeholder:text-slate-400 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                  />
                </div>

                <div className="sm:col-span-5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                    Total Amount (₹)
                  </label>
                  <div className="relative mt-2">
                    <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 font-display text-lg font-extrabold text-indigo-600 dark:text-indigo-400">
                      ₹
                    </span>
                    <input
                      required
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={amountInput}
                      onWheel={preventWheelChange}
                      onChange={(e) => setAmountInput(sanitizeDecimal(e.target.value, 2))}
                      className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/60 pr-4 pl-9 font-display text-xl font-extrabold text-slate-900 tabular-nums outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-zinc-300">
                    <FolderKanban className="h-3.5 w-3.5 text-indigo-500" />
                    Group
                  </label>
                  <div className="relative mt-1.5">
                    <select
                      disabled={loadingGroups}
                      value={groupId}
                      onChange={(e) => handleSelectGroup(e.target.value)}
                      className="h-10 w-full appearance-none rounded-xl border border-indigo-200 bg-indigo-50/40 pr-9 pl-3 text-xs font-bold text-indigo-700 outline-none focus:border-indigo-500 dark:border-indigo-800/60 dark:bg-indigo-950/30 dark:text-indigo-300 cursor-pointer"
                    >
                      {groups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                      <option value="non_group">1-on-1 (Non-group)</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-3.5 w-3.5 -translate-y-1/2 text-indigo-500" />
                  </div>
                </div>

                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-zinc-300">
                    <CreditCard className="h-3.5 w-3.5 text-indigo-500" />
                    Paid Via
                  </label>
                  <div className="relative mt-1.5">
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-white pr-9 pl-3 text-xs font-semibold outline-none focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-950 cursor-pointer"
                    >
                      {PAYMENT_MODES.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  </div>
                </div>

                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-zinc-300">
                    <Calendar className="h-3.5 w-3.5 text-indigo-500" />
                    Date
                  </label>
                  <input
                    type="date"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold outline-none focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-950"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex flex-nowrap items-center justify-between gap-2 overflow-x-auto rounded-2xl border border-indigo-100 bg-indigo-50/60 p-3 sm:flex-wrap sm:gap-3 sm:p-4 dark:border-indigo-900/40 dark:bg-indigo-950/25">
                <div className="flex min-w-0 flex-nowrap items-center gap-1.5 whitespace-nowrap text-xs text-slate-700 sm:flex-wrap sm:gap-2 sm:text-sm dark:text-zinc-200">
                  <UserCheck className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
                  <span className="shrink-0">Paid by</span>
                  {!isMultiPayer ? (
                    <div className="relative inline-flex shrink-0 items-center">
                      <select
                        value={singlePayerId}
                        onChange={(e) => setSinglePayerId(e.target.value)}
                        className="h-7 max-w-[7.5rem] appearance-none truncate rounded-lg border border-indigo-200 bg-white pr-6 pl-2.5 text-[11px] font-bold leading-none text-indigo-700 outline-none transition hover:border-indigo-300 focus:border-indigo-500 sm:h-8 sm:max-w-none sm:pr-8 sm:pl-3 sm:text-xs dark:border-indigo-800 dark:bg-zinc-900 dark:text-indigo-300 cursor-pointer"
                      >
                        {selectedGroup.members.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute top-1/2 right-1.5 h-3 w-3 -translate-y-1/2 text-indigo-600 sm:right-2.5 sm:h-3.5 sm:w-3.5 dark:text-indigo-400" />
                    </div>
                  ) : (
                    <span className="inline-flex h-7 shrink-0 items-center rounded-lg bg-indigo-600 px-2.5 text-[11px] font-bold text-white sm:h-8 sm:px-3 sm:text-xs">
                      Multiple
                    </span>
                  )}
                  <span className="hidden sm:inline">and split</span>
                  <span className="hidden h-8 items-center rounded-lg bg-white px-3 text-xs font-bold text-indigo-700 shadow-2xs sm:inline-flex dark:bg-zinc-900 dark:text-indigo-300">
                    {splitMethod === "EQUAL"
                      ? "Equally"
                      : splitMethod === "EXACT"
                        ? "By Exact ₹"
                        : splitMethod === "PERCENTAGE"
                          ? "By %"
                          : "By Shares"}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setIsMultiPayer(!isMultiPayer)}
                  className="shrink-0 whitespace-nowrap text-[11px] font-semibold text-indigo-600 underline hover:no-underline sm:text-xs dark:text-indigo-400 cursor-pointer"
                >
                  {isMultiPayer ? "Single payer" : "Multiple payers?"}
                </button>
              </div>

              {isMultiPayer && (
                <div className="mt-4 space-y-2 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 dark:text-zinc-200">
                      Enter amount paid by each person
                    </span>
                    <span
                      className={`text-xs font-semibold ${
                        payerCheck.isValid ? "text-emerald-600" : "text-amber-600"
                      }`}
                    >
                      {payerCheck.label}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {selectedGroup.members.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900"
                      >
                        <span className="text-xs font-semibold text-slate-700 dark:text-zinc-200">
                          {m.name}
                        </span>
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="0.00"
                          value={multiPaidMap[m.id] ?? ""}
                          onWheel={preventWheelChange}
                          onChange={(e) =>
                            setMultiPaidMap((prev) => ({
                              ...prev,
                              [m.id]: sanitizeDecimal(e.target.value, 2),
                            }))
                          }
                          className="w-24 bg-transparent text-right text-xs font-bold tabular-nums outline-none"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { id: "EQUAL" as SplitMethod, label: "Equal", icon: Divide },
                  { id: "EXACT" as SplitMethod, label: "Exact ₹", icon: Receipt },
                  { id: "PERCENTAGE" as SplitMethod, label: "Percent %", icon: Percent },
                  { id: "SHARES" as SplitMethod, label: "Shares", icon: Scale },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const active = splitMethod === tab.id;
                  return (
                    <button
                      type="button"
                      key={tab.id}
                      onClick={() => setSplitMethod(tab.id)}
                      className={`flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-xs font-bold transition cursor-pointer ${
                        active
                          ? "border-indigo-600 bg-indigo-600 text-white shadow-xs"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 divide-y divide-slate-100 rounded-2xl border border-slate-200 dark:divide-zinc-800 dark:border-zinc-800">
                {selectedGroup.members.map((member) => {
                  const checked = selectedParticipantIds.includes(member.id);
                  const row = splitCheck.rows.find((r) => r.id === member.id);

                  return (
                    <div
                      key={member.id}
                      className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                    >
                      <button
                        type="button"
                        onClick={() => toggleMember(member.id)}
                        className="flex items-center gap-3 text-left cursor-pointer"
                      >
                        <span
                          className={`flex h-5 w-5 items-center justify-center rounded-md border transition ${
                            checked
                              ? "border-indigo-600 bg-indigo-600 text-white"
                              : "border-slate-300 bg-white dark:border-zinc-700 dark:bg-zinc-950"
                          }`}
                        >
                          {checked && <Check className="h-3.5 w-3.5" />}
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">
                            {member.name}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {checked ? `Share: ${formatINR(row?.owed ?? 0)}` : "Not included"}
                          </p>
                        </div>
                      </button>

                      {checked && splitMethod === "EQUAL" && (
                        <span className="font-mono text-sm font-bold text-slate-800 tabular-nums dark:text-zinc-200">
                          {formatINR(row?.owed ?? 0)}
                        </span>
                      )}

                      {checked && splitMethod === "EXACT" && (
                        <div className="relative w-28">
                          <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-xs text-slate-400">
                            ₹
                          </span>
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="0.00"
                            value={exactMap[member.id] ?? ""}
                            onWheel={preventWheelChange}
                            onChange={(e) =>
                              setExactMap((prev) => ({
                                ...prev,
                                [member.id]: sanitizeDecimal(e.target.value, 2),
                              }))
                            }
                            className="h-9 w-full rounded-lg border border-slate-200 bg-white pr-2.5 pl-6 text-right text-xs font-bold tabular-nums outline-none focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-950"
                          />
                        </div>
                      )}

                      {checked && splitMethod === "PERCENTAGE" && (
                        <div className="relative w-24">
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="25"
                            value={percentMap[member.id] ?? ""}
                            onWheel={preventWheelChange}
                            onChange={(e) =>
                              setPercentMap((prev) => ({
                                ...prev,
                                [member.id]: sanitizeDecimal(e.target.value, 2),
                              }))
                            }
                            className="h-9 w-full rounded-lg border border-slate-200 bg-white pr-6 pl-2.5 text-right text-xs font-bold tabular-nums outline-none focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-950"
                          />
                          <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-slate-400">
                            %
                          </span>
                        </div>
                      )}

                      {checked && splitMethod === "SHARES" && (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="1"
                            value={sharesMap[member.id] ?? "1"}
                            onWheel={preventWheelChange}
                            onChange={(e) =>
                              setSharesMap((prev) => ({
                                ...prev,
                                [member.id]: sanitizeDecimal(e.target.value, 2),
                              }))
                            }
                            className="h-9 w-16 rounded-lg border border-slate-200 bg-white px-2 text-center text-xs font-bold tabular-nums outline-none focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-950"
                          />
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="±₹0"
                            title="Optional +/- rupee adjustment"
                            value={adjustMap[member.id] ?? ""}
                            onWheel={preventWheelChange}
                            onChange={(e) =>
                              setAdjustMap((prev) => ({
                                ...prev,
                                [member.id]: sanitizeSignedDecimal(e.target.value, 2),
                              }))
                            }
                            className="h-9 w-20 rounded-lg border border-slate-200 bg-white px-2 text-right text-xs font-semibold tabular-nums outline-none focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-950"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-zinc-300">
                    <FileText className="h-3.5 w-3.5 text-indigo-500" />
                    Notes (Optional)
                  </label>
                  <input
                    placeholder="Add a short note or bill ref..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-950"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="sticky top-22 rounded-3xl border border-slate-200/90 bg-white p-6 shadow-md dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4 dark:border-zinc-800">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                    {selectedGroup.name} • {paymentMethod}
                  </span>
                  <h3 className="mt-1 font-display text-xl font-extrabold text-slate-900 dark:text-white">
                    {title.trim() || "New Expense"}
                  </h3>
                </div>
                <p className="font-display text-2xl font-extrabold text-indigo-600 tabular-nums dark:text-indigo-400">
                  {formatINR(totalPaise / 100)}
                </p>
              </div>

              {totalPaise > 0 && splitCheck.isValid && (
                <div
                  className={`mt-4 flex items-center justify-between rounded-2xl border p-3.5 ${
                    yourNetEffect >= 0
                      ? "border-emerald-200/80 bg-emerald-50/70 dark:border-emerald-900/50 dark:bg-emerald-950/30"
                      : "border-rose-200/80 bg-rose-50/70 dark:border-rose-900/50 dark:bg-rose-950/30"
                  }`}
                >
                  <span className="text-xs font-bold text-slate-700 dark:text-zinc-200">
                    {yourNetEffect >= 0 ? "You will get back" : "You will owe"}
                  </span>
                  <span
                    className={`font-display text-base font-extrabold tabular-nums ${
                      yourNetEffect >= 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-rose-600 dark:text-rose-400"
                    }`}
                  >
                    {formatINR(Math.abs(yourNetEffect))}
                  </span>
                </div>
              )}

              <div
                className={`mt-4 flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-semibold ${
                  splitCheck.isValid && payerCheck.isValid
                    ? "border-emerald-200 bg-emerald-50/60 text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-950/30 dark:text-emerald-300"
                    : "border-amber-200 bg-amber-50/60 text-amber-700 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-300"
                }`}
              >
                {splitCheck.isValid && payerCheck.isValid ? (
                  <Sparkles className="h-4 w-4 shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0" />
                )}
                <span>{splitCheck.hint}</span>
              </div>

              <div className="mt-4 space-y-2">
                <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <Users className="h-3.5 w-3.5" />
                  Split Breakdown ({splitCheck.rows.length})
                </p>
                {splitCheck.rows.length === 0 ? (
                  <p className="py-6 text-center text-xs text-slate-400">
                    Enter an amount on the left to see each person&apos;s share.
                  </p>
                ) : (
                  splitCheck.rows.map((row) => (
                    <div
                      key={row.id}
                      className="flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs dark:bg-zinc-950"
                    >
                      <span className="font-semibold text-slate-800 dark:text-zinc-200">
                        {row.name}
                      </span>
                      <span className="font-bold text-slate-900 tabular-nums dark:text-white">
                        {formatINR(row.owed)}
                      </span>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-6 space-y-2.5 border-t border-slate-100 pt-5 dark:border-zinc-800">
                <button
                  type="submit"
                  disabled={!readyToSave}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 text-sm font-bold text-white shadow-md shadow-indigo-600/20 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                >
                  {submittingExpense ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving Expense...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Save Expense
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}