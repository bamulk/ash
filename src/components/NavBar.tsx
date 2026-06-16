"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  DollarSign,
  Megaphone,
  Bell,
  UserCog,
  Home,
} from "lucide-react";
import SignOutButton from "./SignOutButton";

type Item = {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  match: (p: string) => boolean;
};

function buildItems(isAdmin: boolean): Item[] {
  const items: Item[] = [
    { href: "/", label: "Home", icon: LayoutDashboard, match: (p) => p === "/" },
    { href: "/contacts", label: "Contacts", icon: Users, match: (p) => p.startsWith("/contacts") },
    { href: "/transactions", label: "Deals", icon: DollarSign, match: (p) => p.startsWith("/transactions") },
    { href: "/marketing", label: "Marketing", icon: Megaphone, match: (p) => p.startsWith("/marketing") },
    { href: "/reminders", label: "Reminders", icon: Bell, match: (p) => p.startsWith("/reminders") },
  ];
  if (isAdmin) {
    items.push({ href: "/team", label: "Team", icon: UserCog, match: (p) => p.startsWith("/team") });
  }
  return items;
}

export default function NavBar({
  isAdmin,
  displayName,
}: {
  isAdmin: boolean;
  displayName: string;
}) {
  const pathname = usePathname();
  const items = buildItems(isAdmin);

  return (
    <>
      <header
        className="sticky top-0 z-[1100] backdrop-blur-md bg-white/90 dark:bg-slate-900/85 border-b border-slate-200 dark:border-slate-700/70"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="w-8 h-8 rounded-lg bg-brand text-white inline-flex items-center justify-center">
              <Home size={18} />
            </span>
            <span className="tracking-tight hidden md:inline">
              Ashley Stone Homes
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1 text-sm ml-4">
            {items.map((n) => {
              const Icon = n.icon;
              const active = n.match(pathname);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md ${
                    active
                      ? "bg-brand text-white"
                      : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
                  }`}
                >
                  <Icon size={14} />
                  {n.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2 sm:gap-3 text-sm">
            <span className="text-slate-700 dark:text-slate-300 hidden sm:block truncate max-w-[160px]">
              {displayName}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>

      {/* Mobile floating liquid-glass tab bar.
          The wrapper is full-width so we can horizontally center the pill;
          pointer-events-none lets taps near the edges fall through to the
          page underneath. The pill itself re-enables pointer events.
          Note: no transform on the wrapper — iOS Safari detaches
          position:fixed from the viewport when a transform is present. */}
      <nav
        aria-label="Primary"
        className="md:hidden fixed inset-x-0 z-[1100] flex justify-center px-3 pointer-events-none"
        style={{ bottom: "max(0.5rem, env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="pointer-events-auto relative isolate">
          {/* Glass surface: translucent base + heavy blur + saturation. */}
          <div
            aria-hidden
            className="absolute inset-0 rounded-2xl bg-white/55 dark:bg-slate-900/55 backdrop-blur-2xl backdrop-saturate-150 border border-white/50 dark:border-white/10 shadow-[0_10px_40px_-8px_rgba(15,23,42,0.28)] dark:shadow-[0_10px_40px_-8px_rgba(0,0,0,0.65)]"
          />
          {/* Inner refraction edge for the liquid-glass look. */}
          <div
            aria-hidden
            className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/40 dark:ring-white/10"
          />
          <ul className="relative flex items-center gap-0.5 px-1.5 py-1.5">
            {items.map((n) => {
              const Icon = n.icon;
              const active = n.match(pathname);
              return (
                <li key={n.href}>
                  <Link
                    href={n.href}
                    aria-label={n.label}
                    aria-current={active ? "page" : undefined}
                    className={`flex flex-col items-center justify-center min-w-[3.25rem] px-2 py-1.5 rounded-xl transition-colors duration-200 ${
                      active
                        ? "bg-brand text-white shadow-md shadow-brand/30"
                        : "text-slate-700 dark:text-slate-200 active:bg-slate-200/40 dark:active:bg-white/10"
                    }`}
                  >
                    <Icon size={18} />
                    <span className={`text-[9.5px] font-medium mt-0.5 leading-none ${active ? "" : "opacity-75"}`}>
                      {n.label}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>
    </>
  );
}
