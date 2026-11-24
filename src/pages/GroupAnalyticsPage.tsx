import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { ArrowLeft, BarChart3, Receipt, Users, Wallet } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import AppLayout from "../components/AppLayout";

interface AnalyticsExpense {
  id: string;
  title: string;
  category: string;
  totalAmount: number;
  yourShare: number;
  date: string;
}

interface AnalyticsMember {
  id: string;
  name: string;
  netBalance: number;
}

interface AnalyticsSettlement {
  id: string;
  amount: number;
}

interface AnalyticsGroup {
  id: string;
  name: string;
  description: string;
  currency: string;
  expenses: AnalyticsExpense[];
  members: AnalyticsMember[];
  completedSettlements: AnalyticsSettlement[];
}

interface CategoryDatum {
  name: string;
  amount: number;
  color: string;
}

interface MonthlyDatum {
  month: string;
  amount: number;
}

interface BalanceDatum {
  id: string;
  name: string;
  balance: number;
}

const CHART_COLORS = [
  "#6366f1",
  "#10b981",
  "#f59e0b",
  "#f43f5e",
  "#06b6d4",
  "#8b5cf6",
  "#64748b",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isAnalyticsExpense(value: unknown): value is AnalyticsExpense {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.category === "string" &&
    typeof value.totalAmount === "number" &&
    typeof value.yourShare === "number" &&
    typeof value.date === "string"
  );
}

function isAnalyticsMember(value: unknown): value is AnalyticsMember {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.netBalance === "number"
  );
}

function isAnalyticsSettlement(value: unknown): value is AnalyticsSettlement {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.amount === "number"
  );
}

