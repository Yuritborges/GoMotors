"use client";

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
import { getNavItemsForRole, ROLE_LABELS } from "@/lib/permissions";
import { Logo } from "@/components/layout/logo";
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

export function Sidebar({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  const router = useRouter();
  const navItems = getNavItemsForRole(user.role);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950 text-white">
      <div className="border-b border-zinc-800">
        <Logo size="md" className="w-full" />
        <p className="-mt-1 pb-4 text-center text-xs text-zinc-500">
          Gestão de lavagem
        </p>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => {
          const Icon = iconMap[item.icon as keyof typeof iconMap];
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                active
                  ? "bg-zinc-800 text-white ring-1 ring-zinc-600"
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-zinc-800 p-4">
        <div className="mb-3">
          <p className="text-sm font-medium text-white">{user.name}</p>
          <p className="text-xs text-zinc-500">
            {ROLE_LABELS[user.role]}
          </p>
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
    </aside>
  );
}
