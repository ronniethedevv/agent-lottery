"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWebSocket } from "@/hooks/useWebSocket";
import { Logo } from "@/components/Logo";

const NAV_ITEMS = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></svg>
    ),
  },
  {
    href: "/lotteries",
    label: "Lotteries",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 3l7.5 4.3v8.6L12 20.2 4.5 15.9V7.3L12 3z" strokeLinejoin="round" /><circle cx="12" cy="11.5" r="2.5" /></svg>
    ),
  },
  {
    href: "/agents",
    label: "Agents",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="4" y="8" width="16" height="12" rx="3" /><path d="M12 8V4M8 4h8" strokeLinecap="round" /><circle cx="9" cy="14" r="1.2" fill="currentColor" /><circle cx="15" cy="14" r="1.2" fill="currentColor" /></svg>
    ),
  },
  {
    href: "/draws",
    label: "Draws",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="4" y="4" width="16" height="16" rx="4" /><circle cx="9" cy="9" r="1.3" fill="currentColor" /><circle cx="15" cy="15" r="1.3" fill="currentColor" /><circle cx="15" cy="9" r="1.3" fill="currentColor" /><circle cx="9" cy="15" r="1.3" fill="currentColor" /></svg>
    ),
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { connected } = useWebSocket();

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-surface-3/60 bg-surface-1/95">
      <Link
        href="/"
        className="flex items-center gap-2.5 border-b border-surface-3/60 px-6 py-5"
      >
        <Logo size={32} />
        <div>
          <h1 className="font-display text-base font-bold tracking-tight text-text-primary">
            Agent Lottery
          </h1>
          <p className="text-[11px] text-text-muted">BNB Chain · ZK</p>
        </div>
      </Link>

      <nav className="flex-1 space-y-1 p-4">
        {NAV_ITEMS.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group relative flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all ${
                active
                  ? "bg-accent/12 text-accent-bright"
                  : "text-text-secondary hover:bg-surface-2/70 hover:text-text-primary"
              }`}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-accent-bright" />
              )}
              <span className="h-5 w-5">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-surface-3/60 p-4">
        <div className="flex items-center gap-2.5 rounded-lg bg-surface-2/50 px-3 py-2.5">
          <span className="relative flex h-2.5 w-2.5">
            {connected && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
            )}
            <span
              className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                connected ? "bg-success" : "bg-danger"
              }`}
            />
          </span>
          <span className="text-xs font-medium text-text-secondary">
            {connected ? "Live · connected" : "Disconnected"}
          </span>
        </div>
      </div>
    </aside>
  );
}