function isAnalyticsGroup(value: unknown): value is AnalyticsGroup {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.description === "string" &&
    typeof value.currency === "string" &&
    Array.isArray(value.expenses) &&
    value.expenses.every(isAnalyticsExpense) &&
    Array.isArray(value.members) &&
    value.members.every(isAnalyticsMember) &&
    Array.isArray(value.completedSettlements) &&
    value.completedSettlements.every(isAnalyticsSettlement)
  );
}

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function parseExpenseDate(dateValue: string): Date | null {
  const normalized = dateValue.trim().toLowerCase();
  const now = new Date();

  if (normalized === "today" || normalized === "just now") return now;
  if (normalized === "yesterday") {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  }

  const parsed = new Date(dateValue);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export default function GroupAnalyticsPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const location = useLocation();
  const routeGroup = isRecord(location.state) ? location.state.group : undefined;
  const [group, setGroup] = useState<AnalyticsGroup | null>(() =>
    isAnalyticsGroup(routeGroup) && routeGroup.id === groupId ? routeGroup : null
  );
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (isAnalyticsGroup(routeGroup) && routeGroup.id === groupId) {
      setGroup(routeGroup);
      setLoadError(null);
      return;
    }

    try {
      const saved = localStorage.getItem(`splitmate_group_state_${groupId || "default"}`);
      if (!saved) {
        setGroup(null);
        setLoadError("Group details are not available on this device yet.");
        return;
      }

      const parsed: unknown = JSON.parse(saved);
      if (!isAnalyticsGroup(parsed) || parsed.id !== groupId) {
        setGroup(null);
        setLoadError("Group insights could not be loaded. Open the group and try again.");
        return;
      }

      setGroup(parsed);
      setLoadError(null);
    } catch (error) {
      console.error("Failed to load group analytics:", error);
      setGroup(null);
      setLoadError("Group insights could not be loaded. Open the group and try again.");
    }
  }, [groupId, routeGroup]);

  const expenses = group?.expenses ?? [];
  const members = group?.members ?? [];
  const currency = group?.currency ?? "INR";

  const totalSpend = useMemo(
    () => expenses.reduce((sum, expense) => sum + expense.totalAmount, 0),
    [expenses]
  );
  const totalYourShare = useMemo(
    () => expenses.reduce((sum, expense) => sum + expense.yourShare, 0),
    [expenses]
  );
  const totalSettled = useMemo(
    () => group?.completedSettlements.reduce((sum, settlement) => sum + settlement.amount, 0) ?? 0,
    [group?.completedSettlements]
  );
  const yourBalance = members.find((member) => member.id === "you")?.netBalance ?? 0;

  const categoryData = useMemo<CategoryDatum[]>(() => {
    const categories = new Map<string, number>();
    expenses.forEach((expense) => {
      const category = expense.category.trim() || "Other";
      categories.set(category, (categories.get(category) ?? 0) + expense.totalAmount);
    });

    return Array.from(categories, ([name, amount], index) => ({
      name,
      amount,
      color: CHART_COLORS[index % CHART_COLORS.length],
    })).sort((a, b) => b.amount - a.amount);
  }, [expenses]);

  const monthlyData = useMemo<MonthlyDatum[]>(() => {
    const monthlyTotals = new Map<string, { month: string; amount: number }>();
    expenses.forEach((expense) => {
      const date = parseExpenseDate(expense.date);
      if (!date) return;

      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const month = date.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
      const current = monthlyTotals.get(key) ?? { month, amount: 0 };
      current.amount += expense.totalAmount;
      monthlyTotals.set(key, current);
    });

    return Array.from(monthlyTotals.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([, datum]) => datum);
  }, [expenses]);

  const balanceData = useMemo<BalanceDatum[]>(
    () =>
      [...members]
        .sort((a, b) => Math.abs(b.netBalance) - Math.abs(a.netBalance))
        .map((member) => ({
          id: member.id,
          name: member.name,
          balance: member.netBalance,
        })),
    [members]
  );

  const backToGroup = groupId ? `/groups/${groupId}` : "/group";

  if (!group) {
    return (
      <AppLayout
        title="Group Insights"
        subtitle="Review spending, balances, and settlements"
        headerActions={
          <Link
            to={backToGroup}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Group
          </Link>
        }
      >
        <div
          role={loadError ? "alert" : "status"}
          className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
        >
          {loadError ?? "Loading group insights…"}
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title="Group Insights"
      subtitle={`${group.name} · Spending and settlement overview`}
      headerActions={
        <Link
          to={backToGroup}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 sm:px-3 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Back to Group</span>
          <span className="sm:hidden">Group</span>
        </Link>
      }
    >
      <div className="min-w-0 space-y-5 pb-[env(safe-area-inset-bottom)]">
        <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <div className="min-w-0 rounded-2xl border border-indigo-200/80 bg-white p-3 shadow-2xs sm:p-5 dark:border-indigo-900/50 dark:bg-zinc-900">
            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
              <Receipt className="h-4 w-4 shrink-0" />
              <span className="truncate text-[10px] font-bold uppercase tracking-wider sm:text-xs">
                Group Spend
              </span>
            </div>
            <p className="mt-2 truncate font-display text-base font-extrabold tabular-nums text-slate-900 sm:text-2xl dark:text-white">
              {formatCurrency(totalSpend, currency)}
            </p>
            <p className="mt-1 truncate text-[10px] text-slate-500 sm:text-xs dark:text-zinc-400">
              {expenses.length} expenses
            </p>
          </div>

          <div className="min-w-0 rounded-2xl border border-violet-200/80 bg-white p-3 shadow-2xs sm:p-5 dark:border-violet-900/50 dark:bg-zinc-900">
            <div className="flex items-center gap-2 text-violet-600 dark:text-violet-400">
              <Wallet className="h-4 w-4 shrink-0" />
              <span className="truncate text-[10px] font-bold uppercase tracking-wider sm:text-xs">
                Your Share
              </span>
            </div>
            <p className="mt-2 truncate font-display text-base font-extrabold tabular-nums text-violet-600 sm:text-2xl dark:text-violet-400">
              {formatCurrency(totalYourShare, currency)}
            </p>
            <p className="mt-1 truncate text-[10px] text-slate-500 sm:text-xs dark:text-zinc-400">
              Across {expenses.length} expenses
            </p>
          </div>

          <div className="min-w-0 rounded-2xl border border-emerald-200/80 bg-white p-3 shadow-2xs sm:p-5 dark:border-emerald-900/50 dark:bg-zinc-900">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <BarChart3 className="h-4 w-4 shrink-0" />
              <span className="truncate text-[10px] font-bold uppercase tracking-wider sm:text-xs">
                Settled
              </span>
            </div>
            <p className="mt-2 truncate font-display text-base font-extrabold tabular-nums text-emerald-600 sm:text-2xl dark:text-emerald-400">
              {formatCurrency(totalSettled, currency)}
            </p>
            <p className="mt-1 truncate text-[10px] text-slate-500 sm:text-xs dark:text-zinc-400">
              {group.completedSettlements.length} payments
            </p>
          </div>

          <div className="min-w-0 rounded-2xl border border-slate-200/90 bg-white p-3 shadow-2xs sm:p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center gap-2 text-slate-600 dark:text-zinc-300">
              <Users className="h-4 w-4 shrink-0" />
              <span className="truncate text-[10px] font-bold uppercase tracking-wider sm:text-xs">
                Your Balance
              </span>
            </div>
            <p
              className={`mt-2 truncate font-display text-base font-extrabold tabular-nums sm:text-2xl ${
                yourBalance > 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : yourBalance < 0
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-slate-700 dark:text-zinc-300"
              }`}
            >
              {yourBalance > 0
                ? `+${formatCurrency(yourBalance, currency)}`
                : yourBalance < 0
                  ? formatCurrency(yourBalance, currency)
                  : "Settled"}
            </p>
            <p className="mt-1 truncate text-[10px] text-slate-500 sm:text-xs dark:text-zinc-400">
              {members.length} group members
            </p>
          </div>
        </section>

        <section className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="min-w-0 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs sm:p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <div>
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                Spend by Category
              </h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                How the group’s expenses are distributed
              </p>
            </div>

            {categoryData.length ? (
              <>
                <div className="mt-3 h-56 min-w-0 sm:h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryData}
                        dataKey="amount"
                        nameKey="name"
                        innerRadius="55%"
                        outerRadius="82%"
                        paddingAngle={3}
                      >
                        {categoryData.map((item) => (
                          <Cell key={item.name} fill={item.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => formatCurrency(Number(value), currency)}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                  {categoryData.map((item) => (
                    <div key={item.name} className="flex min-w-0 items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="truncate text-xs text-slate-600 dark:text-zinc-300">
                        {item.name}
                      </span>
                      <span className="ml-auto shrink-0 text-[11px] font-semibold tabular-nums text-slate-500 dark:text-zinc-400">
                        {formatCurrency(item.amount, currency)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="mt-5 rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500 dark:border-zinc-800 dark:text-zinc-400">
                Add expenses to see a category breakdown.
              </p>
            )}
          </div>

          <div className="min-w-0 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs sm:p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <div>
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                Monthly Spending
              </h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                Group totals across the latest six months with activity
              </p>
            </div>

            {monthlyData.length ? (
              <div className="mt-4 h-64 min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#94a3b8" opacity={0.25} />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis
                      width={44}
                      tick={{ fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(value: number) =>
                        value >= 1000 ? `${Math.round(value / 1000)}k` : String(value)
                      }
                    />
                    <Tooltip
                      formatter={(value) => formatCurrency(Number(value), currency)}
                      cursor={{ fill: "#6366f1", opacity: 0.08 }}
                    />
                    <Bar dataKey="amount" name="Group spend" fill="#6366f1" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="mt-5 rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500 dark:border-zinc-800 dark:text-zinc-400">
                Expense dates will appear here once they are available.
              </p>
            )}
          </div>

          <div className="min-w-0 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs xl:col-span-2 sm:p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <div>
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                Member Balances
              </h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                Positive balances are receivable; negative balances are payable
              </p>
            </div>

            {balanceData.length ? (
              <div className="mt-4 min-w-0" style={{ height: Math.max(220, balanceData.length * 48) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={balanceData}
                    layout="vertical"
                    margin={{ top: 4, right: 12, bottom: 4, left: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#94a3b8" opacity={0.25} />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 10 }}
                      tickFormatter={(value: number) =>
                        value === 0 ? "0" : `${value > 0 ? "+" : ""}${Math.round(value / 100) / 10}k`
                      }
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={92}
                      tick={{ fontSize: 11 }}
                      tickFormatter={(value: string) =>
                        value.length > 13 ? `${value.slice(0, 12)}…` : value
                      }
                    />
                    <ReferenceLine x={0} stroke="#64748b" />
                    <Tooltip
                      formatter={(value) => formatCurrency(Number(value), currency)}
                    />
                    <Bar dataKey="balance" name="Net balance" radius={[0, 5, 5, 0]}>
                      {balanceData.map((item) => (
                        <Cell
                          key={item.id}
                          fill={
                            item.balance > 0
                              ? "#10b981"
                              : item.balance < 0
                                ? "#f43f5e"
                                : "#94a3b8"
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="mt-5 rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500 dark:border-zinc-800 dark:text-zinc-400">
                Add members to see the balance breakdown.
              </p>
            )}
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
