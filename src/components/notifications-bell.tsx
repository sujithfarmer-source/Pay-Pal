"use client";

import { Bell, RotateCcw, CheckCircle2, XCircle, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { NotificationView } from "./types";

const KIND_ICON: Record<string, typeof Bell> = {
  refunded: RotateCcw,
  completed: CheckCircle2,
  failed: XCircle,
  initiated: Send,
};

function ago(iso: string) {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  return new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export function NotificationsBell({
  items,
  unread,
  onOpenChange,
  onSelect,
}: {
  items: NotificationView[];
  unread: number;
  onOpenChange: (open: boolean) => void;
  onSelect: (paymentId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        onOpenChange(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open, onOpenChange]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        onClick={() => {
          setOpen(!open);
          onOpenChange(!open);
        }}
        className="relative grid size-10 place-items-center rounded-full border border-line bg-white text-ink-soft transition hover:border-violet/40 hover:text-violet focus-visible:ring-2 focus-visible:ring-violet focus-visible:outline-none"
      >
        <Bell className="size-4.5" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 grid min-w-5 place-items-center rounded-full bg-violet px-1 text-[10px] font-bold text-white ring-2 ring-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="animate-pop absolute right-0 z-30 mt-2 w-[min(92vw,380px)] overflow-hidden rounded-2xl border border-line bg-white shadow-[0_24px_60px_-20px_rgba(20,18,31,0.3)]">
          <div className="border-b border-line px-4 py-3 text-sm font-semibold">Notifications</div>
          <ul className="max-h-96 overflow-y-auto">
            {items.length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-ink-faint">No notifications yet.</li>
            )}
            {items.map((n) => {
              const Icon = KIND_ICON[n.kind] ?? Bell;
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => {
                      if (n.paymentId) onSelect(n.paymentId);
                      setOpen(false);
                      onOpenChange(false);
                    }}
                    className={`flex w-full gap-3 px-4 py-3 text-left transition hover:bg-mist ${n.read ? "" : "bg-violet-wash/50"}`}
                  >
                    <Icon
                      className={`mt-0.5 size-4 shrink-0 ${n.kind === "refunded" ? "text-violet" : "text-ink-faint"}`}
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-ink">{n.title}</span>
                      <span className="block text-sm text-ink-soft">{n.body}</span>
                      <span className="mt-0.5 block text-xs text-ink-faint">{ago(n.createdAt)}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
