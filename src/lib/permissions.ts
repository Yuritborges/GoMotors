import type { UserRole } from "@/generated/prisma/client";

export const ROLE_LABELS: Record<UserRole, string> = {
  PROPRIETARIO: "Administrador",
  ATENDENTE: "Atendente",
};

export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  PROPRIETARIO: [
    "Acesso total ao sistema",
    "Editar servi?os, produtos e pre?os",
    "Caixa, despesas e relat?rios",
    "Gerenciar usu?rios (criar, editar e-mail/senha, excluir)",
    "Controle de estoque",
  ],
  ATENDENTE: [
    "Painel operacional e ordens de servi?o",
    "Cadastrar clientes e ve?culos",
    "Consultar servi?os (sem editar pre?os)",
    "Imprimir comprovantes",
  ],
};

type NavItem = {
  href: string;
  label: string;
  icon: string;
  roles: UserRole[];
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: "LayoutDashboard", roles: ["PROPRIETARIO", "ATENDENTE"] },
  { href: "/painel", label: "Painel operacional", icon: "Kanban", roles: ["PROPRIETARIO", "ATENDENTE"] },
  { href: "/ordens", label: "Ordens de servi?o", icon: "ClipboardList", roles: ["PROPRIETARIO", "ATENDENTE"] },
  { href: "/clientes", label: "Clientes", icon: "Users", roles: ["PROPRIETARIO", "ATENDENTE"] },
  { href: "/servicos", label: "Servi?os", icon: "Wrench", roles: ["PROPRIETARIO", "ATENDENTE"] },
  { href: "/estoque", label: "Estoque", icon: "Package", roles: ["PROPRIETARIO"] },
  { href: "/caixa", label: "Caixa", icon: "Wallet", roles: ["PROPRIETARIO"] },
  { href: "/funcionarios", label: "Funcion?rios", icon: "HardHat", roles: ["PROPRIETARIO"] },
  { href: "/financeiro", label: "Financeiro", icon: "BarChart3", roles: ["PROPRIETARIO"] },
  { href: "/despesas", label: "Despesas", icon: "Receipt", roles: ["PROPRIETARIO"] },
  { href: "/relatorios", label: "Relat?rios", icon: "FileSpreadsheet", roles: ["PROPRIETARIO"] },
  { href: "/usuarios", label: "Usu?rios", icon: "UserCog", roles: ["PROPRIETARIO"] },
];

export function getNavItemsForRole(role: UserRole): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}

/** Atalhos fixos na barra inferior do mobile */
export const MOBILE_BOTTOM_NAV_HREFS = ["/painel", "/ordens", "/clientes"] as const;

export function getMobileMoreNavItems(role: UserRole): NavItem[] {
  const bottom = new Set<string>(MOBILE_BOTTOM_NAV_HREFS);
  return getNavItemsForRole(role).filter((item) => !bottom.has(item.href));
}

export function isNavItemActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/clientes") {
    return pathname === "/clientes" || pathname.startsWith("/clientes/");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function getPageTitleFromPath(pathname: string, role: UserRole): string {
  if (pathname === "/ordens/nova") return "Nova ordem";
  if (pathname.includes("/comprovante")) return "Comprovante";
  if (pathname.startsWith("/clientes/lojas/")) return "Loja parceira";
  if (pathname === "/clientes/lojas") return "Lojas parceiras";
  if (pathname.startsWith("/clientes/") && pathname !== "/clientes") {
    return "Hist?rico do cliente";
  }

  const items = getNavItemsForRole(role);
  const match = items.find((item) => isNavItemActive(item.href, pathname));
  return match?.label ?? "GO MOTORS";
}

export function isOwner(role: UserRole): boolean {
  return role === "PROPRIETARIO";
}
