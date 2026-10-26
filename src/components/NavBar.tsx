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

      {/* Mobile tab bar — pinned to the bottom edge, solid dark beam to
          echo the top header, maroon active state like the site's
          door-band. Edge-to-edge: content under it is cleared by the
          layout's bottom padding. Note: no transform on this element —
          iOS Safari detaches `position: fixed` from the viewport when
          a transform is present. */}
      <nav
        aria-label="Primary"
        className="md:hidden fixed bottom-0 inset-x-0 z-[1100] bg-[#1d1d1b] border-t border-black/40"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <ul className="flex items-stretch justify-around px-1 pt-2 pb-1.5">
          {items.map((n) => {
            const Icon = n.icon;
            const active = n.match(pathname);
            return (
              <li key={n.href} className="flex-1">
                <Link
                  href={n.href}
                  aria-label={n.label}
                  aria-current={active ? "page" : undefined}
                  className={`flex flex-col items-center justify-center gap-1 py-2 transition-colors duration-150 ${
                    active
                      ? "bg-brand text-brand-ink"
                      : "text-[#b9b8b0] active:text-[#fbfbf9]"
                  }`}
                >
                  <Icon size={20} />
                  <span className={`text-[10px] font-medium leading-none ${active ? "" : "opacity-80"}`}>
                    {n.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
