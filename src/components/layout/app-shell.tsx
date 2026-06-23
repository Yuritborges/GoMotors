"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ClipboardList,
  FileSpreadsheet,
  Kanban,
  LayoutDashboard,
  LogOut,
  Package,
  Receipt,
  UserCog,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getNavItemsForRole, getPageTitleFromPath, isNavItemActive, ROLE_LABELS } from "@/lib/permissions";
import { Logo } from "@/components/layout/logo";
import { MobileBottomNav, MobileMoreSheet } from "@/components/layout/mobile-nav";
import type { SessionUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";

const iconMap = {
  LayoutDashboard,
  Kanban,
  ClipboardList,
  Users,
  Wrench,
  Package,
  Wallet,
  Receipt,
  FileSpreadsheet,
  UserCog,
};

type SidebarNavProps = {
  user: SessionUser;
};

function SidebarNav({ user }: SidebarNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const navItems = getNavItemsForRole(user.role);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    window.location.href = "/login";
  }

  return (
    <>
      <div className="border-b border-zinc-800">
        <Logo size="md" className="w-full" />
        <p className="-mt-1 pb-4 text-center text-xs text-zinc-500">
          Gestão de lavagem
        </p>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {navItems.map((item) => {
          const Icon = iconMap[item.icon as keyof typeof iconMap];
          const active = isNavItemActive(item.href, pathname);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-3 text-sm transition-colors",
                active
                  ? "bg-zinc-800 text-white ring-1 ring-zinc-600"
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-zinc-800 p-4">
        <div className="mb-3">
          <p className="truncate text-sm font-medium text-white">{user.name}</p>
          <p className="text-xs text-zinc-500">{ROLE_LABELS[user.role]}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-900 hover:text-white"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          Sair
        </Button>
      </div>
    </>
  );
}

export function AppShell({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const pathname = usePathname();
  const pageTitle = getPageTitleFromPath(pathname, user.role);

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950 text-white lg:flex">
        <SidebarNav user={user} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] shadow-sm lg:hidden">
          <div className="flex items-center gap-3">
            <Logo
              size="xs"
              href="/"
              className="shrink-0"
              imageClassName="max-h-10 w-auto"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-semibold text-slate-900">
                {pageTitle}
              </p>
              <p className="truncate text-xs text-slate-500">{user.name}</p>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-x-hidden pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-0">
          <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
            {children}
          </div>
        </main>

        <MobileBottomNav
          user={user}
          moreOpen={moreOpen}
          onMoreOpen={() => setMoreOpen(true)}
        />
        <MobileMoreSheet
          user={user}
          open={moreOpen}
          onClose={() => setMoreOpen(false)}
        />
      </div>
    </div>
  );
}

export function Sidebar({ user }: { user: SessionUser }) {
  return (
    <aside className="hidden lg:flex lg:w-64 lg:shrink-0 lg:flex-col border-r border-zinc-800 bg-zinc-950 text-white">
      <SidebarNav user={user} />
    </aside>
  );
}
