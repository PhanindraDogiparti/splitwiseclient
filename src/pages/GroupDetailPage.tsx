import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  ArrowUpDown,
  BarChart3,
  Car,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Copy,
  CreditCard,
  Film,
  Filter,
  Handshake,
  Hotel,
  Lightbulb,
  Link2,
  Loader2,
  Lock,
  MessageSquare,
  Pencil,
  Plus,
  Receipt,
  ShoppingBag,
  RotateCcw,
  Search,
  Send,
  Shield,
  SlidersHorizontal,
  Share2,
  Sparkles,
  Tag,
  Trash2,
  Utensils,
  UserPlus,
  Users,
  X,
  Wifi,
  type LucideIcon,
} from "lucide-react";
import AppLayout from "../components/AppLayout";
import EditExpenseModal from "../components/EditExpenseModal";
import GroupMembersModal from "../components/GroupMembersModal";
import ShareModal from "../components/ShareModal";

const API_BASE_URL =
  (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");

type GroupType = "TRIP" | "ROOMMATE" | "FRIENDS" | "CUSTOM";
type SplitMethod = "EQUAL" | "EXACT" | "PERCENTAGE" | "SHARES";
type ExpenseSortOption = "RECENT" | "AMOUNT_DESC" | "AMOUNT_ASC" | "MY_SHARE_DESC";
type DateFilterOption = "ALL" | "TODAY" | "LAST_7_DAYS" | "THIS_MONTH" | "CUSTOM";

const REOPEN_WINDOW_MS = 24 * 60 * 60 * 1000;

interface GroupMemberItem {
  id: string;
  name: string;
  email: string;
  upiId?: string;
  isCurrentUser: boolean;
  role: "ADMIN" | "MEMBER";
  netBalance: number;
}

interface ExpenseAllocationItem {
  memberId: string;
  memberName: string;
  amount: number;
}

interface ExpenseCommentItem {
  id: string;
  author: string;
  text: string;
  time: string;
}

interface GroupExpenseItem {
  id: string;
  title: string;
  category: string;
  paidById: string;
  paidByName: string;
  totalAmount: number;
  yourShare: number;
  payers: ExpenseAllocationItem[];
  splits: ExpenseAllocationItem[];
  splitType: SplitMethod;
  paymentMethod: string;
  date: string;
  notes?: string;
  isSettled: boolean;
  settledAt?: number;
  comments: ExpenseCommentItem[];
}

interface CompletedSettlementItem {
  id: string;
  fromId?: string;
  from: string;
  toId?: string;
  to: string;
  amount: number;
  remainingAfter?: number;
  method: string;
  referenceId?: string;
  completedAt: string;
}

interface GroupDetailData {
  id: string;
  name: string;
  description: string;
  type: GroupType;
  customTypeLabel?: string;
  currency: string;
  simplifyDebts: boolean;
  members: GroupMemberItem[];
  expenses: GroupExpenseItem[];
  completedSettlements: CompletedSettlementItem[];
}

interface SettlementToastData {
  id: number;
  headline: string;
  subtext: string;
  amountLabel?: string;
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

function normalizeSplitMethod(rawSplit: unknown): SplitMethod {
  const upper = String(rawSplit || "EQUAL").toUpperCase();
  if (upper === "EQUAL" || upper === "EXACT" || upper === "PERCENTAGE" || upper === "SHARES") {
    return upper;
  }
  return "EQUAL";
}

function normalizeGroupDetail(
  raw: Record<string, unknown>,
  fallbackId: string
): GroupDetailData {
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
      upiId: memberObj.upiId ? String(memberObj.upiId) : undefined,
      isCurrentUser,
      role: String(memberObj.role || "MEMBER").toUpperCase() === "ADMIN" ? "ADMIN" : "MEMBER",
      netBalance: Number(memberObj.netBalance ?? memberObj.balance ?? 0) || 0,
    };
  });
  const currentUserId = members.find((member) => member.isCurrentUser)?.id;

  const rawExpenses = Array.isArray(raw.expenses) ? raw.expenses : [];
  const expenses: GroupExpenseItem[] = rawExpenses.map((e, idx) => {
    const expObj = (e && typeof e === "object" ? e : {}) as Record<string, unknown>;
    const rawComments = Array.isArray(expObj.comments) ? expObj.comments : [];
    const comments: ExpenseCommentItem[] = rawComments.map((c, cIdx) => {
      const cObj = (c && typeof c === "object" ? c : {}) as Record<string, unknown>;
      return {
        id: String(cObj.id ?? cObj._id ?? `c_${cIdx}`),
        author: String(cObj.author ?? cObj.authorName ?? "Member"),
        text: String(cObj.text ?? cObj.body ?? ""),
        time: String(cObj.time ?? cObj.createdAt ?? "Just now"),
      };
    });

    const settledAtRaw = expObj.settledAt;
    const settledAt =
      typeof settledAtRaw === "number"
        ? settledAtRaw
        : settledAtRaw
          ? new Date(String(settledAtRaw)).getTime() || undefined
          : undefined;
    const totalAmount = Number(expObj.totalAmount ?? expObj.amount ?? 0) || 0;
    const rawPayers = Array.isArray(expObj.payers) ? expObj.payers : [];
    const payers: ExpenseAllocationItem[] = rawPayers.map((payer) => {
      const payerObj = (payer && typeof payer === "object" ? payer : {}) as Record<string, unknown>;
      return {
        memberId: String(payerObj.memberId ?? payerObj.member_id ?? ""),
        memberName: String(payerObj.memberName ?? payerObj.name ?? "Member"),
        amount: Number(payerObj.amount ?? 0) || 0,
      };
    });
    const rawSplits = Array.isArray(expObj.splits) ? expObj.splits : [];
    const splits: ExpenseAllocationItem[] = rawSplits.map((split) => {
      const splitObj = (split && typeof split === "object" ? split : {}) as Record<string, unknown>;
      return {
        memberId: String(splitObj.memberId ?? splitObj.member_id ?? ""),
        memberName: String(splitObj.memberName ?? splitObj.name ?? "Member"),
        amount: Number(splitObj.amount ?? 0) || 0,
      };
    });
    const paidById = String(
      expObj.paidByMemberId ?? expObj.paidById ?? payers[0]?.memberId ?? "you",
    );
    if (payers.length === 0) {
      payers.push({
        memberId: paidById,
        memberName: String(expObj.paidByName ?? expObj.paidBy ?? "Member"),
        amount: totalAmount,
      });
    }
    const yourShare =
      splits.find((split) => split.memberId === currentUserId)?.amount ??
      (Number(expObj.yourShare ?? 0) || 0);

    return {
      id: String(expObj.id ?? expObj._id ?? `ge_${idx}`),
      title: String(expObj.title ?? expObj.description ?? "Expense"),
      category: String(expObj.category ?? "Other"),
      paidById,
      paidByName: String(expObj.paidByName ?? expObj.paidBy ?? "Member"),
      totalAmount,
      yourShare,
      payers,
      splits,
      splitType: normalizeSplitMethod(expObj.splitType ?? expObj.splitMethod),
      paymentMethod: String(expObj.paymentMethod ?? "UPI"),
      date: String(expObj.date ?? expObj.createdAt ?? ""),
      notes: expObj.notes ? String(expObj.notes) : undefined,
      isSettled: Boolean(expObj.isSettled ?? expObj.settled ?? false),
      settledAt,
      comments,
    };
  });

  const rawSettlements = Array.isArray(raw.completedSettlements)
    ? raw.completedSettlements
    : Array.isArray(raw.settlements)
      ? raw.settlements
      : [];

  const completedSettlements: CompletedSettlementItem[] = rawSettlements.map((s, idx) => {
    const sObj = (s && typeof s === "object" ? s : {}) as Record<string, unknown>;
    return {
      id: String(sObj.id ?? sObj._id ?? `cs_${idx}`),
      fromId: sObj.fromMemberId
        ? String(sObj.fromMemberId)
        : sObj.fromId
          ? String(sObj.fromId)
          : undefined,
      from: String(sObj.from ?? sObj.fromName ?? "Member"),
      toId: sObj.toMemberId
        ? String(sObj.toMemberId)
        : sObj.toId
          ? String(sObj.toId)
          : undefined,
      to: String(sObj.to ?? sObj.toName ?? "Member"),
      amount: Number(sObj.amount ?? 0) || 0,
      remainingAfter:
        sObj.remainingAfter !== undefined ? Number(sObj.remainingAfter) || 0 : undefined,
      method: String(sObj.method ?? "UPI"),
      referenceId: sObj.referenceId ? String(sObj.referenceId) : undefined,
      completedAt: String(sObj.completedAt ?? sObj.createdAt ?? "Just now"),
    };
  });

  return {
    id: String(raw.id ?? raw._id ?? fallbackId),
    name: String(raw.name ?? "Group"),
    description: String(raw.description ?? "Shared group expenses"),
    type: normalizeGroupType(raw.type),
    customTypeLabel: raw.customTypeLabel ? String(raw.customTypeLabel) : undefined,
    currency: String(raw.currency ?? "INR"),
    simplifyDebts: raw.simplifyDebts !== false,
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
    expenses,
    completedSettlements,
  };
}

