import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpDown,
  ArrowUpRight,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Download,
  Filter,
  FolderKanban,
  Plus,
  Receipt,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Wallet,
  X,
} from "lucide-react";
import AppLayout from "../components/AppLayout";

type TxFilterTab = "ALL" | "PAID_BY_YOU" | "INVOLVED" | "SETTLED_UP";
type DateFilterOption = "ALL" | "TODAY" | "LAST_7_DAYS" | "THIS_MONTH" | "CUSTOM";
type KindFilterOption = "ALL" | "EXPENSE" | "SETTLEMENT";
type StatusFilterOption = "ALL" | "ACTIVE" | "COMPLETED" | "PENDING";
type TxSortOption = "RECENT" | "AMOUNT_DESC" | "AMOUNT_ASC" | "IMPACT_DESC";

interface LedgerEntry {
  id: string;
  kind: "EXPENSE" | "SETTLEMENT";
  title: string;
  groupName: string;
  category: string;
  paidBy: string;
  paidByYou: boolean;
  paidByYouAmount?: number;
  totalAmount: number;
  yourShare: number;
  netImpact: number; // +ve = lent / received, -ve = borrowed / paid out
  splitType?: string;
  paymentMethod: string;
  referenceId?: string;
  status: "ACTIVE" | "COMPLETED" | "PENDING";
  date: string;
  notes?: string;
}

