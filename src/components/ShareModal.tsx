import React, { useCallback, useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Check, Copy, Link2, QrCode, Share2, X } from "lucide-react";

interface ShareModalProps {
  groupId: string;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  token?: string;
  onLeaveGroup?: () => void;
}

function ShareModal({
  groupId,
  isOpen,
  setIsOpen,
  token,
}: ShareModalProps) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [showQr, setShowQr] = useState(false);

  const shareUrl = token
    ? `${window.location.origin}/join?token=${encodeURIComponent(token)}`
    : `${window.location.origin}/join/${encodeURIComponent(groupId)}`;

  const handleCopyLink = useCallback(() => {
    navigator.clipboard?.writeText(shareUrl);
    setCopiedLink(true);
    window.setTimeout(() => setCopiedLink(false), 2000);
  }, [shareUrl]);

  const handleClose = useCallback(() => {
    setShowQr(false);
    setIsOpen(false);
  }, [setIsOpen]);

  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="presentation"
      onMouseDown={handleClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
        className="max-h-[92dvh] w-full max-w-md overflow-hidden rounded-t-3xl border border-slate-200 bg-white shadow-2xl sm:rounded-3xl dark:border-zinc-800 dark:bg-zinc-900"
      >
        {/* Header */}
        <header className="flex items-center justify-between gap-3 border-b border-slate-100 p-4 sm:p-5 dark:border-zinc-800">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/70 dark:text-indigo-400">
              <Share2 className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2
                id="share-modal-title"
                className="truncate font-display text-base font-bold text-slate-900 sm:text-lg dark:text-white"
              >
                Share Group
              </h2>
              <p className="truncate text-xs text-slate-500 dark:text-zinc-400">
                Invite friends to join this group
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            aria-label="Close share modal"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* Body */}
        <div className="max-h-[calc(92dvh-4.5rem)] space-y-4 overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6">
          <p className="text-xs leading-relaxed text-slate-500 sm:text-sm dark:text-zinc-400">
            Share this invite link so friends can join{" "}
            <strong className="font-semibold text-slate-700 dark:text-zinc-200">
              {groupId}
            </strong>{" "}
            <span className="font-medium text-indigo-600 dark:text-indigo-400">
              (valid for 24 hours)
            </span>
            .
          </p>

          {token && (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-2.5 text-xs dark:border-zinc-800 dark:bg-zinc-950">
              <span className="font-semibold text-slate-500 dark:text-zinc-400">
                Invite Token
              </span>
              <span className="truncate font-mono text-xs font-bold text-slate-800 dark:text-zinc-200">
                {token}
              </span>
            </div>
          )}

          {/* Shareable Link Box */}
          <div>
            <label
              htmlFor="share-group-link"
              className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400"
            >
              <Link2 className="h-3.5 w-3.5 text-indigo-500" />
              <span>Shareable Link</span>
            </label>
            <textarea
              id="share-group-link"
              readOnly
              value={shareUrl}
              rows={2}
              aria-label="Share link"
              className="mt-1.5 w-full resize-none rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-xs font-medium text-slate-800 outline-none focus:border-indigo-500 sm:text-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200"
            />
          </div>

          {/* QR Code Toggle */}
          <button
            type="button"
            onClick={() => setShowQr((prev) => !prev)}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50/60 px-4 text-xs font-bold text-indigo-700 transition hover:bg-indigo-100/70 sm:text-sm dark:border-indigo-800/60 dark:bg-indigo-950/50 dark:text-indigo-300 cursor-pointer"
          >
            <QrCode className="h-4 w-4" />
            <span>{showQr ? "Hide QR Code" : "Show QR Code"}</span>
          </button>

          {showQr && (
            <div className="rounded-2xl border border-slate-200/90 bg-slate-50/60 p-4 text-center dark:border-zinc-800 dark:bg-zinc-950/60">
              <p className="mb-3 text-xs font-medium text-slate-500 dark:text-zinc-400">
                Scan this QR code to join the group:
              </p>
              <div className="mx-auto inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs dark:border-zinc-800">
                <QRCodeSVG
                  value={shareUrl}
                  size={184}
                  fgColor="#0f172a"
                  bgColor="#ffffff"
                />
              </div>
            </div>
          )}

          {/* Footer Buttons */}
          <div className="grid grid-cols-2 gap-2.5 border-t border-slate-100 pt-4 dark:border-zinc-800">
            <button
              type="button"
              onClick={handleClose}
              className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 sm:text-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleCopyLink}
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 text-xs font-bold text-white shadow-md shadow-indigo-600/20 transition hover:bg-indigo-700 sm:text-sm cursor-pointer"
            >
              {copiedLink ? (
                <>
                  <Check className="h-4 w-4" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  <span>Copy Link</span>
                </>
              )}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default ShareModal;