import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  CreditCard,
  Divide,
  FileText,
  IndianRupee,
  Loader2,
  Percent,
  Plus,
  Receipt,
  StickyNote,
  Tag,
  Trash2,
  UserCheck,
  Users,
  X,
} from "lucide-react";

const API_BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");

export interface ExpenseAllocation {
  memberId: string;
  memberName: string;
  amount: number;
}

export interface EditableExpense {
  id: string;
  title: string;
  category: string;
  totalAmount: number;
  splitType: string;
  paymentMethod: string;
  date: string;
  notes?: string;
  paidById: string;
  payers: ExpenseAllocation[];
  splits: ExpenseAllocation[];
}

interface GroupMember {
  id: string;
  name: string;
}

interface EditExpenseModalProps {
  open: boolean;
  groupId: string;
  expense: EditableExpense;
  members: GroupMember[];
  currencyCode: string;
  onClose: () => void;
  onUpdated: () => Promise<void>;
}

interface AllocationInput {
  memberId: string;
  amount: string;
}

interface SplitRowState {
  memberId: string;
  included: boolean;
  amount: string;
  percent: string;
  shares: string;
}

function toCents(value: string | number): number {
  const num = Number(value);
  return Number.isFinite(num) ? Math.round(num * 100) : 0;
}

function preventWheelChange(e: React.WheelEvent<HTMLInputElement>) {
  e.currentTarget.blur();
}

function dividePaise(totalPaise: number, weights: number[]): number[] {
  if (totalPaise <= 0 || weights.length === 0) return weights.map(() => 0);
  const sumWeights = weights.reduce((a, b) => a + b, 0);
  if (sumWeights <= 0) return weights.map(() => 0);

  const raw = weights.map((w) => Math.floor((totalPaise * w) / sumWeights));
  let rem = totalPaise - raw.reduce((a, b) => a + b, 0);
  return raw.map((val) => {
    const extra = rem > 0 ? 1 : 0;
    if (rem > 0) rem -= 1;
    return val + extra;
  });
}

function syncPayers(payers: AllocationInput[], nextCents: number, nextAmountStr: string): AllocationInput[] {
  if (payers.length === 0) return payers;
  if (payers.length === 1) return [{ ...payers[0], amount: nextAmountStr }];

  const currentCents = payers.map((p) => Math.max(0, toCents(p.amount)));
  const currentSum = currentCents.reduce((a, b) => a + b, 0);
  const weights = currentSum > 0 ? currentCents : payers.map(() => 1);
  const nextParts = dividePaise(nextCents, weights);

  return payers.map((p, i) => ({
    ...p,
    amount: (nextParts[i] / 100).toFixed(2),
  }));
}

function applySplits(
  nextCents: number,
  mode: string,
  rows: SplitRowState[],
): SplitRowState[] {
  const activeIndices = rows
    .map((r, i) => (r.included ? i : -1))
    .filter((i) => i >= 0);

  if (activeIndices.length === 0 || nextCents <= 0) {
    return rows.map((r) => ({ ...r, amount: "0.00" }));
  }

  if (mode === "EXACT") {
    return rows.map((r) => ({ ...r, amount: r.included ? r.amount : "0.00" }));
  }

  const weights = activeIndices.map((idx) => {
    const r = rows[idx];
    if (mode === "PERCENTAGE") return Math.max(0, Number(r.percent) || 0);
    if (mode === "SHARES") return Math.max(0, Number(r.shares) || 0);
    return 1;
  });

  const allocated = dividePaise(nextCents, weights);
  const mapByIndex = new Map<number, number>();
  activeIndices.forEach((rowIdx, pos) => {
    mapByIndex.set(rowIdx, allocated[pos]);
  });

  return rows.map((r, idx) => ({
    ...r,
    amount: r.included ? ((mapByIndex.get(idx) ?? 0) / 100).toFixed(2) : "0.00",
  }));
}