function formatINR(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function parseTransactionDate(dateStr: string): Date | null {
  const clean = dateStr.trim().toLowerCase();
  const now = new Date();
  if (clean === "today" || clean === "just now") {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  if (clean === "yesterday") {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  }
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

const API_BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");

export default function TransactionPage() {
  const [activeTab, setActiveTab] = useState<TxFilterTab>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("ALL");
  const [kindFilter, setKindFilter] = useState<KindFilterOption>("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilterOption>("ALL");
  const [dateFilter, setDateFilter] = useState<DateFilterOption>("ALL");
  const [customFromDate, setCustomFromDate] = useState("");
  const [customToDate, setCustomToDate] = useState("");
  const [sortBy, setSortBy] = useState<TxSortOption>("RECENT");

  // Filter Modal State (Draft values apply only when clicking "Apply Filters")
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [draftTab, setDraftTab] = useState<TxFilterTab>("ALL");
  const [draftGroup, setDraftGroup] = useState("ALL");
  const [draftKind, setDraftKind] = useState<KindFilterOption>("ALL");
  const [draftStatus, setDraftStatus] = useState<StatusFilterOption>("ALL");
  const [draftDateFilter, setDraftDateFilter] = useState<DateFilterOption>("ALL");
  const [draftFromDate, setDraftFromDate] = useState("");
  const [draftToDate, setDraftToDate] = useState("");
  const [draftSortBy, setDraftSortBy] = useState<TxSortOption>("RECENT");

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [allTransactions, setAllTransactions] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchTransactions() {
      try {
        setLoading(true);
        setError(null);
        const token = localStorage.getItem("splitmate_token");
        const response = await fetch(`${API_BASE_URL}/api/v1/transactions`, {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error("Unauthorized. Please log in again.");
          }
          throw new Error("Failed to fetch transactions");
        }

        const data = await response.json();
        if (!cancelled) {
          setAllTransactions(Array.isArray(data?.data) ? data.data : []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load transactions");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchTransactions();

    return () => {
      cancelled = true;
    };
  }, []);

  const groupNames = useMemo(() => {
    const set = new Set<string>(allTransactions.map((t) => t.groupName));
    return ["ALL", ...Array.from(set)];
  }, [allTransactions]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (activeTab !== "ALL") count++;
    if (selectedGroup !== "ALL") count++;
    if (kindFilter !== "ALL") count++;
    if (statusFilter !== "ALL") count++;
    if (dateFilter !== "ALL") count++;
    if (sortBy !== "RECENT") count++;
    return count;
  }, [activeTab, selectedGroup, kindFilter, statusFilter, dateFilter, sortBy]);

  function openFilterModal() {
    setDraftTab(activeTab);
    setDraftGroup(selectedGroup);
    setDraftKind(kindFilter);
    setDraftStatus(statusFilter);
    setDraftDateFilter(dateFilter);
    setDraftFromDate(customFromDate);
    setDraftToDate(customToDate);
    setDraftSortBy(sortBy);
    setFilterModalOpen(true);
  }

  function applyFilterModal() {
    setActiveTab(draftTab);
    setSelectedGroup(draftGroup);
    setKindFilter(draftKind);
    setStatusFilter(draftStatus);
    setDateFilter(draftDateFilter);
    setCustomFromDate(draftFromDate);
    setCustomToDate(draftToDate);
    setSortBy(draftSortBy);
    setFilterModalOpen(false);
  }

  function resetAllFilters() {
    setActiveTab("ALL");
    setSelectedGroup("ALL");
    setKindFilter("ALL");
    setStatusFilter("ALL");
    setDateFilter("ALL");
    setCustomFromDate("");
    setCustomToDate("");
    setSortBy("RECENT");
    setSearchQuery("");

    setDraftTab("ALL");
    setDraftGroup("ALL");
    setDraftKind("ALL");
    setDraftStatus("ALL");
    setDraftDateFilter("ALL");
    setDraftFromDate("");
    setDraftToDate("");
    setDraftSortBy("RECENT");
    setFilterModalOpen(false);
  }

  const summary = useMemo(() => {
    const paidByYouList = allTransactions.filter(
      (t) => t.kind === "EXPENSE" && t.paidByYou
    );
    const involvedList = allTransactions.filter(
      (t) => t.kind === "EXPENSE" && !t.paidByYou && t.yourShare > 0
    );
    const settledList = allTransactions.filter((t) => t.kind === "SETTLEMENT");

    const totalPaidByYou = paidByYouList.reduce(
      (s, t) => s + (t.paidByYouAmount ?? t.totalAmount),
      0
    );
    const totalInvolvedShare = involvedList.reduce((s, t) => s + t.yourShare, 0);
    const totalSettledVolume = settledList.reduce((s, t) => s + t.totalAmount, 0);

    return {
      allCount: allTransactions.length,
      paidByYouCount: paidByYouList.length,
      involvedCount: involvedList.length,
      settledCount: settledList.length,
      totalPaidByYou,
      totalInvolvedShare,
      totalSettledVolume,
    };
  }, [allTransactions]);

  const filteredTransactions = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 7
    );
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const fromBound = customFromDate ? new Date(`${customFromDate}T00:00:00`) : null;
    const toBound = customToDate ? new Date(`${customToDate}T23:59:59`) : null;

    const list = allTransactions.filter((tx) => {
      if (activeTab === "PAID_BY_YOU" && !(tx.kind === "EXPENSE" && tx.paidByYou)) {
        return false;
      }
      if (
        activeTab === "INVOLVED" &&
        !(tx.kind === "EXPENSE" && !tx.paidByYou && tx.yourShare > 0)
      ) {
        return false;
      }
      if (activeTab === "SETTLED_UP" && tx.kind !== "SETTLEMENT") {
        return false;
      }

      if (kindFilter !== "ALL" && tx.kind !== kindFilter) {
        return false;
      }

      if (statusFilter !== "ALL" && tx.status !== statusFilter) {
        return false;
      }

      if (selectedGroup !== "ALL" && tx.groupName !== selectedGroup) {
        return false;
      }

      if (dateFilter !== "ALL") {
        const txDate = parseTransactionDate(tx.date);
        if (!txDate) {
          return false;
        }
        if (dateFilter === "TODAY" && txDate.getTime() !== todayStart.getTime()) {
          return false;
        }
        if (
          dateFilter === "LAST_7_DAYS" &&
          (txDate < sevenDaysAgo || txDate > todayStart)
        ) {
          return false;
        }
        if (
          dateFilter === "THIS_MONTH" &&
          (txDate < monthStart || txDate > todayStart)
        ) {
          return false;
        }
        if (dateFilter === "CUSTOM") {
          if (fromBound && txDate < fromBound) return false;
          if (toBound && txDate > toBound) return false;
        }
      }

      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;
      return (
        tx.title.toLowerCase().includes(q) ||
        tx.groupName.toLowerCase().includes(q) ||
        tx.category.toLowerCase().includes(q) ||
        tx.paidBy.toLowerCase().includes(q)
      );
    });

    if (sortBy === "RECENT") return list;

    return [...list].sort((a, b) => {
      if (sortBy === "AMOUNT_DESC") return b.totalAmount - a.totalAmount;
      if (sortBy === "AMOUNT_ASC") return a.totalAmount - b.totalAmount;
      return Math.abs(b.netImpact) - Math.abs(a.netImpact);
    });
  }, [
    allTransactions,
    activeTab,
    kindFilter,
    statusFilter,
    selectedGroup,
    dateFilter,
    customFromDate,
    customToDate,
    searchQuery,
    sortBy,
  ]);

  function handleExportCsv() {
    const headers = [
      "Date",
      "Type",
      "Title",
      "Group",
      "Category",
      "Paid By",
      "Total Amount (INR)",
      "Your Share (INR)",
      "Net Impact (INR)",
      "Status",
    ];
    const rows = filteredTransactions.map((t) => [
      t.date,
      t.kind,
      `"${t.title.replace(/"/g, '""')}"`,
      `"${t.groupName}"`,
      t.category,
      `"${t.paidBy}"`,
      t.totalAmount.toFixed(2),
      t.yourShare.toFixed(2),
      t.netImpact.toFixed(2),
      t.status,
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `splitmate-transactions-${activeTab.toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <AppLayout
        title="Transactions & History"
        subtitle="Complete audit trail of expenses paid by you, bills you were involved in, and settled payments"
      >
        <div className="flex h-64 items-center justify-center rounded-2xl border border-slate-200/90 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-3 border-indigo-600 border-t-transparent" />
            <p className="mt-4 text-xs font-medium text-slate-500 dark:text-zinc-400">
              Loading transactions...
            </p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout
        title="Transactions & History"
        subtitle="Complete audit trail of expenses paid by you, bills you were involved in, and settled payments"
      >
        <div className="rounded-2xl border border-rose-200/80 bg-white p-12 text-center shadow-2xs dark:border-rose-900/50 dark:bg-zinc-900">
          <AlertCircle className="mx-auto h-10 w-10 text-rose-500" />
          <h2 className="mt-3 font-display text-base font-bold text-slate-900 dark:text-white">
            Failed to load transactions
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">{error}</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title="Transactions & History"
      subtitle="Complete audit trail of expenses paid by you, bills you were involved in, and settled payments"
      headerActions={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCsv}
            className="hidden h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 sm:inline-flex dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
          <Link
            to="/expenses"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 text-xs font-semibold text-white shadow-xs transition hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            Add Expense
          </Link>
        </div>
      }
    >
      <div className="space-y-4 sm:space-y-6">
        {/* 2-per-row on mobile, 3-per-row on desktop */}
        <section className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-2xs sm:rounded-2xl sm:p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between gap-1.5">
              <span className="truncate text-[10px] font-bold uppercase tracking-wider text-indigo-600 sm:text-xs dark:text-indigo-400">
                Paid by You ({summary.paidByYouCount})
              </span>
              <span className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 sm:flex dark:bg-indigo-950 dark:text-indigo-400">
                <Wallet className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-1.5 truncate font-display text-base font-extrabold text-slate-900 tabular-nums sm:mt-2.5 sm:text-2xl dark:text-white">
              {formatINR(summary.totalPaidByYou)}
            </p>
            <p className="mt-0.5 truncate text-[10px] text-slate-500 sm:mt-1 sm:text-xs dark:text-zinc-400">
              Total out-of-pocket expenses fronted by you
            </p>
          </div>

          <div className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-2xs sm:rounded-2xl sm:p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between gap-1.5">
              <span className="truncate text-[10px] font-bold uppercase tracking-wider text-rose-600 sm:text-xs dark:text-rose-400">
                Involved In ({summary.involvedCount})
              </span>
              <span className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600 sm:flex dark:bg-rose-950 dark:text-rose-400">
                <Receipt className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-1.5 truncate font-display text-base font-extrabold text-rose-600 tabular-nums sm:mt-2.5 sm:text-2xl dark:text-rose-400">
              {formatINR(summary.totalInvolvedShare)}
            </p>
            <p className="mt-0.5 truncate text-[10px] text-slate-500 sm:mt-1 sm:text-xs dark:text-zinc-400">
              Your combined share in bills paid by friends
            </p>
          </div>

          <div className="col-span-2 rounded-xl border border-slate-200/90 bg-white p-3 shadow-2xs sm:rounded-2xl sm:p-5 lg:col-span-1 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between gap-1.5">
              <span className="truncate text-[10px] font-bold uppercase tracking-wider text-emerald-600 sm:text-xs dark:text-emerald-400">
                Settled Up ({summary.settledCount})
              </span>
              <span className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 sm:flex dark:bg-emerald-950 dark:text-emerald-400">
                <ArrowLeftRight className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-1.5 truncate font-display text-base font-extrabold text-emerald-600 tabular-nums sm:mt-2.5 sm:text-2xl dark:text-emerald-400">
              {formatINR(summary.totalSettledVolume)}
            </p>
            <p className="mt-0.5 truncate text-[10px] text-slate-500 sm:mt-1 sm:text-xs dark:text-zinc-400">
              Direct repayments sent or received
            </p>
          </div>
        </section>

        {/* Search + Filter Modal Trigger Row */}
        <div className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200/90 bg-white p-3 shadow-2xs sm:p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search title, group, payer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50/70 pr-3 pl-9 text-xs outline-none transition focus:border-indigo-500 focus:bg-white sm:h-10 sm:pl-10 sm:text-sm dark:border-zinc-800 dark:bg-zinc-950"
            />
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            {(activeFilterCount > 0 || searchQuery.trim() !== "") && (
              <button
                type="button"
                onClick={resetAllFilters}
                className="inline-flex h-9 items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-2.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 sm:h-10 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Reset</span>
              </button>
            )}

            <button
              type="button"
              onClick={openFilterModal}
              className={`inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition sm:h-10 sm:px-3.5 cursor-pointer ${
                activeFilterCount > 0
                  ? "border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200"
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-600 px-1.5 text-[10px] font-bold text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Active Filter Chips */}
        {activeFilterCount > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {activeTab !== "ALL" && (
              <span className="rounded-lg bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 sm:px-2.5 sm:py-1 sm:text-[11px] dark:bg-indigo-950/70 dark:text-indigo-300">
                View: {activeTab.replace(/_/g, " ")}
              </span>
            )}
            {dateFilter !== "ALL" && (
              <span className="rounded-lg bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 sm:px-2.5 sm:py-1 sm:text-[11px] dark:bg-indigo-950/70 dark:text-indigo-300">
                Calendar: {dateFilter.replace(/_/g, " ")}
              </span>
            )}
            {selectedGroup !== "ALL" && (
              <span className="rounded-lg bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 sm:px-2.5 sm:py-1 sm:text-[11px] dark:bg-indigo-950/70 dark:text-indigo-300">
                Group: {selectedGroup}
              </span>
            )}
            {kindFilter !== "ALL" && (
              <span className="rounded-lg bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 sm:px-2.5 sm:py-1 sm:text-[11px] dark:bg-indigo-950/70 dark:text-indigo-300">
                Type: {kindFilter}
              </span>
            )}
            {statusFilter !== "ALL" && (
              <span className="rounded-lg bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 sm:px-2.5 sm:py-1 sm:text-[11px] dark:bg-indigo-950/70 dark:text-indigo-300">
                Status: {statusFilter}
              </span>
            )}
            {sortBy !== "RECENT" && (
              <span className="rounded-lg bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 sm:px-2.5 sm:py-1 sm:text-[11px] dark:bg-indigo-950/70 dark:text-indigo-300">
                Sorted
              </span>
            )}
          </div>
        )}

        {/* Transactions Ledger List */}
        <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xs dark:border-zinc-800 dark:bg-zinc-900">
          {filteredTransactions.length === 0 ? (
            <div className="p-10 text-center">
              <Receipt className="mx-auto h-9 w-9 text-slate-400" />
              <h2 className="mt-2.5 font-display text-sm font-bold text-slate-900 sm:text-base dark:text-white">
                No transactions match this filter
              </h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                Try adjusting your calendar range, group filter, or search query.
              </p>
              {(activeFilterCount > 0 || searchQuery.trim() !== "") && (
                <button
                  type="button"
                  onClick={resetAllFilters}
                  className="mt-3.5 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-indigo-600 hover:bg-slate-50 dark:border-zinc-700 dark:text-indigo-400 cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset Filters
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-zinc-800">
              {filteredTransactions.map((tx) => {
                const isSettlement = tx.kind === "SETTLEMENT";
                const isExpanded = expandedId === tx.id;

                const involvementLabel = isSettlement
                  ? tx.netImpact > 0
                    ? `Received from ${tx.paidBy}`
                    : "Settled Up"
                  : tx.paidByYou
                    ? "Paid by You"
                    : `Involved • ${tx.paidBy}`;

                return (
                  <div
                    key={tx.id}
                    onClick={() => setExpandedId(isExpanded ? null : tx.id)}
                    className="px-3.5 py-2.5 transition hover:bg-slate-50/80 sm:px-6 sm:py-3.5 dark:hover:bg-zinc-800/40 cursor-pointer"
                  >
                    {/* Mobile: Full-width title on top, involvement + group/date + amount cleanly below.
                        Desktop (sm+): Single aligned row with generous title space. */}
                    <div className="flex items-start gap-2.5 sm:items-center sm:justify-between sm:gap-4">
                      <div className="flex min-w-0 flex-1 items-start gap-2.5 sm:items-center sm:gap-3.5">
                        <div
                          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg sm:mt-0 sm:h-9 sm:w-9 sm:rounded-xl ${
                            isSettlement
                              ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/70 dark:text-emerald-400"
                              : tx.paidByYou
                                ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/70 dark:text-indigo-400"
                                : "bg-rose-50 text-rose-600 dark:bg-rose-950/70 dark:text-rose-400"
                          }`}
                        >
                          {isSettlement ? (
                            <ArrowLeftRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          ) : tx.paidByYou ? (
                            <ArrowUpRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          ) : (
                            <ArrowDownLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="break-words text-xs font-bold leading-snug text-slate-900 sm:truncate sm:text-sm dark:text-white">
                            {tx.title}
                          </p>

                          <div className="mt-1 flex items-center justify-between gap-2 sm:hidden">
                            <div className="flex min-w-0 items-center gap-1.5">
                              <span
                                className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                                  isSettlement
                                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                                    : tx.paidByYou
                                      ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                                      : "bg-amber-50 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300"
                                }`}
                              >
                                {involvementLabel}
                              </span>
                              <span className="truncate text-[10px] text-slate-400">
                                {tx.groupName} • {tx.date}
                              </span>
                            </div>

                            <div className="flex shrink-0 items-center gap-1.5">
                              <span
                                className={`whitespace-nowrap font-display text-xs font-extrabold tabular-nums ${
                                  tx.netImpact > 0
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : tx.netImpact < 0
                                      ? "text-rose-600 dark:text-rose-400"
                                      : "text-slate-700 dark:text-zinc-300"
                                }`}
                              >
                                {tx.netImpact > 0
                                  ? `+${formatINR(tx.netImpact)}`
                                  : tx.netImpact < 0
                                    ? `-${formatINR(Math.abs(tx.netImpact))}`
                                    : formatINR(tx.totalAmount)}
                              </span>
                              <ChevronDown
                                className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${
                                  isExpanded ? "rotate-180 text-indigo-600" : ""
                                }`}
                              />
                            </div>
                          </div>

                          <div className="mt-0.5 hidden items-center gap-1.5 text-[11px] text-slate-400 sm:flex">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                isSettlement
                                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                                  : tx.paidByYou
                                    ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                                    : "bg-amber-50 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300"
                              }`}
                            >
                              {involvementLabel}
                            </span>
                            <span>
                              • {tx.groupName} • {tx.date}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="hidden shrink-0 items-center gap-2.5 text-right sm:flex">
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
                          {tx.groupName}
                        </span>

                        <span
                          className={`whitespace-nowrap font-display text-sm font-extrabold tabular-nums ${
                            tx.netImpact > 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : tx.netImpact < 0
                                ? "text-rose-600 dark:text-rose-400"
                                : "text-slate-700 dark:text-zinc-300"
                          }`}
                        >
                          {tx.netImpact > 0
                            ? `+${formatINR(tx.netImpact)}`
                            : tx.netImpact < 0
                              ? `-${formatINR(Math.abs(tx.netImpact))}`
                              : formatINR(tx.totalAmount)}
                        </span>

                        <ChevronDown
                          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${
                            isExpanded ? "rotate-180 text-indigo-600" : ""
                          }`}
                        />
                      </div>
                    </div>

                    {/* Expanded Audit Details Drawer */}
                    {isExpanded && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="mt-3 space-y-3 rounded-2xl border border-slate-200/90 bg-slate-50/90 p-3.5 text-xs sm:p-4 dark:border-zinc-800 dark:bg-zinc-950"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/70 pb-2.5 dark:border-zinc-800">
                          <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-zinc-200">
                            <FolderKanban className="h-3.5 w-3.5 text-indigo-500" />
                            <span>{tx.groupName}</span>
                            <span className="text-slate-400">•</span>
                            <span className="text-slate-500 dark:text-zinc-400">
                              {tx.category}
                            </span>
                          </div>

                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                              tx.status === "COMPLETED"
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                                : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                            }`}
                          >
                            {tx.status === "COMPLETED" ? (
                              <CheckCircle2 className="h-3 w-3" />
                            ) : (
                              <Clock className="h-3 w-3" />
                            )}
                            {tx.status}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                          <div className="rounded-xl border border-slate-200/70 bg-white p-2.5 dark:border-zinc-800 dark:bg-zinc-900">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              Total Bill
                            </p>
                            <p className="mt-0.5 font-display text-xs font-extrabold text-slate-900 tabular-nums sm:text-sm dark:text-white">
                              {formatINR(tx.totalAmount)}
                            </p>
                          </div>

                          <div className="rounded-xl border border-slate-200/70 bg-white p-2.5 dark:border-zinc-800 dark:bg-zinc-900">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              Your Share
                            </p>
                            <p className="mt-0.5 font-display text-xs font-extrabold text-slate-900 tabular-nums sm:text-sm dark:text-white">
                              {isSettlement ? "—" : formatINR(tx.yourShare)}
                            </p>
                          </div>

                          <div className="rounded-xl border border-slate-200/70 bg-white p-2.5 dark:border-zinc-800 dark:bg-zinc-900">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              Paid By
                            </p>
                            <p className="mt-0.5 truncate text-xs font-bold text-slate-800 dark:text-zinc-200">
                              {tx.paidBy}
                              {tx.paidByYou && tx.paidByYouAmount !== undefined
                                ? ` (${formatINR(tx.paidByYouAmount)})`
                                : ""}
                            </p>
                          </div>

                          <div className="rounded-xl border border-slate-200/70 bg-white p-2.5 dark:border-zinc-800 dark:bg-zinc-900">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              Net Effect
                            </p>
                            <p
                              className={`mt-0.5 font-display text-xs font-extrabold tabular-nums sm:text-sm ${
                                tx.netImpact > 0
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : tx.netImpact < 0
                                    ? "text-rose-600 dark:text-rose-400"
                                    : "text-slate-600 dark:text-zinc-300"
                              }`}
                            >
                              {isSettlement
                                ? tx.netImpact > 0
                                  ? `Received ${formatINR(tx.netImpact)}`
                                  : `Paid ${formatINR(Math.abs(tx.netImpact))}`
                                : tx.netImpact >= 0
                                  ? `You lent ${formatINR(tx.netImpact)}`
                                  : `You owe ${formatINR(Math.abs(tx.netImpact))}`}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-slate-500 dark:text-zinc-400">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span>
                              Date: <strong className="text-slate-700 dark:text-zinc-200">{tx.date}</strong>
                            </span>
                            <span>
                              Via: <strong className="text-slate-700 dark:text-zinc-200">{tx.paymentMethod}</strong>
                            </span>
                            {tx.splitType && (
                              <span>
                                Split: <strong className="text-slate-700 dark:text-zinc-200">{tx.splitType}</strong>
                              </span>
                            )}
                            {tx.referenceId && (
                              <span>
                                Ref: <code className="font-mono text-slate-700 dark:text-zinc-200">{tx.referenceId}</code>
                              </span>
                            )}
                          </div>
                        </div>

                        {tx.notes && (
                          <p className="rounded-lg border border-slate-200/70 bg-white px-3 py-2 text-[11px] italic text-slate-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
                            Note: {tx.notes}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* MOBILE-COMPATIBLE FILTER & CALENDAR MODAL */}
      {filterModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          role="presentation"
          onMouseDown={() => setFilterModalOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="tx-filter-modal-title"
            onMouseDown={(e) => e.stopPropagation()}
            className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-slate-200 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl sm:p-6 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-zinc-800">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
                  <SlidersHorizontal className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <h3
                    id="tx-filter-modal-title"
                    className="truncate font-display text-base font-bold text-slate-900 dark:text-white"
                  >
                    Filter Transactions
                  </h3>
                  <p className="truncate text-[11px] text-slate-500 dark:text-zinc-400">
                    Filter by calendar date, group, type, or sort order
                  </p>
                </div>
              </div>

              <button
                type="button"
                aria-label="Close filter modal"
                onClick={() => setFilterModalOpen(false)}
                className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 space-y-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                  Activity View
                </label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {[
                    { id: "ALL" as TxFilterTab, label: `All (${summary.allCount})` },
                    {
                      id: "PAID_BY_YOU" as TxFilterTab,
                      label: `Paid by You (${summary.paidByYouCount})`,
                    },
                    {
                      id: "INVOLVED" as TxFilterTab,
                      label: `Involved (${summary.involvedCount})`,
                    },
                    {
                      id: "SETTLED_UP" as TxFilterTab,
                      label: `Settled (${summary.settledCount})`,
                    },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setDraftTab(item.id)}
                      className={`min-h-9 rounded-xl border px-2.5 py-2 text-xs font-semibold transition cursor-pointer ${
                        draftTab === item.id
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
                <label
                  htmlFor="tx-calendar-filter"
                  className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400"
                >
                  <Calendar className="h-3.5 w-3.5 text-indigo-500" />
                  <span>Calendar Date</span>
                </label>
                <div className="relative mt-2">
                  <select
                    id="tx-calendar-filter"
                    value={draftDateFilter}
                    onChange={(e) =>
                      setDraftDateFilter(e.target.value as DateFilterOption)
                    }
                    className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 pr-9 pl-3.5 text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 cursor-pointer"
                  >
                    <option value="ALL">All Dates</option>
                    <option value="TODAY">Today</option>
                    <option value="LAST_7_DAYS">Last 7 Days</option>
                    <option value="THIS_MONTH">This Month</option>
                    <option value="CUSTOM">Custom Calendar Range</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>

                {draftDateFilter === "CUSTOM" && (
                  <div className="mt-2.5 grid grid-cols-2 gap-2.5 rounded-xl border border-indigo-100 bg-indigo-50/40 p-3 dark:border-indigo-900/40 dark:bg-indigo-950/25">
                    <div className="min-w-0">
                      <label
                        htmlFor="tx-from-date"
                        className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-300"
                      >
                        From Date
                      </label>
                      <input
                        id="tx-from-date"
                        type="date"
                        value={draftFromDate}
                        onChange={(e) => setDraftFromDate(e.target.value)}
                        className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold outline-none focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-900"
                      />
                    </div>
                    <div className="min-w-0">
                      <label
                        htmlFor="tx-to-date"
                        className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-300"
                      >
                        To Date
                      </label>
                      <input
                        id="tx-to-date"
                        type="date"
                        value={draftToDate}
                        onChange={(e) => setDraftToDate(e.target.value)}
                        className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold outline-none focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-900"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                <div className="min-w-0">
                  <label
                    htmlFor="tx-modal-group"
                    className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400"
                  >
                    <Filter className="h-3 w-3 shrink-0 text-indigo-500" />
                    <span className="truncate">Group</span>
                  </label>
                  <div className="relative mt-2">
                    <select
                      id="tx-modal-group"
                      value={draftGroup}
                      onChange={(e) => setDraftGroup(e.target.value)}
                      className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 pr-8 pl-3 text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 cursor-pointer"
                    >
                      {groupNames.map((g) => (
                        <option key={g} value={g}>
                          {g === "ALL" ? "All Groups" : g}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  </div>
                </div>

                <div className="min-w-0">
                  <label
                    htmlFor="tx-modal-kind"
                    className="block truncate text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400"
                  >
                    Entry Type
                  </label>
                  <div className="relative mt-2">
                    <select
                      id="tx-modal-kind"
                      value={draftKind}
                      onChange={(e) =>
                        setDraftKind(e.target.value as KindFilterOption)
                      }
                      className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 pr-8 pl-3 text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 cursor-pointer"
                    >
                      <option value="ALL">All Entries</option>
                      <option value="EXPENSE">Expenses Only</option>
                      <option value="SETTLEMENT">Settlements Only</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                <div className="min-w-0">
                  <label
                    htmlFor="tx-modal-status"
                    className="block truncate text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400"
                  >
                    Status
                  </label>
                  <div className="relative mt-2">
                    <select
                      id="tx-modal-status"
                      value={draftStatus}
                      onChange={(e) =>
                        setDraftStatus(e.target.value as StatusFilterOption)
                      }
                      className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 pr-8 pl-3 text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 cursor-pointer"
                    >
                      <option value="ALL">All Statuses</option>
                      <option value="ACTIVE">Active</option>
                      <option value="COMPLETED">Completed</option>
                      <option value="PENDING">Pending</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  </div>
                </div>

                <div className="min-w-0">
                  <label
                    htmlFor="tx-modal-sort"
                    className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400"
                  >
                    <ArrowUpDown className="h-3.5 w-3.5 shrink-0 text-indigo-500" />
                    <span className="truncate">Sort By</span>
                  </label>
                  <div className="relative mt-2">
                    <select
                      id="tx-modal-sort"
                      value={draftSortBy}
                      onChange={(e) =>
                        setDraftSortBy(e.target.value as TxSortOption)
                      }
                      className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 pr-8 pl-3 text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 cursor-pointer"
                    >
                      <option value="RECENT">Latest First</option>
                      <option value="AMOUNT_DESC">Amount: High to Low</option>
                      <option value="AMOUNT_ASC">Amount: Low to High</option>
                      <option value="IMPACT_DESC">Net Impact: High to Low</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  </div>
                </div>
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
    </AppLayout>
  );
}