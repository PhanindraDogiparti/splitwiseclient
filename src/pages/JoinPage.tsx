import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AlertCircle, CheckCircle2, Loader2, Users } from "lucide-react";
import AppLayout from "../components/AppLayout";

const API_BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");

function getAuthHeaders(): HeadersInit {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = localStorage.getItem("splitmate_token");
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export default function JoinPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"loading" | "success" | "error" | "unauthenticated">("loading");
  const [message, setMessage] = useState<string>("");
  const [groupName, setGroupName] = useState<string>("");
  const [errorDetails, setErrorDetails] = useState<string>("");

  useEffect(() => {
    const processJoin = async () => {
      if (!token) {
        setStatus("error");
        setMessage("Invalid invitation link");
        setErrorDetails("No token provided in the URL.");
        return;
      }

      try {
        // First check if user is authenticated
        const tokenStored = localStorage.getItem("splitmate_token");
        const userRaw = localStorage.getItem("splitmate_user");

        if (!tokenStored || !userRaw) {
          setStatus("unauthenticated");
          return;
        }

        const user = JSON.parse(userRaw);
        const email = user.email;

        const response = await fetch(`${API_BASE_URL}/api/v1/groups/join`, {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({ token }),
        });

        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(payload.message || "Failed to join group.");
        }

        const member = payload.data;
        setStatus("success");
        setGroupName(member.groupId ? "the group" : "group");
        setMessage(`Successfully joined! You've been added as ${member.name}.`);

        // Redirect to group page after a short delay
        setTimeout(() => {
          navigate(`/groups/${member.groupId}`, { replace: true });
        }, 2000);
      } catch (err) {
        setStatus("error");
        setMessage("Failed to join group");
        setErrorDetails(err instanceof Error ? err.message : "Unknown error occurred.");
      }
    };

    processJoin();
  }, [token, navigate]);

  if (status === "loading") {
    return (
      <AppLayout title="Joining Group" subtitle="Please wait...">
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="text-center">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-indigo-600" />
            <p className="mt-4 text-slate-600 dark:text-zinc-400">Processing invitation...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (status === "unauthenticated") {
    return (
      <AppLayout title="Join Group" subtitle="Sign in to accept the invitation">
        <div className="max-w-md mx-auto space-y-6">
          <div className="rounded-2xl border border-slate-200/90 bg-white p-8 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-center">
              <Users className="h-12 w-12 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h2 className="mt-4 text-center font-display text-xl font-bold text-slate-900 dark:text-white">
              Accept Group Invitation
            </h2>
            <p className="mt-2 text-center text-sm text-slate-500 dark:text-zinc-400">
              You need to sign in to accept this group invitation.
            </p>

            <div className="mt-6 space-y-3">
              <button
                onClick={() => navigate("/login", { state: { from: `/join?token=${token}` }, replace: true })}
                className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700"
              >
                Sign In to Join
              </button>
              <button
                onClick={() => navigate("/register", { state: { from: `/join?token=${token}` }, replace: true })}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
              >
                Create Account
              </button>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  const isSuccess = status === "success";

  return (
    <AppLayout title={isSuccess ? "Joined Successfully" : "Unable to Join"}>
      <div className="max-w-md mx-auto space-y-6">
        <div className="rounded-2xl border p-8 shadow-2xs text-center">
          {isSuccess ? (
            <>
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500 dark:text-emerald-400" />
              <h2 className="mt-4 font-display text-xl font-bold text-emerald-700 dark:text-emerald-300">
                Welcome to the Group!
              </h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">
                {message}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-zinc-500">
                Redirecting to group...
              </p>
            </>
          ) : (
            <>
              <AlertCircle className="mx-auto h-12 w-12 text-rose-500 dark:text-rose-400" />
              <h2 className="mt-4 font-display text-xl font-bold text-rose-700 dark:text-rose-300">
                {message}
              </h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">
                {errorDetails}
              </p>
              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => navigate("/group", { replace: true })}
                  className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
                >
                  Back to Groups
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="flex-1 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
                >
                  Try Again
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}