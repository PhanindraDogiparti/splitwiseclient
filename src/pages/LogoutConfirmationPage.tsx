import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, LogOut, ShieldAlert, Wallet } from "lucide-react";

export default function LogoutConfirmationPage() {
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);

  function confirmLogout() {
    setConfirming(true);
    localStorage.removeItem("splitmate_token");
    localStorage.removeItem("splitmate_user");
    localStorage.removeItem("splitmate_authenticated");
    localStorage.removeItem("splitmate_demo");
    localStorage.removeItem("splitmate_mock_user");
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 dark:bg-zinc-950 dark:text-zinc-100">
      <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/90">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-600/25">
              <Wallet className="h-5 w-5" />
            </div>
            <span className="font-display text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Split<span className="text-indigo-600 dark:text-indigo-400">Mate</span>
            </span>
          </Link>

          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Go Back</span>
          </button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12">
        <div className="rounded-3xl border border-slate-200/90 bg-white p-6 text-center shadow-sm sm:p-7 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400">
            <ShieldAlert className="h-6 w-6" />
          </div>

          <h1 className="mt-4 font-display text-xl font-extrabold text-slate-900 sm:text-2xl dark:text-white">
            Log out of SplitMate?
          </h1>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-500 sm:text-sm dark:text-zinc-400">
            You&apos;ll need to sign back in to access your groups, expenses, and UPI balances.
          </p>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 sm:text-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-800 cursor-pointer"
            >
              Stay Signed In
            </button>
            <button
              type="button"
              disabled={confirming}
              onClick={confirmLogout}
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl bg-rose-600 px-4 text-xs font-bold text-white shadow-md shadow-rose-600/20 transition hover:bg-rose-700 disabled:opacity-60 sm:text-sm cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              <span>{confirming ? "Logging out..." : "Yes, Log Out"}</span>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}