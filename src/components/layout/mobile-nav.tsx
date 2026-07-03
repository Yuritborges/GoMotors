"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  ClipboardList,
  FileSpreadsheet,
  HardHat,
  History,
  Kanban,
  LayoutDashboard,
  LogOut,
  MoreHorizontal,
  Package,
  Plus,
  Receipt,
  UserCog,
  Users,
  Wallet,
  Wrench,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getMobileMoreNavItems,
  getNavItemsForRole,
  isNavItemActive,
  MOBILE_BOTTOM_NAV_HREFS,
  ROLE_LABELS,
} from "@/lib/permissions";
import { Logo } from "@/components/layout/logo";
import type { SessionUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";

const iconMap = {
  LayoutDashboard,
  Kanban,
  ClipboardList,
  Plus,
  Users,
  Wrench,
  Package,
  Wallet,
  HardHat,
  History,
  BarChart3,
  Receipt,
  FileSpreadsheet,
  UserCog,
  MoreHorizontal,
};

const BOTTOM_LABELS: Record<string, string> = {
  "/painel": "Painel",
  "/ordens/nova": "Nova OS",
  "/clientes": "Clientes",
};

type MobileBottomNavProps = {
  user: SessionUser;
  moreOpen: boolean;
  onMoreOpen: () => void;
};

export function MobileBottomNav({ user, moreOpen, onMoreOpen }: MobileBottomNavProps) {
  const pathname = usePathname();
  const navItems = getNavItemsForRole(user.role);
  const bottomItems = navItems.filter((item) =>
    MOBILE_BOTTOM_NAV_HREFS.includes(item.href as (typeof MOBILE_BOTTOM_NAV_HREFS)[number])
  );
  const moreItems = getMobileMoreNavItems(user.role);
  const moreActive =
    moreOpen || moreItems.some((item) => isNavItemActive(item.href, pathname));

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_20px_rgba(15,23,42,0.08)] lg:hidden"
      aria-label="Navegação principal"
    >
      <div className="mx-auto flex max-w-lg items-end justify-around px-1">
        {bottomItems.map((item) => {
          const isNova = item.href === "/ordens/nova";
          const Icon = isNova
            ? Plus
            : iconMap[item.icon as keyof typeof iconMap];
          const active = isNavItemActive(item.href, pathname);

          if (isNova) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative -mt-4 flex min-w-0 flex-1 flex-col items-center gap-1 touch-manipulation",
                  active ? "text-sky-700" : "text-slate-600"
                )}
              >
                <span
                  className={cn(
                    "flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-transform active:scale-95",
                    active
                      ? "bg-sky-600 text-white ring-4 ring-sky-100"
                      : "bg-sky-500 text-white"
                  )}
                >
                  <Icon className="h-7 w-7 stroke-[2.5]" />
                </span>
                <span className="truncate text-[11px] font-semibold">
                  {BOTTOM_LABELS[item.href] ?? item.label}
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center gap-0.5 px-2 py-2.5 text-[11px] font-medium transition-colors touch-manipulation",
                active ? "text-sky-600" : "text-slate-500"
              )}
            >
              <Icon className={cn("h-5 w-5 shrink-0", active && "stroke-[2.5]")} />
              <span className="truncate">
                {BOTTOM_LABELS[item.href] ?? item.label}
              </span>
            </Link>
          );
        })}

        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onMoreOpen();
          }}
          className={cn(
            "flex min-w-0 flex-1 flex-col items-center gap-0.5 px-2 py-2.5 text-[11px] font-medium transition-colors touch-manipulation",
            moreActive ? "text-sky-600" : "text-slate-500"
          )}
          aria-expanded={moreOpen}
          aria-label="Mais opções"
        >
          <MoreHorizontal
            className={cn("h-5 w-5 shrink-0", moreActive && "stroke-[2.5]")}
          />
          <span>Mais</span>
        </button>
      </div>
    </nav>
  );
}

type MobileMoreSheetProps = {
  user: SessionUser;
  open: boolean;
  onClose: () => void;
};

export function MobileMoreSheet({ user, open, onClose }: MobileMoreSheetProps) {
  const pathname = usePathname();
  const router = useRouter();
  const moreItems = getMobileMoreNavItems(user.role);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    window.location.href = "/login";
  }

  if (!mounted || !open) return null;

  return createPortal(
    <>
      <button
        type="button"
        aria-label="Fechar menu"
        className="fixed inset-0 z-[200] bg-black/50 lg:hidden"
        onClick={onClose}
      />

      <div
        className="fixed inset-x-0 bottom-0 z-[210] flex max-h-[min(85dvh,640px)] min-h-[280px] flex-col rounded-t-2xl bg-white shadow-2xl lg:hidden"
        role="dialog"
        aria-modal="true"
        aria-label="Mais opções"
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <Logo
            size="xs"
            href="/"
            className="shrink-0"
            imageClassName="max-h-9"
          />
          <button
            type="button"
            aria-label="Fechar"
            className="shrink-0 rounded-lg p-2 text-slate-500 hover:bg-slate-100 touch-manipulation"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="border-b border-slate-100 px-4 py-2">
          <p className="font-semibold text-slate-900">{user.name}</p>
          <p className="text-xs text-slate-500">{ROLE_LABELS[user.role]}</p>
        </div>

        <nav className="flex-1 overflow-y-auto p-3">
          <p className="mb-2 px-2 text-xs font-medium uppercase tracking-wide text-slate-400">
            Menu
          </p>
          <ul className="space-y-1">
            {moreItems.map((item) => {
              const Icon = iconMap[item.icon as keyof typeof iconMap];
              const active = isNavItemActive(item.href, pathname);

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onClose}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-4 py-3.5 text-sm font-medium transition-colors touch-manipulation",
                      active
                        ? "bg-sky-50 text-sky-700"
                        : "text-slate-700 hover:bg-slate-50 active:bg-slate-100"
                    )}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t border-slate-100 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button variant="outline" className="w-full" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            Sair da conta
          </Button>
        </div>
      </div>
    </>,
    document.body
  );
}