function initSplits(expense: EditableExpense, members: GroupMember[]): SplitRowState[] {
  const totalAmount = Number(expense.totalAmount) || 0;
  const hasExisting = members.some((m) =>
    expense.splits.some((s) => s.memberId === m.id && Number(s.amount) > 0),
  );
  const includedCount = hasExisting
    ? Math.max(
        1,
        members.filter((m) => {
          const found = expense.splits.find((s) => s.memberId === m.id);
          return found && Number(found.amount) > 0;
        }).length,
      )
    : members.length;

  const equalParts = dividePaise(
    toCents(totalAmount),
    Array.from({ length: includedCount }, () => 1),
  );
  let eqIdx = 0;

  return members.map((m) => {
    const found = expense.splits.find((s) => s.memberId === m.id);
    const existingAmt = found ? Number(found.amount) : 0;
    const included = hasExisting ? existingAmt > 0 : true;
    const amt = included
      ? existingAmt > 0
        ? existingAmt.toFixed(2)
        : ((equalParts[eqIdx++] ?? 0) / 100).toFixed(2)
      : "0.00";

    return {
      memberId: m.id,
      included,
      amount: amt,
      percent: included && totalAmount > 0 ? ((Number(amt) / totalAmount) * 100).toFixed(1) : "0",
      shares: included ? "1" : "0",
    };
  });
}

function initPayers(expense: EditableExpense): AllocationInput[] {
  const list =
    expense.payers.length > 0
      ? expense.payers
      : [{ memberId: expense.paidById, memberName: "", amount: expense.totalAmount }];
  return list.map((p) => ({
    memberId: p.memberId,
    amount: Number(p.amount).toFixed(2),
  }));
}

function toDateInput(value: string): string {
  const d = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : new Date().toISOString().slice(0, 10);
}

