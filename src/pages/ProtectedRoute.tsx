import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Lock,
  LogIn,
  ShieldAlert,
  UserPlus,
  Wallet,
} from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const [isAuthorized, setIsAuthorized] = useState<boolean>(() => {
    const token = localStorage.getItem("splitmate_token");
    const rawUser = localStorage.getItem("splitmate_user");
    const isAuthenticated = localStorage.getItem("splitmate_authenticated") === "true";
    const isDemoSession = localStorage.getItem("splitmate_demo") === "true";

    if (!isAuthenticated && !isDemoSession && !(token && rawUser)) {
      return false;
    }

    if (token && rawUser) {
      try {
        JSON.parse(rawUser);
      } catch {
        localStorage.removeItem("splitmate_token");
        localStorage.removeItem("splitmate_user");
        localStorage.removeItem("splitmate_authenticated");
        return false;
      }
    }

    return true;
  });

  useEffect(() => {
    const token = localStorage.getItem("splitmate_token");
    const rawUser = localStorage.getItem("splitmate_user");
    const isAuthenticated = localStorage.getItem("splitmate_authenticated") === "true";
    const isDemoSession = localStorage.getItem("splitmate_demo") === "true";

    if (!isAuthenticated && !isDemoSession && !(token && rawUser)) {
      setIsAuthorized(false);
      return;
    }

    if (token && rawUser) {
      try {
        JSON.parse(rawUser);
        setIsAuthorized(true);
      } catch {
        localStorage.removeItem("splitmate_token");
        localStorage.removeItem("splitmate_user");
        localStorage.removeItem("splitmate_authenticated");
        setIsAuthorized(false);
      }
    } else {
      setIsAuthorized(true);
    }
  }, [location.pathname]);

  if (isAuthorized) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-zinc-950 dark:text-zinc-100">
      {/* Backdrop & Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-required-title"
        className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/65 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      >
        <div className="w-full max-w-md overflow-hidden rounded-t-3xl border border-slate-200 bg-white p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl sm:p-7 dark:border-zinc-800 dark:bg-zinc-900">
          {/* Top Brand & Lock Badge */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-600/25">
                <Wallet className="h-4 w-4" />
              </div>
              <span className="font-display text-base font-extrabold tracking-tight text-slate-900 dark:text-white">
                Split<span className="text-indigo-600 dark:text-indigo-400">Mate</span>
              </span>
            </div>

            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/50 dark:text-amber-300">
              <Lock className="h-3 w-3" />
              Protected Page
            </span>
          </div>

          {/* Center Icon & Message */}
          <div className="mt-6 text-center">
            <div className="mx-auto flex h-13 w-13 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/70 dark:text-indigo-400">
              <ShieldAlert className="h-6 w-6" />
            </div>

            <h1
              id="auth-required-title"
              className="mt-4 font-display text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl dark:text-white"
            >
              Sign in required
            </h1>

            <p className="mt-2 text-xs leading-relaxed text-slate-500 sm:text-sm dark:text-zinc-400">
              You need to log in to your SplitMate account before accessing{" "}
              <code className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-slate-700 dark:bg-zinc-800 dark:text-zinc-200">
                {location.pathname}
              </code>
              .
            </p>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 space-y-2.5">
            <button
              type="button"
              onClick={() => navigate("/login", { state: { from: location }, replace: true })}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white shadow-md shadow-indigo-600/25 transition hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 cursor-pointer"
            >
              <LogIn className="h-4 w-4" />
              <span>Log In to Continue</span>
            </button>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => navigate("/", { replace: true })}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-800 cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Home</span>
              </button>

              <button
                type="button"
                onClick={() => navigate("/register", { state: { from: location } })}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50/70 px-3 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100/80 dark:border-indigo-800/60 dark:bg-indigo-950/50 dark:text-indigo-300 dark:hover:bg-indigo-950 cursor-pointer"
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span>Sign Up Free</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}