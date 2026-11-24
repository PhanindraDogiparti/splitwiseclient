import React, { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";

const API_BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");

export default function ExpenseDetailPage() {
  const { expenseId } = useParams<{ expenseId: string }>();
  const navigate = useNavigate();

  // Redirect to transactions page where they can see the full report
  useEffect(() => {
    if (expenseId) {
      navigate("/transactions", { replace: true });
    }
  }, [expenseId, navigate]);

  // Fallback render while redirecting
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex items-center justify-center">
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-indigo-600 border-t-transparent mx-auto mb-4"></div>
        <p className="text-slate-600 dark:text-zinc-400">Redirecting to transactions report...</p>
      </div>
    </div>
  );
}