function getAuthHeaders(): HeadersInit {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = localStorage.getItem("splitmate_token");
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export default function EditExpenseModal({
  open,
  groupId,
  expense,
  members,
  currencyCode,
  onClose,
  onUpdated,
}: EditExpenseModalProps) {
  const navigate = useNavigate();
  const [title, setTitle] = useState(expense.title);
  const [amount, setAmount] = useState(Number(expense.totalAmount).toFixed(2));
  const [category, setCategory] = useState(expense.category);
  const [splitType, setSplitType] = useState(String(expense.splitType || "EQUAL").toUpperCase());
  const [paymentMethod, setPaymentMethod] = useState(expense.paymentMethod);
  const [date, setDate] = useState(toDateInput(expense.date));
  const [notes, setNotes] = useState(expense.notes || "");
  const [payers, setPayers] = useState<AllocationInput[]>(() => initPayers(expense));
  const [splitRows, setSplitRows] = useState<SplitRowState[]>(() => initSplits(expense, members));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(expense.title);
    setAmount(Number(expense.totalAmount).toFixed(2));
    setCategory(expense.category);
    setSplitType(String(expense.splitType || "EQUAL").toUpperCase());
    setPaymentMethod(expense.paymentMethod);
    setDate(toDateInput(expense.date));
    setNotes(expense.notes || "");
    setPayers(initPayers(expense));
    setSplitRows(initSplits(expense, members));
    setError(null);
  }, [expense, members, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const totalCents = toCents(amount);
  const payerTotalCents = payers.reduce((s, p) => s + toCents(p.amount), 0);
  const splitTotalCents = splitRows.reduce(
    (s, r) => (r.included ? s + toCents(r.amount) : s),
    0,
  );

  const payersMatch = totalCents > 0 && payerTotalCents === totalCents;
  const splitsMatch = totalCents > 0 && splitTotalCents === totalCents;
  const canSave = Boolean(title.trim()) && payersMatch && splitsMatch && !saving;
  const sym = currencyCode === "INR" ? "₹" : "";

  function onAmountChange(val: string) {
    setAmount(val);
    const cents = toCents(val);
    setPayers((prev) => syncPayers(prev, cents, val));
    setSplitRows((prev) => applySplits(cents, splitType, prev));
  }

  function onSplitTypeChange(nextType: string) {
    const mode = nextType.toUpperCase();
    setSplitType(mode);
    setSplitRows((prev) => applySplits(totalCents, mode, prev));
  }

  function onToggleMember(memberId: string) {
    setSplitRows((prev) => {
      const next = prev.map((r) => {
        if (r.memberId !== memberId) return r;
        const included = !r.included;
        return {
          ...r,
          included,
          shares: included ? (Number(r.shares) > 0 ? r.shares : "1") : "0",
          amount: included ? r.amount : "0.00",
        };
      });
      return applySplits(totalCents, splitType, next);
    });
  }

  function onSplitInput(memberId: string, field: "amount" | "percent" | "shares", val: string) {
    setSplitRows((prev) => {
      const updated = prev.map((r) => (r.memberId === memberId ? { ...r, [field]: val } : r));
      if (field === "percent" && splitType === "PERCENTAGE") {
        return applySplits(totalCents, "PERCENTAGE", updated);
      }
      if (field === "shares" && splitType === "SHARES") {
        return applySplits(totalCents, "SHARES", updated);
      }
      return updated;
    });
  }

  function onEqualAll() {
    setSplitType("EQUAL");
    setSplitRows((prev) =>
      applySplits(
        totalCents,
        "EQUAL",
        prev.map((r) => ({ ...r, included: true })),
      ),
    );
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(
        `${API_BASE_URL}/api/v1/groups/${encodeURIComponent(groupId)}/expenses/${encodeURIComponent(expense.id)}`,
        {
          method: "PATCH",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            title: title.trim(),
            amount: Number(amount),
            category: category.trim() || "Other",
            payers: payers.map((p) => ({ memberId: p.memberId, amount: Number(p.amount) })),
            splitType,
            paymentMethod,
            date,
            notes: notes.trim(),
            splits: splitRows.map((r) => ({
              memberId: r.memberId,
              amount: r.included ? Number(r.amount || 0) : 0,
            })),
          }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Unable to update this expense.");
      onClose();
      navigate(`/groups/${encodeURIComponent(groupId)}`, { replace: true });
      void onUpdated().catch((refreshError) => {
        console.error("Expense saved, but group details could not be refreshed:", refreshError);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update this expense.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="presentation"
      onMouseDown={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-expense-title"
        onMouseDown={(e) => e.stopPropagation()}
        className="max-h-[94dvh] w-full max-w-2xl overflow-hidden rounded-t-3xl border border-slate-200 bg-white shadow-2xl sm:rounded-3xl dark:border-zinc-800 dark:bg-zinc-900"
      >
        <header className="flex items-center justify-between gap-3 border-b border-slate-100 p-4 sm:p-5 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/70 dark:text-indigo-400">
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
                UPDATE BILL
              </p>
              <h2 id="edit-expense-title" className="font-display text-base font-extrabold sm:text-lg dark:text-white">
                Edit expense
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <form
          onSubmit={handleSubmit}
          className="max-h-[calc(94dvh-4.5rem)] space-y-5 overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6"
        >
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <div>
              <label htmlFor="edit-exp-title" className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                <FileText className="h-3.5 w-3.5 text-indigo-500" />
                <span>Description</span>
              </label>
              <input
                id="edit-exp-title"
                required
                maxLength={160}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 text-sm font-medium outline-none focus:border-indigo-500 focus:bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
              />
            </div>

            <div>
              <label htmlFor="edit-exp-amount" className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                <IndianRupee className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Amount ({currencyCode})</span>
              </label>
              <div className="relative mt-1.5">
                <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-xs font-extrabold text-indigo-600 dark:text-indigo-400">
                  {sym || currencyCode}
                </span>
                <input
                  id="edit-exp-amount"
                  required
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onWheel={preventWheelChange}
                  onChange={(e) => onAmountChange(e.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/70 pr-3.5 pl-9 font-display text-sm font-extrabold tabular-nums outline-none focus:border-indigo-500 focus:bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 sm:col-span-2 sm:gap-3.5">
              <div>
                <label htmlFor="edit-exp-category" className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                  <Tag className="h-3.5 w-3.5 text-indigo-500" />
                  <span>Category</span>
                </label>
                <input
                  id="edit-exp-category"
                  maxLength={80}
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 text-xs font-semibold outline-none focus:border-indigo-500 focus:bg-white sm:text-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                />
              </div>

              <div>
                <label htmlFor="edit-exp-date" className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                  <Calendar className="h-3.5 w-3.5 text-indigo-500" />
                  <span>Date</span>
                </label>
                <input
                  id="edit-exp-date"
                  required
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 text-xs font-semibold outline-none focus:border-indigo-500 focus:bg-white sm:text-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 sm:col-span-2 sm:gap-3.5">
              <div>
                <label htmlFor="edit-exp-split" className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                  <Percent className="h-3.5 w-3.5 text-indigo-500" />
                  <span>Split type</span>
                </label>
                <div className="relative mt-1.5">
                  <select
                    id="edit-exp-split"
                    value={splitType}
                    onChange={(e) => onSplitTypeChange(e.target.value)}
                    className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/70 pr-8 pl-3 text-xs font-semibold outline-none focus:border-indigo-500 focus:bg-white sm:text-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 cursor-pointer"
                  >
                    {["EQUAL", "EXACT", "PERCENTAGE", "SHARES"].map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>
              </div>

              <div>
                <label htmlFor="edit-exp-method" className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                  <CreditCard className="h-3.5 w-3.5 text-indigo-500" />
                  <span>Payment method</span>
                </label>
                <input
                  id="edit-exp-method"
                  maxLength={40}
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 text-xs font-semibold outline-none focus:border-indigo-500 focus:bg-white sm:text-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Paid By */}
          <section className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-3.5 sm:p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-200">
                  Paid by
                </h3>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums ${
                    payersMatch
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300"
                      : "bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300"
                  }`}
                >
                  {payersMatch && <CheckCircle2 className="h-3 w-3" />}
                  {(payerTotalCents / 100).toFixed(2)} / {(totalCents / 100).toFixed(2)}
                </span>
              </div>

              <button
                type="button"
                disabled={payers.length >= members.length}
                onClick={() => {
                  const nextMember = members.find((m) => !payers.some((p) => p.memberId === m.id));
                  if (!nextMember) return;
                  const rem = Math.max(0, totalCents - payerTotalCents);
                  setPayers((prev) => [...prev, { memberId: nextMember.id, amount: (rem / 100).toFixed(2) }]);
                }}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-indigo-200 bg-white px-2.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 disabled:opacity-40 dark:border-indigo-800/60 dark:bg-zinc-900 dark:text-indigo-400 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                Add payer
              </button>
            </div>

            <div className="space-y-2">
              {payers.map((payer, idx) => (
                <div key={`${idx}-${payer.memberId}`} className="flex items-center gap-2">
                  <div className="relative min-w-0 flex-1">
                    <select
                      value={payer.memberId}
                      onChange={(e) =>
                        setPayers((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, memberId: e.target.value } : item)),
                        )
                      }
                      className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-white pr-8 pl-3 text-xs font-semibold sm:text-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 cursor-pointer"
                    >
                      {members
                        .filter(
                          (m) =>
                            m.id === payer.memberId ||
                            !payers.some((other, i) => i !== idx && other.memberId === m.id),
                        )
                        .map((m) => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  </div>

                  <div className="relative w-28 sm:w-32">
                    <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-xs font-bold text-slate-400">
                      {sym}
                    </span>
                    <input
                      aria-label="Payer amount"
                      type="text"
                      inputMode="decimal"
                      value={payer.amount}
                      onWheel={preventWheelChange}
                      onChange={(e) =>
                        setPayers((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, amount: e.target.value } : item)),
                        )
                      }
                      className="h-10 w-full rounded-xl border border-slate-200 bg-white pr-2.5 pl-6 text-right text-xs font-bold tabular-nums sm:text-sm dark:border-zinc-800 dark:bg-zinc-900"
                    />
                  </div>

                  {payers.length > 1 && (
                    <button
                      type="button"
                      aria-label="Remove payer"
                      onClick={() =>
                        setPayers((prev) => syncPayers(prev.filter((_, i) => i !== idx), totalCents, amount))
                      }
                      className="flex h-10 w-9 items-center justify-center rounded-xl border border-rose-200 bg-rose-50/60 text-rose-600 hover:bg-rose-100 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-400 cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Split */}
          <section className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-3.5 sm:p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-200">
                  Split ({splitType})
                </h3>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums ${
                    splitsMatch
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300"
                      : "bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300"
                  }`}
                >
                  {splitsMatch && <CheckCircle2 className="h-3 w-3" />}
                  {(splitTotalCents / 100).toFixed(2)} / {(totalCents / 100).toFixed(2)}
                </span>
              </div>

              <button
                type="button"
                onClick={onEqualAll}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-indigo-200 bg-white px-2.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 dark:border-indigo-800/60 dark:bg-zinc-900 dark:text-indigo-400 cursor-pointer"
              >
                <Divide className="h-3.5 w-3.5" />
                Split equally
              </button>
            </div>

            <div className="divide-y divide-slate-200/70 rounded-xl border border-slate-200/80 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
              {members.map((member) => {
                const row = splitRows.find((r) => r.memberId === member.id);
                const included = row?.included ?? true;

                return (
                  <div key={member.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-xs sm:text-sm">
                    <button
                      type="button"
                      onClick={() => onToggleMember(member.id)}
                      className="flex min-w-0 flex-1 items-center gap-2.5 text-left cursor-pointer"
                    >
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                          included
                            ? "border-indigo-600 bg-indigo-600 text-white"
                            : "border-slate-300 bg-white dark:border-zinc-700 dark:bg-zinc-950"
                        }`}
                      >
                        {included && <Check className="h-3 w-3" />}
                      </span>
                      <span className={`truncate font-semibold ${included ? "text-slate-800 dark:text-zinc-200" : "text-slate-400 line-through"}`}>
                        {member.name}
                      </span>
                    </button>

                    {!included ? (
                      <span className="text-xs text-slate-400 tabular-nums">{sym}0.00</span>
                    ) : splitType === "EQUAL" ? (
                      <span className="font-mono text-xs font-bold tabular-nums sm:text-sm dark:text-white">
                        {sym}{row?.amount ?? "0.00"}
                      </span>
                    ) : splitType === "EXACT" ? (
                      <div className="relative w-28 sm:w-32">
                        <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-xs font-bold text-slate-400">{sym}</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={row?.amount ?? "0.00"}
                          onWheel={preventWheelChange}
                          onChange={(e) => onSplitInput(member.id, "amount", e.target.value)}
                          className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50/70 pr-2.5 pl-6 text-right text-xs font-bold tabular-nums sm:text-sm dark:border-zinc-800 dark:bg-zinc-950"
                        />
                      </div>
                    ) : splitType === "PERCENTAGE" ? (
                      <div className="flex items-center gap-2">
                        <span className="hidden text-xs font-bold text-indigo-600 tabular-nums sm:inline dark:text-indigo-400">
                          {sym}{row?.amount ?? "0.00"}
                        </span>
                        <div className="relative w-24">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={row?.percent ?? "0"}
                            onWheel={preventWheelChange}
                            onChange={(e) => onSplitInput(member.id, "percent", e.target.value)}
                            className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50/70 pr-6 pl-2 text-right text-xs font-bold tabular-nums sm:text-sm dark:border-zinc-800 dark:bg-zinc-950"
                          />
                          <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-xs text-slate-400">%</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="hidden text-xs font-bold text-indigo-600 tabular-nums sm:inline dark:text-indigo-400">
                          {sym}{row?.amount ?? "0.00"}
                        </span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={row?.shares ?? "1"}
                          onWheel={preventWheelChange}
                          onChange={(e) => onSplitInput(member.id, "shares", e.target.value)}
                          className="h-9 w-20 rounded-lg border border-slate-200 bg-slate-50/70 px-2 text-center text-xs font-bold tabular-nums sm:text-sm dark:border-zinc-800 dark:bg-zinc-950"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <div>
            <label htmlFor="edit-exp-notes" className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              <StickyNote className="h-3.5 w-3.5 text-indigo-500" />
              <span>Notes (Optional)</span>
            </label>
            <textarea
              id="edit-exp-notes"
              maxLength={2000}
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1.5 w-full resize-none rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs font-medium outline-none focus:border-indigo-500 focus:bg-white sm:text-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
            />
          </div>

          {error && (
            <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700 sm:text-sm dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2.5 border-t border-slate-100 pt-4 sm:flex sm:justify-end dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="h-11 rounded-xl border border-slate-200 px-4 text-xs font-semibold text-slate-600 hover:bg-slate-50 sm:text-sm dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSave}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-xs font-bold text-white shadow-md shadow-indigo-600/20 hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm cursor-pointer"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Save changes
                </>
              )}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}