function formatINR(value: number, currency = "INR"): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

const EXPENSE_CATEGORY_ICONS: Record<string, LucideIcon> = {
  Food: Utensils,
  Hotel,
  Transportation: Car,
  Shopping: ShoppingBag,
  Internet: Wifi,
  Electricity: Lightbulb,
  Entertainment: Film,
};

function getReopenStatus(exp: GroupExpenseItem, nowMs: number) {
  if (!exp.isSettled || !exp.settledAt) {
    return { canReopen: true, timeLeft: "24h", expired: false };
  }
  const elapsed = nowMs - exp.settledAt;
  if (elapsed >= REOPEN_WINDOW_MS) {
    return { canReopen: false, timeLeft: "", expired: true };
  }
  const minutesLeft = Math.max(1, Math.ceil((REOPEN_WINDOW_MS - elapsed) / 60000));
  const hoursLeft = Math.floor(minutesLeft / 60);
  const remainingMinutes = minutesLeft % 60;
  const timeLeft =
    hoursLeft > 0 ? `${hoursLeft}h ${remainingMinutes}m` : `${remainingMinutes}m`;
  return { canReopen: true, timeLeft, expired: false };
}

function parseExpenseDate(dateStr: string): Date | null {
  const clean = dateStr.trim().toLowerCase();
  if (clean === "today" || clean === "just now") {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  if (clean === "yesterday") {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  }
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

export default function GroupDetailsPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const resolvedGroupId = groupId || "";

  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);

  const [group, setGroup] = useState<GroupDetailData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchGroupDetail = useCallback(async (showLoading = true) => {
    if (!resolvedGroupId) {
      setLoadError("Missing group ID.");
      if (showLoading) setLoading(false);
      return;
    }

    if (showLoading) setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/groups/${resolvedGroupId}`, {
        headers: getAuthHeaders(),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.message || "Failed to load group details.");
      }
      const rawData =
        payload.data && typeof payload.data === "object"
          ? (payload.data as Record<string, unknown>)
          : (payload as Record<string, unknown>);
      setGroup(normalizeGroupDetail(rawData, resolvedGroupId));
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : `Could not connect to backend at ${API_BASE_URL}.`;
      if (showLoading) {
        setLoadError(message);
      } else {
        throw new Error(message);
      }
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [resolvedGroupId]);

  useEffect(() => {
    fetchGroupDetail();
  }, [fetchGroupDetail]);

  // Filter Modal & Active Filter States
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [expenseFilter, setExpenseFilter] = useState<"ALL" | "PENDING" | "COMPLETED">("ALL");
  const [paidByFilter, setPaidByFilter] = useState<string>("ALL");
  const [splitTypeFilter, setSplitTypeFilter] = useState<"ALL" | SplitMethod>("ALL");
  const [dateFilter, setDateFilter] = useState<DateFilterOption>("ALL");
  const [customFromDate, setCustomFromDate] = useState<string>("");
  const [customToDate, setCustomToDate] = useState<string>("");
  const [expenseSort, setExpenseSort] = useState<ExpenseSortOption>("RECENT");
  const [searchExpense, setSearchExpense] = useState("");

  // Draft States inside Filter Modal
  const [draftStatus, setDraftStatus] = useState<"ALL" | "PENDING" | "COMPLETED">("ALL");
  const [draftPaidBy, setDraftPaidBy] = useState<string>("ALL");
  const [draftSplitType, setDraftSplitType] = useState<"ALL" | SplitMethod>("ALL");
  const [draftDateFilter, setDraftDateFilter] = useState<DateFilterOption>("ALL");
  const [draftFromDate, setDraftFromDate] = useState<string>("");
  const [draftToDate, setDraftToDate] = useState<string>("");
  const [draftSort, setDraftSort] = useState<ExpenseSortOption>("RECENT");

  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedUpi, setCopiedUpi] = useState<string | null>(null);
  const [alertBanner, setAlertBanner] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [celebrationToast, setCelebrationToast] = useState<SettlementToastData | null>(null);
  const [recentlySettledIds, setRecentlySettledIds] = useState<Record<string, boolean>>({});

  function triggerSuccessAnimation(
    data: Omit<SettlementToastData, "id">,
    highlightId?: string
  ) {
    const toastId = Date.now();
    setCelebrationToast({ ...data, id: toastId });

    if (highlightId) {
      setRecentlySettledIds((prev) => ({ ...prev, [highlightId]: true }));
      window.setTimeout(() => {
        setRecentlySettledIds((prev) => {
          const next = { ...prev };
          delete next[highlightId];
          return next;
        });
      }, 2200);
    }

    window.setTimeout(() => {
      setCelebrationToast((current) => (current?.id === toastId ? null : current));
    }, 3400);
  }

  // Manual / Partial Settlement State per Suggested Transfer
  const [customPayTransferId, setCustomPayTransferId] = useState<string | null>(null);
  const [customPayAmount, setCustomPayAmount] = useState<string>("");
  const [customPayMethod, setCustomPayMethod] = useState<string>("UPI");

  // Standalone Custom Settlement Form State
  const [showCustomSettleForm, setShowCustomSettleForm] = useState(false);
  const [manualFromId, setManualFromId] = useState("");
  const [manualToId, setManualToId] = useState("");
  const [manualAmount, setManualAmount] = useState("");
  const [manualMethod, setManualMethod] = useState("UPI");
  const [manualRefId, setManualRefId] = useState("");

  // Comment Drawer per Expense
  const [expandedCommentExpId, setExpandedCommentExpId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [editingExpense, setEditingExpense] = useState<GroupExpenseItem | null>(null);

  const [membersModalOpen, setMembersModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [generatingToken, setGeneratingToken] = useState(false);

  const membersList = group?.members ?? [];
  const expensesList = group?.expenses ?? [];
  const settlementsList = group?.completedSettlements ?? [];
  const currencyCode = group?.currency ?? "INR";
  const currentUserMemberId = membersList.find((member) => member.isCurrentUser)?.id;
  const isGroupCreator = useMemo(() => {
    const currentUserEmail = getCurrentUserEmail();
    return Boolean(
      currentUserEmail &&
        membersList.some(
          (member) =>
            member.role === "ADMIN" && member.email.trim().toLowerCase() === currentUserEmail,
        ),
    );
  }, [membersList]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (expenseFilter !== "ALL") count++;
    if (paidByFilter !== "ALL") count++;
    if (splitTypeFilter !== "ALL") count++;
    if (dateFilter !== "ALL") count++;
    if (expenseSort !== "RECENT") count++;
    return count;
  }, [expenseFilter, paidByFilter, splitTypeFilter, dateFilter, expenseSort]);

  function openFilterModal() {
    setDraftStatus(expenseFilter);
    setDraftPaidBy(paidByFilter);
    setDraftSplitType(splitTypeFilter);
    setDraftDateFilter(dateFilter);
    setDraftFromDate(customFromDate);
    setDraftToDate(customToDate);
    setDraftSort(expenseSort);
    setFilterModalOpen(true);
  }

  function applyFilterModal() {
    setExpenseFilter(draftStatus);
    setPaidByFilter(draftPaidBy);
    setSplitTypeFilter(draftSplitType);
    setDateFilter(draftDateFilter);
    setCustomFromDate(draftFromDate);
    setCustomToDate(draftToDate);
    setExpenseSort(draftSort);
    setFilterModalOpen(false);
  }

  function resetAllFilters() {
    setExpenseFilter("ALL");
    setPaidByFilter("ALL");
    setSplitTypeFilter("ALL");
    setDateFilter("ALL");
    setCustomFromDate("");
    setCustomToDate("");
    setExpenseSort("RECENT");
    setSearchExpense("");

    setDraftStatus("ALL");
    setDraftPaidBy("ALL");
    setDraftSplitType("ALL");
    setDraftDateFilter("ALL");
    setDraftFromDate("");
    setDraftToDate("");
    setDraftSort("RECENT");
    setFilterModalOpen(false);
  }

  const totalGroupSpend = useMemo(
    () => expensesList.reduce((sum, e) => sum + e.totalAmount, 0),
    [expensesList]
  );

  const myPersonalGroupSpend = useMemo(
    () =>
      Math.round(
        expensesList.reduce((sum, e) => sum + (e.yourShare || 0), 0) * 100
      ) / 100,
    [expensesList]
  );

  const myPaidInGroup = useMemo(
    () =>
      Math.round(
        expensesList.reduce(
          (sum, expense) =>
            sum +
            expense.payers.reduce(
              (payerTotal, payer) =>
                payerTotal + (payer.memberId === currentUserMemberId ? payer.amount : 0),
              0,
            ),
          0
        ) * 100
      ) / 100,
    [currentUserMemberId, expensesList]
  );

  const myNetBalance = useMemo(() => {
    const me = membersList.find((member) => member.isCurrentUser);
    return me?.netBalance ?? 0;
  }, [membersList]);

  const totalGroupSettled = useMemo(
    () => settlementsList.reduce((sum, s) => sum + s.amount, 0),
    [settlementsList]
  );

  const memberSettlementStats = useMemo(() => {
    const map: Record<string, { paidOut: number; received: number }> = {};
    membersList.forEach((m) => {
      map[m.id] = { paidOut: 0, received: 0 };
    });

    settlementsList.forEach((cs) => {
      const fromMember = membersList.find(
        (m) => m.id === cs.fromId || m.name === cs.from
      );
      const toMember = membersList.find(
        (m) => m.id === cs.toId || m.name === cs.to
      );
      if (fromMember && map[fromMember.id]) {
        map[fromMember.id].paidOut =
          Math.round((map[fromMember.id].paidOut + cs.amount) * 100) / 100;
      }
      if (toMember && map[toMember.id]) {
        map[toMember.id].received =
          Math.round((map[toMember.id].received + cs.amount) * 100) / 100;
      }
    });
    return map;
  }, [membersList, settlementsList]);

  const pendingTransfers = useMemo(() => {
    const debtors = membersList
      .filter((m) => m.netBalance < -0.009)
      .map((m) => ({ id: m.id, name: m.name, amount: Math.abs(m.netBalance) }))
      .sort((a, b) => b.amount - a.amount);

    const creditors = membersList
      .filter((m) => m.netBalance > 0.009)
      .map((m) => ({ id: m.id, name: m.name, upiId: m.upiId, amount: m.netBalance }))
      .sort((a, b) => b.amount - a.amount);

    const list: Array<{
      id: string;
      fromId: string;
      fromName: string;
      toId: string;
      toName: string;
      toUpi?: string;
      amount: number;
    }> = [];

    let i = 0;
    let j = 0;
    while (i < debtors.length && j < creditors.length) {
      const pay = Math.min(debtors[i].amount, creditors[j].amount);
      if (pay > 0.009) {
        list.push({
          id: `${debtors[i].id}_${creditors[j].id}`,
          fromId: debtors[i].id,
          fromName: debtors[i].name,
          toId: creditors[j].id,
          toName: creditors[j].name,
          toUpi: creditors[j].upiId,
          amount: Math.round(pay * 100) / 100,
        });
      }
      debtors[i].amount -= pay;
      creditors[j].amount -= pay;
      if (debtors[i].amount < 0.01) i++;
      if (creditors[j].amount < 0.01) j++;
    }
    return list;
  }, [membersList]);

  const filteredExpenses = useMemo(() => {
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

    const list = expensesList.filter((exp) => {
      const matchesStatus =
        expenseFilter === "ALL" ||
        (expenseFilter === "COMPLETED" && exp.isSettled) ||
        (expenseFilter === "PENDING" && !exp.isSettled);

      const matchesPayer =
        paidByFilter === "ALL" || exp.paidById === paidByFilter;

      const matchesSplit =
        splitTypeFilter === "ALL" || exp.splitType === splitTypeFilter;

      let matchesDate = true;
      if (dateFilter !== "ALL") {
        const expDate = parseExpenseDate(exp.date);
        if (!expDate) {
          matchesDate = false;
        } else if (dateFilter === "TODAY") {
          matchesDate = expDate.getTime() === todayStart.getTime();
        } else if (dateFilter === "LAST_7_DAYS") {
          matchesDate = expDate >= sevenDaysAgo && expDate <= todayStart;
        } else if (dateFilter === "THIS_MONTH") {
          matchesDate = expDate >= monthStart && expDate <= todayStart;
        } else if (dateFilter === "CUSTOM") {
          if (fromBound && expDate < fromBound) matchesDate = false;
          if (toBound && expDate > toBound) matchesDate = false;
        }
      }

      const q = searchExpense.trim().toLowerCase();
      const matchesQuery =
        !q ||
        exp.title.toLowerCase().includes(q) ||
        exp.category.toLowerCase().includes(q) ||
        exp.paidByName.toLowerCase().includes(q) ||
        (exp.notes && exp.notes.toLowerCase().includes(q));

      return (
        matchesStatus &&
        matchesPayer &&
        matchesSplit &&
        matchesDate &&
        matchesQuery
      );
    });

    if (expenseSort === "RECENT") return list;

    return [...list].sort((a, b) => {
      if (expenseSort === "AMOUNT_DESC") return b.totalAmount - a.totalAmount;
      if (expenseSort === "AMOUNT_ASC") return a.totalAmount - b.totalAmount;
      return (b.yourShare || 0) - (a.yourShare || 0);
    });
  }, [
    expensesList,
    expenseFilter,
    paidByFilter,
    splitTypeFilter,
    dateFilter,
    customFromDate,
    customToDate,
    expenseSort,
    searchExpense,
  ]);

  async function handleToggleSimplifyDebts() {
    if (!group) return;
    const nextSimplify = !group.simplifyDebts;
    setGroup((prev) => (prev ? { ...prev, simplifyDebts: nextSimplify } : prev));
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/groups/${group.id}`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ simplifyDebts: nextSimplify }),
      });
      if (!res.ok) {
        await fetchGroupDetail();
      }
    } catch {
      await fetchGroupDetail();
    }
  }

  async function applySettlement(params: {
    fromId: string;
    fromName: string;
    toId: string;
    toName: string;
    amount: number;
    method?: string;
    referenceId?: string;
  }): Promise<boolean> {
    if (!group) return false;
    const cleanAmount = Math.round(params.amount * 100) / 100;
    if (cleanAmount <= 0) {
      setAlertBanner({ type: "error", text: "Settlement amount must be greater than ₹0." });
      return false;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/groups/${group.id}/settlements`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          fromMemberId: params.fromId,
          toMemberId: params.toId,
          amount: cleanAmount,
          paymentMethod: params.method || "UPI",
          referenceId: params.referenceId || undefined,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.message || "Failed to record settlement.");
      }

      const settledTimestamp = Date.now();
      const createdSettlement =
        payload.data && typeof payload.data === "object"
          ? (payload.data as Record<string, unknown>)
          : {};
      const settlementId = String(createdSettlement.id ?? `cs_${settledTimestamp}`);

      await fetchGroupDetail();
      setNowMs(settledTimestamp);
      setCustomPayTransferId(null);
      setCustomPayAmount("");
      setAlertBanner(null);
      triggerSuccessAnimation(
        {
          headline: "Payment Settled!",
          amountLabel: formatINR(cleanAmount, currencyCode),
          subtext: `${params.fromName} paid ${params.toName} via ${params.method || "UPI"}`,
        },
        settlementId
      );
      return true;
    } catch (err) {
      setAlertBanner({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to record settlement.",
      });
      return false;
    }
  }

  function handleConfirmCustomTransfer(tr: {
    id: string;
    fromId: string;
    fromName: string;
    toId: string;
    toName: string;
    amount: number;
  }) {
    const entered = parseFloat(customPayAmount);
    if (!Number.isFinite(entered) || entered <= 0) {
      setAlertBanner({ type: "error", text: "Enter a valid amount to settle." });
      return;
    }
    if (Math.round(entered * 100) > Math.round(tr.amount * 100)) {
      setAlertBanner({
        type: "error",
        text: `Amount cannot exceed the owed balance of ${formatINR(tr.amount, currencyCode)}.`,
      });
      return;
    }

    void applySettlement({
      fromId: tr.fromId,
      fromName: tr.fromName,
      toId: tr.toId,
      toName: tr.toName,
      amount: entered,
      method: customPayMethod,
    });
  }

  async function handleManualSettlementSubmit(e: React.FormEvent) {
    e.preventDefault();
    const numeric = parseFloat(manualAmount);
    const receiverId =
      manualToId || membersList.find((m) => m.netBalance > 0.009)?.id || "";
    if (!manualFromId || !receiverId || manualFromId === receiverId) {
      setAlertBanner({ type: "error", text: "Select two different members." });
      return;
    }
    if (!Number.isFinite(numeric) || numeric <= 0) {
      setAlertBanner({ type: "error", text: "Enter a valid positive settlement amount." });
      return;
    }

    const fromMember = membersList.find((m) => m.id === manualFromId);
    const toMember = membersList.find((m) => m.id === receiverId);
    if (!fromMember || !toMember) return;
    if (fromMember.netBalance >= 0 || toMember.netBalance <= 0) {
      setAlertBanner({
        type: "error",
        text: "Choose a member who owes and a member who is owed.",
      });
      return;
    }
    const maxSettlement = Math.min(-fromMember.netBalance, toMember.netBalance);
    if (Math.round(numeric * 100) > Math.round(maxSettlement * 100)) {
      setAlertBanner({
        type: "error",
        text: `Amount cannot exceed ${formatINR(maxSettlement, currencyCode)}.`,
      });
      return;
    }

    const succeeded = await applySettlement({
      fromId: fromMember.id,
      fromName: fromMember.name,
      toId: toMember.id,
      toName: toMember.name,
      amount: numeric,
      method: manualMethod,
      referenceId: manualRefId.trim() || undefined,
    });

    if (succeeded) {
      setManualAmount("");
      setManualRefId("");
      setShowCustomSettleForm(false);
    }
  }

  async function handleToggleExpenseSettled(expense: GroupExpenseItem) {
    if (!group) return;
    const currentNow = Date.now();
    setNowMs(currentNow);

    if (expense.isSettled) {
      const status = getReopenStatus(expense, currentNow);
      if (!status.canReopen) {
        setAlertBanner({
          type: "error",
          text: `Reopen window expired: "${expense.title}" was paid over 24 hours ago and is now locked.`,
        });
        return;
      }
    }

    const markingPaid = !expense.isSettled;
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/v1/groups/${group.id}/expenses/${expense.id}`,
        {
          method: "PATCH",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            isSettled: markingPaid,
            settledAt: markingPaid ? currentNow : null,
          }),
        }
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.message || "Failed to update expense status.");
      }

      await fetchGroupDetail();
      if (markingPaid) {
        setAlertBanner(null);
        triggerSuccessAnimation(
          {
            headline: "Marked as Paid!",
            amountLabel: formatINR(expense.totalAmount, currencyCode),
            subtext: `"${expense.title}" • Reopen available for 24 hours`,
          },
          expense.id
        );
      }
    } catch (err) {
      setAlertBanner({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to update expense status.",
      });
    }
  }

  async function handlePostComment(expenseId: string, e: React.FormEvent) {
    e.preventDefault();
    if (!group || !commentText.trim()) return;

    try {
      const res = await fetch(
        `${API_BASE_URL}/api/v1/groups/${group.id}/expenses/${expenseId}/comments`,
        {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({ text: commentText.trim() }),
        }
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.message || "Failed to post comment.");
      }
      setCommentText("");
      await fetchGroupDetail();
    } catch (err) {
      setAlertBanner({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to post comment.",
      });
    }
  }

  async function handleLeaveGroup() {
    if (!group) return;
    if (Math.abs(myNetBalance) > 0.01) {
      setAlertBanner({
        type: "error",
        text: `You cannot leave "${group.name}" while you have an unsettled balance (${formatINR(
          myNetBalance,
          currencyCode
        )}). Complete your settlements first.`,
      });
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/groups/${group.id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.message || "Failed to leave group.");
      }
      navigate("/group");
    } catch (err) {
      setAlertBanner({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to leave group.",
      });
    }
  }

  if (loading) {
    return (
      <AppLayout title="Group Details" subtitle="Loading group data...">
        <div className="flex items-center justify-center rounded-3xl border border-slate-200 bg-white p-12 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center gap-2.5 text-sm font-medium text-slate-600 dark:text-zinc-300">
            <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
            <span>Loading group details from database...</span>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (loadError || !group) {
    return (
      <AppLayout title="Group Details" subtitle="Unable to load group">
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center dark:border-rose-900/60 dark:bg-rose-950/40">
          <AlertCircle className="mx-auto h-8 w-8 text-rose-600 dark:text-rose-400" />
          <h2 className="mt-3 font-display text-lg font-bold text-rose-800 dark:text-rose-200">
            {loadError || "Group not found"}
          </h2>
          <div className="mt-5 flex items-center justify-center gap-3">
            <Link
              to="/group"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-rose-300 bg-white px-4 text-xs font-semibold text-rose-700 hover:bg-rose-100"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Groups
            </Link>
            <button
              type="button"
              onClick={() => void fetchGroupDetail()}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-rose-600 px-4 text-xs font-semibold text-white hover:bg-rose-700 cursor-pointer"
            >
              Retry
            </button>
          </div>
        </div>
      </AppLayout>
    );
  }

  async function handleGenerateShareToken() {
    if (!group) return;
    setGeneratingToken(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/groups/${encodeURIComponent(group.id)}/share-token`, {
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
      setAlertBanner({ type: "error", text: err instanceof Error ? err.message : "Failed to generate share link." });
    } finally {
      setGeneratingToken(false);
    }
  }

  return (
    <AppLayout
      title={group.name}
      subtitle={group.description}
      headerActions={
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Link
            to="/group"
            aria-label="All groups"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 sm:px-3 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">All Groups</span>
          </Link>
          <Link
            to={`/groups/${group.id}/analytics`}
            state={{ group }}
            aria-label="Group insights"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 sm:px-3 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
          >
            <BarChart3 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Insights</span>
          </Link>
          <Link
            to={`/expenses?groupId=${group.id}`}
            aria-label="Add expense"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-indigo-600 px-2 text-xs font-semibold text-white shadow-xs transition hover:bg-indigo-700 sm:px-3.5"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add Expense</span>
          </Link>
          <button
            type="button"
            onClick={handleGenerateShareToken}
            disabled={generatingToken}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 sm:px-3 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 cursor-pointer disabled:opacity-50"
            aria-label="Share group"
          >
            <Share2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Share</span>
          </button>
        </div>
      }
    >
      <style>{`
        @keyframes settlePopIn {
          0% { opacity: 0; transform: translateY(-16px) scale(0.94); }
          70% { opacity: 1; transform: translateY(2px) scale(1.015); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes checkPulseRing {
          0% { transform: scale(0.9); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.5); }
          70% { transform: scale(1.04); box-shadow: 0 0 0 12px rgba(16, 185, 129, 0); }
          100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }
        @keyframes shrinkToastProgress {
          from { width: 100%; }
          to { width: 0%; }
        }
        @keyframes settledCardFlash {
          0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.45); }
          40% { box-shadow: 0 0 0 8px rgba(16, 185, 129, 0.16); }
          100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }
        .animate-settle-toast {
          animation: settlePopIn 0.38s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        .animate-check-pulse {
          animation: checkPulseRing 1.1s ease-out 2;
        }
        .animate-toast-progress {
          animation: shrinkToastProgress 3.4s linear forwards;
        }
        .animate-settled-flash {
          animation: settledCardFlash 2.1s ease-out forwards;
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-settle-toast,
          .animate-check-pulse,
          .animate-toast-progress,
          .animate-settled-flash {
            animation: none;
          }
        }
      `}</style>

      {celebrationToast && (
        <div
          key={celebrationToast.id}
          role="status"
          aria-live="polite"
          className="animate-settle-toast fixed top-20 right-3 left-3 z-50 w-auto max-w-sm overflow-hidden rounded-2xl border border-emerald-300 bg-white shadow-2xl sm:right-6 sm:left-auto dark:border-emerald-700/70 dark:bg-zinc-900"
        >
          <div className="flex items-start gap-2.5 p-3 sm:items-center sm:gap-3.5 sm:p-4">
            <div className="animate-check-pulse mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white sm:mt-0 sm:h-11 sm:w-11">
              <Check className="h-6 w-6 stroke-[3]" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 flex-col items-start gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                <p className="font-display text-sm font-extrabold leading-tight text-emerald-700 dark:text-emerald-300">
                  {celebrationToast.headline}
                </p>
                {celebrationToast.amountLabel && (
                  <span className="max-w-full rounded-lg bg-emerald-50 px-2 py-0.5 font-display text-xs font-extrabold text-emerald-700 tabular-nums dark:bg-emerald-950 dark:text-emerald-300">
                    {celebrationToast.amountLabel}
                  </span>
                )}
              </div>
              <p className="mt-1 break-words text-[11px] leading-4 text-slate-600 sm:mt-0.5 sm:truncate sm:text-xs dark:text-zinc-300">
                {celebrationToast.subtext}
              </p>
            </div>

            <button
              type="button"
              aria-label="Dismiss success message"
              onClick={() => setCelebrationToast(null)}
              className="shrink-0 self-start rounded-lg p-1 text-slate-400 hover:bg-slate-100 sm:self-center dark:hover:bg-zinc-800 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="h-1 w-full bg-emerald-100 dark:bg-emerald-950">
            <div className="animate-toast-progress h-full bg-emerald-500" />
          </div>
        </div>
      )}

      <div className="space-y-6">
        {/* Top Metadata & Simplify Toggle Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-indigo-50 px-3 text-xs font-bold leading-none text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
              {group.type === "CUSTOM" && <Tag className="h-3 w-3" />}
              {group.type === "CUSTOM" && group.customTypeLabel
                ? group.customTypeLabel
                : group.type}
            </span>
            <button
              type="button"
              disabled={pendingTransfers.length === 0}
              onClick={() => {
                navigator.clipboard?.writeText(`${window.location.origin}/join/${group.id}`);
                setCopiedLink(true);
                setTimeout(() => setCopiedLink(false), 2000);
              }}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold leading-none text-slate-700 transition hover:bg-slate-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 cursor-pointer"
            >
              {copiedLink ? (
                <Check className="h-3.5 w-3.5 text-emerald-500" />
              ) : (
                <Link2 className="h-3.5 w-3.5" />
              )}
              {copiedLink ? "Invite Link Copied" : "Copy 72h Invite Link"}
            </button>
          </div>

          <button
            type="button"
            onClick={handleToggleSimplifyDebts}
            className={`inline-flex h-8 items-center gap-2 rounded-full border px-3.5 text-xs font-semibold leading-none transition cursor-pointer ${
              group.simplifyDebts
                ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-950/50 dark:text-emerald-300"
                : "border-slate-200 bg-white text-slate-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Simplify Debts: {group.simplifyDebts ? "ON" : "OFF"}
          </button>
        </div>

        {/* Alert Banner */}
        {alertBanner && (
          <div
            className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-xs font-medium ${
              alertBanner.type === "error"
                ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300"
                : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
            }`}
          >
            <div className="flex items-center gap-2">
              {alertBanner.type === "error" ? (
                <AlertCircle className="h-4 w-4 shrink-0" />
              ) : (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              )}
              <span>{alertBanner.text}</span>
            </div>
            <button onClick={() => setAlertBanner(null)} className="opacity-70 hover:opacity-100">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* 4-Card Group Financial Summary (compact 2x2 on mobile) */}
        <section className="grid grid-cols-2 gap-2.5 sm:gap-4 xl:grid-cols-4">
          <div className="flex min-w-0 flex-col rounded-xl border border-slate-200/90 bg-white p-3 shadow-2xs sm:rounded-2xl sm:p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between gap-1.5">
              <span className="min-w-0 truncate text-[10px] font-bold uppercase tracking-wider text-slate-500 sm:text-xs dark:text-zinc-400">
                Total Spend
              </span>
              <span className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 sm:flex dark:bg-indigo-950/60 dark:text-indigo-400">
                <Receipt className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-1.5 truncate font-display text-base font-extrabold text-slate-900 tabular-nums sm:mt-2 sm:text-2xl dark:text-white">
              {formatINR(totalGroupSpend, currencyCode)}
            </p>
            <p className="mt-0.5 truncate text-[10px] text-slate-500 sm:mt-1 sm:text-xs dark:text-zinc-400">
              {expensesList.length} recorded bills
            </p>
          </div>

          <div className="flex min-w-0 flex-col rounded-xl border border-indigo-200/80 bg-white p-3 shadow-2xs sm:rounded-2xl sm:p-5 dark:border-indigo-900/50 dark:bg-zinc-900">
            <div className="flex items-center justify-between gap-1.5">
              <span className="min-w-0 truncate text-[10px] font-bold uppercase tracking-wider text-indigo-600 sm:text-xs dark:text-indigo-400">
                Your Spend
              </span>
              <span className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 sm:flex dark:bg-indigo-950/60 dark:text-indigo-400">
                <CreditCard className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-1.5 truncate font-display text-base font-extrabold text-indigo-600 tabular-nums sm:mt-2 sm:text-2xl dark:text-indigo-400">
              {formatINR(myPersonalGroupSpend, currencyCode)}
            </p>
            <p className="mt-0.5 truncate text-[10px] text-slate-500 sm:mt-1 sm:text-xs dark:text-zinc-400">
              Share • Fronted {formatINR(myPaidInGroup, currencyCode)}
            </p>
          </div>

          <div className="flex min-w-0 flex-col rounded-xl border border-slate-200/90 bg-white p-3 shadow-2xs sm:rounded-2xl sm:p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between gap-1.5">
              <span className="min-w-0 truncate text-[10px] font-bold uppercase tracking-wider text-slate-500 sm:text-xs dark:text-zinc-400">
                {myNetBalance > 0
                  ? "To Receive"
                  : myNetBalance < 0
                    ? "To Give"
                    : "Net Position"}
              </span>
              <span
                className={`hidden h-8 w-8 shrink-0 items-center justify-center rounded-xl sm:flex ${
                  myNetBalance > 0
                    ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400"
                    : myNetBalance < 0
                      ? "bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400"
                      : "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300"
                }`}
              >
                <ArrowUpDown className="h-4 w-4" />
              </span>
            </div>
            <p
              className={`mt-1.5 truncate font-display text-base font-extrabold tabular-nums sm:mt-2 sm:text-2xl ${
                myNetBalance > 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : myNetBalance < 0
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-slate-700 dark:text-zinc-300"
              }`}
            >
              {myNetBalance > 0
                ? `+${formatINR(myNetBalance, currencyCode)}`
                : myNetBalance < 0
                  ? formatINR(Math.abs(myNetBalance), currencyCode)
                  : "Settled"}
            </p>
            <p className="mt-0.5 truncate text-[10px] text-slate-500 sm:mt-1 sm:text-xs dark:text-zinc-400">
              {myNetBalance > 0
                ? "Friends owe you"
                : myNetBalance < 0
                  ? "Pending you owe"
                  : "All settled up"}
            </p>
          </div>

          <div className="flex min-w-0 flex-col rounded-xl border border-emerald-200/80 bg-white p-3 shadow-2xs sm:rounded-2xl sm:p-5 dark:border-emerald-900/50 dark:bg-zinc-900">
            <div className="flex items-center justify-between gap-1.5">
              <span className="min-w-0 truncate text-[10px] font-bold uppercase tracking-wider text-emerald-600 sm:text-xs dark:text-emerald-400">
                Settled
              </span>
              <span className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 sm:flex dark:bg-emerald-950/60 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-1.5 truncate font-display text-base font-extrabold text-emerald-600 tabular-nums sm:mt-2 sm:text-2xl dark:text-emerald-400">
              {formatINR(totalGroupSettled, currencyCode)}
            </p>
            <p className="mt-0.5 truncate text-[10px] text-slate-500 sm:mt-1 sm:text-xs dark:text-zinc-400">
              {settlementsList.length} paid • {pendingTransfers.length} pending
            </p>
          </div>
        </section>

        {/* Main 12-Column Workspace */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* LEFT 7 COLS: CLEAN EXPENSE LEDGER + FILTER MODAL TRIGGER */}
          <div className="space-y-4 lg:col-span-7">
            <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs sm:p-6 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex flex-col justify-between gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center dark:border-zinc-800">
                <div>
                  <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                    All Expenses in Group ({filteredExpenses.length} of {expensesList.length})
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Settled bills can be reopened within 24 hours of payment
                  </p>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  {(activeFilterCount > 0 || searchExpense.trim() !== "") && (
                    <button
                      type="button"
                      onClick={resetAllFilters}
                      className="inline-flex h-9 items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-2.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 cursor-pointer"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Reset
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={openFilterModal}
                    className={`inline-flex h-9 items-center gap-2 rounded-xl border px-3.5 text-xs font-semibold transition cursor-pointer ${
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

              <div className="relative mt-4">
                <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search expenses by title, payer, or notes..."
                  value={searchExpense}
                  onChange={(e) => setSearchExpense(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pr-3.5 pl-10 text-xs outline-none transition focus:border-indigo-500 focus:bg-white dark:border-zinc-800 dark:bg-zinc-950"
                />
              </div>

              {activeFilterCount > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {expenseFilter !== "ALL" && (
                    <span className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300">
                      Status: {expenseFilter === "PENDING" ? "Unsettled" : "Completed"}
                    </span>
                  )}
                  {dateFilter !== "ALL" && (
                    <span className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300">
                      Date: {dateFilter.replace("_", " ")}
                    </span>
                  )}
                  {paidByFilter !== "ALL" && (
                    <span className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300">
                      Paid by: {membersList.find((m) => m.id === paidByFilter)?.name}
                    </span>
                  )}
                  {splitTypeFilter !== "ALL" && (
                    <span className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300">
                      Split: {splitTypeFilter}
                    </span>
                  )}
                  {expenseSort !== "RECENT" && (
                    <span className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300">
                      Sorted
                    </span>
                  )}
                </div>
              )}

              {filteredExpenses.length === 0 ? (
                <div className="mt-6 rounded-2xl border border-dashed border-slate-200 p-8 text-center dark:border-zinc-800">
                  <Receipt className="mx-auto h-8 w-8 text-slate-400" />
                  <p className="mt-2 text-sm font-semibold text-slate-700 dark:text-zinc-300">
                    {expensesList.length === 0
                      ? "No expenses recorded in this group yet"
                      : "No expenses match this filter"}
                  </p>
                  {activeFilterCount > 0 || searchExpense.trim() !== "" ? (
                    <button
                      type="button"
                      onClick={resetAllFilters}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-slate-50 dark:border-zinc-700 dark:text-indigo-400 cursor-pointer"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Reset Filters
                    </button>
                  ) : (
                    <Link
                      to={`/expenses?groupId=${group.id}`}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add First Expense
                    </Link>
                  )}
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {filteredExpenses.map((exp) => {
                    const amountPaidByMe = exp.payers.reduce(
                      (sum, payer) =>
                        sum + (payer.memberId === currentUserMemberId ? payer.amount : 0),
                      0,
                    );
                    const CategoryIcon = EXPENSE_CATEGORY_ICONS[exp.category] ?? Receipt;
                    const netDiff = amountPaidByMe - exp.yourShare;
                    const hasLent = netDiff > 0.009;
                    const owes = netDiff < -0.009;
                    const commentsOpen = expandedCommentExpId === exp.id;
                    const reopenInfo = getReopenStatus(exp, nowMs);
                    const isFlashing = Boolean(recentlySettledIds[exp.id]);

                    return (
                      <div
                        key={exp.id}
                        className={`rounded-2xl border p-4 transition ${
                          isFlashing ? "animate-settled-flash" : ""
                        } ${
                          exp.isSettled
                            ? "border-slate-200/70 bg-slate-50/70 dark:border-zinc-800/80 dark:bg-zinc-950/50"
                            : "border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
                        }`}
                      >
                        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                aria-hidden="true"
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400"
                              >
                                <CategoryIcon className="h-4 w-4" />
                              </span>
                              <h3
                                className={`text-sm font-bold ${
                                  exp.isSettled
                                    ? "text-slate-500 line-through dark:text-zinc-400"
                                    : "text-slate-900 dark:text-white"
                                }`}
                              >
                                {exp.title}
                              </h3>
                              {exp.isSettled ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-400">
                                  <CheckCircle2 className="h-3 w-3" />
                                  Completed
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-950/70 dark:text-amber-400">
                                  <Clock className="h-3 w-3" />
                                  Active
                                </span>
                              )}
                            </div>

                            <p className="text-xs text-slate-500 dark:text-zinc-400">
                              Paid by{" "}
                              <strong className="font-semibold text-slate-700 dark:text-zinc-200">
                                {exp.paidByName}
                              </strong>{" "}
                              • Total{" "}
                              <strong className="tabular-nums">
                                {formatINR(exp.totalAmount, currencyCode)}
                              </strong>{" "}
                              ({exp.splitType} via {exp.paymentMethod}) • {exp.date}
                            </p>

                            {exp.notes && (
                              <p className="text-xs italic text-slate-400">{exp.notes}</p>
                            )}
                          </div>

                          <div className="text-left sm:text-right">
                            <p
                              className={`text-sm font-extrabold tabular-nums ${
                                exp.isSettled
                                  ? "text-slate-400"
                                  : hasLent
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : owes
                                      ? "text-rose-600 dark:text-rose-400"
                                      : "text-slate-500 dark:text-zinc-400"
                              }`}
                            >
                              {hasLent
                                ? `You lent ${formatINR(netDiff, currencyCode)}`
                                : owes
                                  ? `You owe ${formatINR(Math.abs(netDiff), currencyCode)}`
                                  : "Settled up"}
                            </p>
                            <p className="text-[11px] text-slate-400 tabular-nums">
                              Your share: {formatINR(exp.yourShare, currencyCode)}
                            </p>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2.5 dark:border-zinc-800">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedCommentExpId(commentsOpen ? null : exp.id)
                            }
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-indigo-600 dark:text-zinc-400 cursor-pointer"
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                            {exp.comments.length} Comment{exp.comments.length === 1 ? "" : "s"}
                          </button>

                          <div className="flex flex-wrap items-center gap-2">
                            {!exp.isSettled && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setEditingExpense(exp)}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 dark:border-indigo-900/60 dark:text-indigo-300 dark:hover:bg-indigo-950/50"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleToggleExpenseSettled(exp)}
                                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 cursor-pointer"
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  Mark as Completed
                                </button>
                              </>
                            )}
                            {exp.isSettled && reopenInfo.canReopen ? (
                              <button
                                type="button"
                                onClick={() => handleToggleExpenseSettled(exp)}
                                title="Reopen is available for 24 hours after payment"
                                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 transition hover:bg-amber-100 dark:bg-amber-950/60 dark:text-amber-300 cursor-pointer"
                              >
                                <Clock className="h-3.5 w-3.5" />
                                Reopen Bill ({reopenInfo.timeLeft} left)
                              </button>
                            ) : exp.isSettled ? (
                              <span
                                title="More than 24 hours have passed since payment; bill can no longer be reopened"
                                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-500"
                              >
                                <Lock className="h-3 w-3" />
                                Locked (reopen expired)
                              </span>
                            ) : null}
                          </div>
                        </div>

                        {commentsOpen && (
                          <div className="mt-3 space-y-2 rounded-xl bg-slate-50 p-3 dark:bg-zinc-950">
                            {exp.comments.map((c) => (
                              <div key={c.id} className="text-xs">
                                <span className="font-bold text-slate-800 dark:text-zinc-200">
                                  {c.author}
                                </span>{" "}
                                <span className="text-slate-400">({c.time}):</span>{" "}
                                <span className="text-slate-600 dark:text-zinc-300">{c.text}</span>
                              </div>
                            ))}
                            <form
                              onSubmit={(e) => handlePostComment(exp.id, e)}
                              className="flex gap-2 pt-1"
                            >
                              <input
                                placeholder="Add a note or question on this bill..."
                                value={commentText}
                                onChange={(e) => setCommentText(e.target.value)}
                                className="h-8 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-900"
                              />
                              <button
                                type="submit"
                                className="inline-flex h-8 items-center gap-1 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white cursor-pointer"
                              >
                                <Send className="h-3 w-3" />
                              </button>
                            </form>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT 5 COLS: SETTLEMENT ACTIONS + SETTLED PAYMENTS + GROUP MEMBERS */}
          <div className="space-y-6 lg:col-span-5">
            {/* 1. Pending Settlements with Full & Partial/Manual Amount Support */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Handshake className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                    Who Needs to Give Whom
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (showCustomSettleForm) {
                      setShowCustomSettleForm(false);
                      return;
                    }
                    const firstDebtor = membersList.find((member) => member.netBalance < -0.009);
                    const firstCreditor = membersList.find((member) => member.netBalance > 0.009);
                    const fromId =
                      firstDebtor?.id ?? currentUserMemberId ?? membersList[0]?.id ?? "";
                    const toId =
                      firstCreditor?.id ??
                      membersList.find((member) => member.id !== fromId)?.id ??
                      "";
                    setManualFromId(fromId);
                    setManualToId(toId);
                    setShowCustomSettleForm(true);
                  }}
                  className="text-xs font-semibold text-indigo-600 hover:underline disabled:cursor-not-allowed disabled:opacity-40 dark:text-indigo-400 cursor-pointer"
                >
                  {showCustomSettleForm ? "Close form" : "+ Manual amount"}
                </button>
              </div>

              {showCustomSettleForm && (
                <form
                  onSubmit={handleManualSettlementSubmit}
                  className="mt-4 space-y-3 rounded-2xl border border-indigo-200/80 bg-indigo-50/40 p-4 dark:border-indigo-900/50 dark:bg-indigo-950/25"
                >
                  <p className="text-xs font-bold text-indigo-700 dark:text-indigo-300">
                    Record Manual / Partial Payment
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-300">
                        Who Paid
                      </label>
                      <div className="relative mt-1">
                        <select
                          value={manualFromId}
                          onChange={(e) => {
                            const nextFromId = e.target.value;
                            setManualFromId(nextFromId);
                            if (nextFromId === manualToId) {
                              setManualToId(
                                membersList.find(
                                  (member) =>
                                    member.netBalance > 0.009 && member.id !== nextFromId,
                                )?.id ?? "",
                              );
                            }
                          }}
                          className="h-9 w-full appearance-none rounded-xl border border-slate-200 bg-white pr-7 pl-2.5 text-xs font-semibold dark:border-zinc-800 dark:bg-zinc-900"
                        >
                          {membersList.filter((m) => m.netBalance < -0.009).map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute top-1/2 right-2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-300">
                        Paid To
                      </label>
                      <div className="relative mt-1">
                        <select
                          value={manualToId}
                          onChange={(e) => setManualToId(e.target.value)}
                          className="h-9 w-full appearance-none rounded-xl border border-slate-200 bg-white pr-7 pl-2.5 text-xs font-semibold dark:border-zinc-800 dark:bg-zinc-900"
                        >
                          {membersList
                            .filter((m) => m.netBalance > 0.009)
                            .map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name}
                              </option>
                            ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute top-1/2 right-2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-300">
                        Amount ({currencyCode})
                      </label>
                      <input
                        required
                        type="number"
                        step="0.01"
                        min="0.01"
                        placeholder="e.g. 500.00"
                        value={manualAmount}
                        onChange={(e) => setManualAmount(e.target.value)}
                        className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold tabular-nums outline-none focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-300">
                        Method
                      </label>
                      <div className="relative mt-1">
                        <select
                          value={manualMethod}
                          onChange={(e) => setManualMethod(e.target.value)}
                          className="h-9 w-full appearance-none rounded-xl border border-slate-200 bg-white pr-7 pl-2.5 text-xs font-semibold dark:border-zinc-800 dark:bg-zinc-900"
                        >
                          <option value="UPI">UPI</option>
                          <option value="Cash">Cash</option>
                          <option value="Bank Transfer">Bank Transfer</option>
                        </select>
                        <ChevronDown className="pointer-events-none absolute top-1/2 right-2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                      </div>
                    </div>
                  </div>

                  <input
                    placeholder="Optional UPI / Transaction Ref ID"
                    value={manualRefId}
                    onChange={(e) => setManualRefId(e.target.value)}
                    className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-900"
                  />

                  <button
                    type="submit"
                    className="flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-700 cursor-pointer"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Record Custom Settlement
                  </button>
                </form>
              )}

              {pendingTransfers.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-emerald-200/80 bg-emerald-50/70 p-4 text-center dark:border-emerald-900/50 dark:bg-emerald-950/30">
                  <CheckCircle2 className="mx-auto h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                  <p className="mt-1.5 text-sm font-bold text-emerald-800 dark:text-emerald-300">
                    Everyone is completely settled up!
                  </p>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {pendingTransfers.map((tr) => {
                    const isCustomOpen = customPayTransferId === tr.id;
                    const halfAmount = Math.round((tr.amount / 2) * 100) / 100;

                    return (
                      <div
                        key={tr.id}
                        className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3.5 dark:border-zinc-800 dark:bg-zinc-950/60"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-medium text-slate-700 dark:text-zinc-200">
                            <strong className="font-bold">{tr.fromName}</strong> needs to give{" "}
                            <strong className="font-bold">{tr.toName}</strong>
                          </p>
                          <span
                            className={`font-display text-sm font-extrabold tabular-nums ${
                              tr.fromId === currentUserMemberId
                                ? "text-rose-600 dark:text-rose-400"
                                : "text-emerald-600 dark:text-emerald-400"
                            }`}
                          >
                            {formatINR(tr.amount, currencyCode)}
                          </span>
                        </div>

                        {tr.toUpi && (
                          <div className="mt-2 flex items-center justify-between rounded-lg bg-white px-2.5 py-1.5 text-[11px] text-slate-500 dark:bg-zinc-900 dark:text-zinc-400">
                            <span>UPI: {tr.toUpi}</span>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard?.writeText(tr.toUpi!);
                                setCopiedUpi(tr.id);
                                setTimeout(() => setCopiedUpi(null), 2000);
                              }}
                              className="inline-flex items-center gap-1 font-semibold text-indigo-600 dark:text-indigo-400 cursor-pointer"
                            >
                              <Copy className="h-3 w-3" />
                              {copiedUpi === tr.id ? "Copied" : "Copy UPI"}
                            </button>
                          </div>
                        )}

                        {!isCustomOpen ? (
                          <div className="mt-2.5 grid grid-cols-12 gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                applySettlement({
                                  fromId: tr.fromId,
                                  fromName: tr.fromName,
                                  toId: tr.toId,
                                  toName: tr.toName,
                                  amount: tr.amount,
                                  method: "UPI",
                                })
                              }
                              className="col-span-7 flex h-9 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-xs font-semibold text-white transition hover:bg-emerald-700 cursor-pointer"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Settle Full
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setCustomPayTransferId(tr.id);
                                setCustomPayAmount(String(halfAmount));
                              }}
                              className="col-span-5 flex h-9 items-center justify-center rounded-xl border border-indigo-200 bg-white px-2.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-50 dark:border-indigo-800 dark:bg-zinc-900 dark:text-indigo-300 cursor-pointer"
                            >
                              Custom ₹
                            </button>
                          </div>
                        ) : (
                          <div className="mt-3 space-y-2.5 rounded-xl border border-indigo-200 bg-white p-3 dark:border-indigo-800/60 dark:bg-zinc-900">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-slate-700 dark:text-zinc-200">
                                Enter manual amount to settle
                              </span>
                              <button
                                type="button"
                                onClick={() => setCustomPayTransferId(null)}
                                className="text-slate-400 hover:text-slate-600"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>

                            <div className="flex gap-1.5">
                              <button
                                type="button"
                                onClick={() => setCustomPayAmount(String(halfAmount))}
                                className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:border-indigo-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 cursor-pointer"
                              >
                                Half ({formatINR(halfAmount, currencyCode)})
                              </button>
                              <button
                                type="button"
                                onClick={() => setCustomPayAmount(String(tr.amount))}
                                className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:border-indigo-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 cursor-pointer"
                              >
                                Full ({formatINR(tr.amount, currencyCode)})
                              </button>
                            </div>

                            <div className="flex gap-2">
                              <div className="relative flex-1">
                                <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-xs text-slate-400">
                                  ₹
                                </span>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0.01"
                                  max={tr.amount}
                                  value={customPayAmount}
                                  onChange={(e) => setCustomPayAmount(e.target.value)}
                                  className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pr-2.5 pl-6 text-xs font-bold tabular-nums outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-950"
                                />
                              </div>

                              <div className="relative">
                                <select
                                  value={customPayMethod}
                                  onChange={(e) => setCustomPayMethod(e.target.value)}
                                  className="h-9 appearance-none rounded-lg border border-slate-200 bg-slate-50 pr-7 pl-2.5 text-xs font-semibold dark:border-zinc-700 dark:bg-zinc-950"
                                >
                                  <option value="UPI">UPI</option>
                                  <option value="Cash">Cash</option>
                                  <option value="Bank Transfer">Bank</option>
                                </select>
                                <ChevronDown className="pointer-events-none absolute top-1/2 right-2 h-3 w-3 -translate-y-1/2 text-slate-400" />
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleConfirmCustomTransfer(tr)}
                              className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-700 cursor-pointer"
                            >
                              <Check className="h-3.5 w-3.5" />
                              Confirm{" "}
                              {customPayAmount
                                ? formatINR(parseFloat(customPayAmount) || 0, currencyCode)
                                : "Payment"}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 2. Completed Settlements Activity Log */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" />
                  </span>
                  <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                    Settled Payments ({settlementsList.length})
                  </h2>
                </div>
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  {formatINR(totalGroupSettled, currencyCode)} settled
                </span>
              </div>

              {settlementsList.length === 0 ? (
                <p className="mt-3 rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400 dark:border-zinc-800">
                  No settlements recorded in this group yet. Use &ldquo;Settle Full&rdquo; or
                  &ldquo;Custom ₹&rdquo; above to record a payment.
                </p>
              ) : (
                <div className="mt-3 space-y-2.5">
                  {settlementsList.map((cs) => (
                    <div
                      key={cs.id}
                      className={`rounded-xl border border-emerald-200/70 bg-emerald-50/50 p-3 text-xs dark:border-emerald-900/40 dark:bg-emerald-950/25 ${
                        recentlySettledIds[cs.id] ? "animate-settled-flash" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                          <p className="font-semibold text-slate-900 dark:text-white">
                            <strong>{cs.from}</strong> settled{" "}
                            <span className="font-extrabold text-emerald-700 tabular-nums dark:text-emerald-300">
                              {formatINR(cs.amount, currencyCode)}
                            </span>{" "}
                            to <strong>{cs.to}</strong>
                          </p>
                        </div>
                        <span className="text-[11px] text-slate-400">{cs.completedAt}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center justify-between gap-2 pl-6 text-[11px] text-slate-500 dark:text-zinc-400">
                        <span>
                          Paid via {cs.method}
                          {cs.referenceId ? ` • Ref: ${cs.referenceId}` : ""}
                        </span>
                        {typeof cs.remainingAfter === "number" && (
                          <span
                            className={`font-semibold tabular-nums ${
                              cs.remainingAfter === 0
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-amber-600 dark:text-amber-400"
                            }`}
                          >
                            {cs.remainingAfter === 0
                              ? "Fully settled"
                              : `${formatINR(cs.remainingAfter, currencyCode)} remaining`}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 3. Group Members & Individual Balances + Settled Badges */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
                    <Users className="h-4 w-4" />
                  </span>
                  <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                    Group Members ({membersList.length})
                  </h2>
                </div>
                {isGroupCreator && (
                  <button
                    type="button"
                    onClick={() => setMembersModalOpen(true)}
                    className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-indigo-600 px-3 text-xs font-semibold text-white hover:bg-indigo-700"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Manage members</span>
                    <span className="sm:hidden">Manage</span>
                  </button>
                )}
              </div>

              <div className="mt-3 divide-y divide-slate-100 dark:divide-zinc-800">
                {membersList.map((m) => {
                  const stats = memberSettlementStats[m.id] ?? { paidOut: 0, received: 0 };

                  return (
                    <div key={m.id} className="flex items-start justify-between gap-2 py-3">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-semibold text-slate-900 dark:text-white">
                            {m.name}
                          </span>
                          {m.role === "ADMIN" && (
                            <Shield className="h-3.5 w-3.5 text-indigo-500" />
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400">{m.email}</p>

                        {(stats.paidOut > 0 || stats.received > 0) && (
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {stats.paidOut > 0 && (
                              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 tabular-nums dark:bg-emerald-950/70 dark:text-emerald-300">
                                <CheckCircle2 className="h-2.5 w-2.5" />
                                Settled {formatINR(stats.paidOut, currencyCode)}
                              </span>
                            )}
                            {stats.received > 0 && (
                              <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 tabular-nums dark:bg-indigo-950/70 dark:text-indigo-300">
                                Received {formatINR(stats.received, currencyCode)}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="text-right">
                        <span
                          className={`text-xs font-bold tabular-nums ${
                            m.netBalance > 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : m.netBalance < 0
                                ? "text-rose-600 dark:text-rose-400"
                                : "text-slate-500 dark:text-zinc-400"
                          }`}
                        >
                          {m.netBalance > 0
                            ? `Receives ${formatINR(m.netBalance, currencyCode)}`
                            : m.netBalance < 0
                              ? `Gives ${formatINR(Math.abs(m.netBalance), currencyCode)}`
                              : "Settled up"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>

            {/* Leave Group Action */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleLeaveGroup}
                className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40 cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Leave Group
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* EXPENSE FILTER & SORT MODAL */}
      {filterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-xs sm:items-center sm:p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-slate-200 bg-white p-6 shadow-2xl sm:rounded-3xl dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
                  <SlidersHorizontal className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                    Filter &amp; Sort Expenses
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                    Refine bills in {group.name}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setFilterModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 space-y-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                  Bill Status
                </label>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {[
                    { id: "ALL" as const, label: "All Bills" },
                    { id: "PENDING" as const, label: "Unsettled" },
                    { id: "COMPLETED" as const, label: "Completed" },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setDraftStatus(item.id)}
                      className={`h-9 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                        draftStatus === item.id
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
                <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                  <Calendar className="h-3.5 w-3.5 text-indigo-500" />
                  Date Range
                </label>
                <div className="relative mt-2">
                  <select
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
                    <option value="CUSTOM">Custom Date Range</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>

                {draftDateFilter === "CUSTOM" && (
                  <div className="mt-2.5 grid grid-cols-2 gap-2.5 rounded-xl border border-indigo-100 bg-indigo-50/40 p-3 dark:border-indigo-900/40 dark:bg-indigo-950/25">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-300">
                        From Date
                      </label>
                      <input
                        type="date"
                        value={draftFromDate}
                        onChange={(e) => setDraftFromDate(e.target.value)}
                        className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold outline-none focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-300">
                        To Date
                      </label>
                      <input
                        type="date"
                        value={draftToDate}
                        onChange={(e) => setDraftToDate(e.target.value)}
                        className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold outline-none focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-900"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                    <Filter className="h-3 w-3 text-indigo-500" />
                    Paid By
                  </label>
                  <div className="relative mt-2">
                    <select
                      value={draftPaidBy}
                      onChange={(e) => setDraftPaidBy(e.target.value)}
                      className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 pr-9 pl-3 text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 cursor-pointer"
                    >
                      <option value="ALL">Everyone</option>
                      {membersList.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                    Split Method
                  </label>
                  <div className="relative mt-2">
                    <select
                      value={draftSplitType}
                      onChange={(e) =>
                        setDraftSplitType(e.target.value as "ALL" | SplitMethod)
                      }
                      className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 pr-9 pl-3 text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 cursor-pointer"
                    >
                      <option value="ALL">All Split Types</option>
                      <option value="EQUAL">Equal Split</option>
                      <option value="EXACT">Exact Amount</option>
                      <option value="PERCENTAGE">Percentage (%)</option>
                      <option value="SHARES">Shares</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  </div>
                </div>
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                  <ArrowUpDown className="h-3.5 w-3.5 text-indigo-500" />
                  Sort By
                </label>
                <div className="relative mt-2">
                  <select
                    value={draftSort}
                    onChange={(e) =>
                      setDraftSort(e.target.value as ExpenseSortOption)
                    }
                    className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 pr-9 pl-3.5 text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 cursor-pointer"
                  >
                    <option value="RECENT">Latest First</option>
                    <option value="AMOUNT_DESC">Total Amount: High to Low</option>
                    <option value="AMOUNT_ASC">Total Amount: Low to High</option>
                    <option value="MY_SHARE_DESC">Your Share: High to Low</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between gap-2.5 border-t border-slate-100 pt-4 dark:border-zinc-800">
              <button
                type="button"
                onClick={resetAllFilters}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 px-4 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-zinc-800 dark:text-zinc-300 cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset All
              </button>

              <button
                type="button"
                onClick={applyFilterModal}
                className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-5 text-xs font-bold text-white shadow-xs transition hover:bg-indigo-700 cursor-pointer"
              >
                <Check className="h-4 w-4" />
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}
      {isGroupCreator && group && (
        <GroupMembersModal
          open={membersModalOpen}
          groupId={group.id}
          groupName={group.name}
          members={membersList}
          onClose={() => setMembersModalOpen(false)}
          onMembersChanged={() => fetchGroupDetail(false)}
        />
      )}
      {group && editingExpense && (
        <EditExpenseModal
          open={Boolean(editingExpense)}
          groupId={group.id}
          expense={editingExpense}
          members={membersList}
          currencyCode={currencyCode}
          onClose={() => setEditingExpense(null)}
          onUpdated={() => fetchGroupDetail(false)}
        />
      )}
      <ShareModal
        groupId={group?.id || ""}
        isOpen={shareModalOpen}
        setIsOpen={setShareModalOpen}
        token={shareToken ?? undefined}
      />
    </AppLayout>
  );
}