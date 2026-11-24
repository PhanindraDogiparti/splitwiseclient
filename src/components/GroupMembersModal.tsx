import { useEffect, useState, type FormEvent } from "react";
import { AlertCircle, Loader2, Trash2, UserPlus, Users, X } from "lucide-react";

const API_BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");

interface GroupMember {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "MEMBER";
  netBalance: number;
}

interface GroupMembersModalProps {
  open: boolean;
  groupId: string;
  groupName: string;
  members: GroupMember[];
  onClose: () => void;
  onMembersChanged: () => Promise<void>;
}

function getAuthHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const token = localStorage.getItem("splitmate_token");
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export default function GroupMembersModal({
  open,
  groupId,
  groupName,
  members: initialMembers,
  onClose,
  onMembersChanged,
}: GroupMembersModalProps) {
  const [members, setMembers] = useState(initialMembers);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setMembers(initialMembers);
      setError(null);
      setSuccess(null);
    }
  }, [initialMembers, open]);

  if (!open) return null;

  async function handleAddMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || adding) return;

    setAdding(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/groups/${encodeURIComponent(groupId)}/members`,
        {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({ email: normalizedEmail }),
        },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.message || "Unable to add this member.");
      }

      setEmail("");
      await onMembersChanged();
      setSuccess(`${payload.data?.name || normalizedEmail} was added to the group.`);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to add this member.",
      );
    } finally {
      setAdding(false);
    }
  }

  async function handleRemoveMember(member: GroupMember) {
    if (removingMemberId) return;

    setRemovingMemberId(member.id);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(member.id)}`,
        {
          method: "DELETE",
          headers: getAuthHeaders(),
        },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.message || "Unable to remove this member.");
      }

      await onMembersChanged();
      setSuccess(`${member.name} was removed from the group.`);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to remove this member.",
      );
    } finally {
      setRemovingMemberId(null);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-xs sm:items-center sm:p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="group-members-modal-title"
        className="max-h-[92dvh] w-full max-w-xl overflow-hidden rounded-t-3xl border border-slate-200 bg-white shadow-2xl sm:rounded-3xl dark:border-zinc-800 dark:bg-zinc-900"
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-100 p-4 sm:p-5 dark:border-zinc-800">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
              <Users className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2
                id="group-members-modal-title"
                className="truncate font-display text-base font-bold text-slate-900 dark:text-white"
              >
                Manage members
              </h2>
              <p className="truncate text-xs text-slate-500 dark:text-zinc-400">
                {groupName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close member management"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="max-h-[calc(92dvh-4.5rem)] space-y-5 overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-5">
          <form onSubmit={handleAddMember} className="space-y-2">
            <label
              htmlFor="group-member-email"
              className="block text-xs font-semibold text-slate-700 dark:text-zinc-300"
            >
              Add a registered user by email
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id="group-member-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setError(null);
                }}
                placeholder="friend@example.com"
                className="h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-950"
              />
              <button
                type="submit"
                disabled={adding || !email.trim()}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {adding ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UserPlus className="h-4 w-4" />
                )}
                Add member
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Only users who have registered with SplitMate can be added.
            </p>
          </form>

          {(error || success) && (
            <div
              role={error ? "alert" : "status"}
              className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${
                error
                  ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300"
              }`}
            >
              {error && <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
              <p>{error || success}</p>
            </div>
          )}

          <div>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
              Current members ({members.length})
            </h3>
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100 dark:divide-zinc-800 dark:border-zinc-800">
              {members.map((member) => (
                <li
                  key={member.id}
                  className="flex items-center gap-3 p-3"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                    {member.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                      {member.name}
                      {member.role === "ADMIN" && (
                        <span className="ml-2 text-[10px] font-bold uppercase text-indigo-600 dark:text-indigo-400">
                          Creator
                        </span>
                      )}
                    </p>
                    <p className="break-all text-xs text-slate-500 dark:text-zinc-400">
                      {member.email}
                    </p>
                  </div>
                  {member.role !== "ADMIN" && (
                    <button
                      type="button"
                      onClick={() => void handleRemoveMember(member)}
                      disabled={Boolean(removingMemberId)}
                      aria-label={`Remove ${member.name}`}
                      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-rose-200 px-2.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900/60 dark:text-rose-300 dark:hover:bg-rose-950/40"
                    >
                      {removingMemberId === member.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                      <span className="hidden sm:inline">Remove</span>
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
