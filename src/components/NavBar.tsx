"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  DollarSign,
  Megaphone,
  Bell,
  Map,
  UserCog,
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
    { href: "/routes", label: "Routes", icon: Map, match: (p) => p.startsWith("/routes") },
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
      {/* Dark "beam" header, same construction as ashleystonehomes.com. */}
      <header
        className="sticky top-0 z-[1100] bg-[#1d1d1b] text-[#fbfbf9] border-b border-black/40"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="Ashley Stone Homes"
              width={36}
              height={36}
              priority
              className="w-9 h-9 object-contain bg-[#fbfbf9] p-[3px]"
            />
            <span className="hidden md:flex flex-col leading-tight">
              <span className="font-display text-[19px] font-medium text-[#fbfbf9]">
                Ashley Stone
              </span>
              <span className="text-[10px] font-semibold tracking-[0.16em] uppercase text-[#b9b8b0] mt-[1px]">
                Real Estate Group
              </span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1 text-sm ml-6">
            {items.map((n) => {
              const Icon = n.icon;
              const active = n.match(pathname);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 ${
                    active
                      ? "text-[#fbfbf9] border-b border-[#fbfbf9]"
                      : "text-[#b9b8b0] hover:text-[#fbfbf9]"
                  }`}
                >
                  <Icon size={14} />
                  {n.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="text-[#b9b8b0] hidden sm:block truncate max-w-[160px]">
              {displayName}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>

      {/* Mobile floating tab bar — dark surface to echo the beam, with a
          maroon active state like the site's door-band accent. The wrapper
          is full-width so we can horizontally center the pill;
          pointer-events-none lets taps near the edges fall through.
          Note: no transform on the wrapper — iOS Safari detaches
          position:fixed from the viewport when a transform is present. */}
      <nav
        aria-label="Primary"
        className="md:hidden fixed inset-x-0 z-[1100] flex justify-center px-3 pointer-events-none"
        style={{ bottom: "max(0.5rem, env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="pointer-events-auto relative isolate">
          <div
            aria-hidden
            className="absolute inset-0 bg-[#1d1d1b]/92 backdrop-blur-xl border border-black/40 shadow-[0_10px_40px_-8px_rgba(0,0,0,0.5)]"
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
                    className={`flex flex-col items-center justify-center min-w-[3.25rem] px-2 py-1.5 transition-colors duration-150 ${
                      active
                        ? "bg-brand text-brand-ink"
                        : "text-[#b9b8b0] active:text-[#fbfbf9]"
                    }`}
                  >
                    <Icon size={18} />
                    <span className={`text-[9.5px] font-medium mt-0.5 leading-none ${active ? "" : "opacity-80"}`}>
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
