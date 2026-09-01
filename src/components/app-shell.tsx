import { Link, useRouterState } from "@tanstack/react-router";
import {
  Bike,
  CreditCard,
  Home,
  LayoutDashboard,
  LogOut,
  Receipt,
  ScrollText,
  Users,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { signOut } from "@/lib/auth/client";
import { cn } from "@/lib/cn";
import { BackupButton } from "@/components/backup-button";
import { WalletMark } from "@/components/mark";
import { Button } from "@/components/ui/button";
import { clearWalletUnlock } from "@/lib/wallet-session";

type Profile = {
  displayName: string;
  username: string;
  role: "manager" | "accountant";
  walletName: string;
  isManager: boolean;
};

const SHARED_NAV = [
  { to: "/", label: "الرئيسية", icon: LayoutDashboard },
  { to: "/section/cards", label: "ديون البطاقات", icon: CreditCard },
  { to: "/section/home", label: "اشتراكات المنازل", icon: Home },
  { to: "/section/ops", label: "مصاريف ورواتب", icon: Receipt },
] as const;

const MANAGER_NAV = [
  { to: "/section/agents", label: "المناديب", icon: Bike },
  { to: "/section/ledger", label: "الكشف", icon: ScrollText },
] as const;

export function AppShell({ profile, children }: { profile: Profile; children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [signingOut, setSigningOut] = useState(false);
  const roleLabel = profile.isManager ? "مدير الشبكة" : "محاسب";

  return (
    <div className="min-h-dvh bg-bg text-ink">
      <header className="sticky top-0 z-30 border-b border-border bg-surface/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <WalletMark />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">محفظة شبكة الجنرال</p>
            <p className="truncate text-xs text-muted">
              {profile.displayName} · {roleLabel}
            </p>
          </div>
          {profile.isManager && (
            <div className="hidden items-center gap-1 max-md:flex">
              <Link to="/section/agents" className="min-h-11 rounded-md px-2 text-xs font-medium text-ink hover:bg-surface-2">مناديب</Link>
              <Link to="/section/ledger" className="min-h-11 rounded-md px-2 text-xs font-medium text-ink hover:bg-surface-2">كشف</Link>
              <Link to="/team" className="min-h-11 rounded-md px-2 text-xs font-medium text-ink hover:bg-surface-2">فريق</Link>
            </div>
          )}
          <BackupButton isManager={profile.isManager} />
          <Button
            variant="ghost"
            className="min-h-11 px-3"
            disabled={signingOut}
            onClick={() => {
              setSigningOut(true);
              clearWalletUnlock();
              void signOut("/login").catch(() => setSigningOut(false));
            }}
          >
            <LogOut className="size-4" />
            <span className="hidden sm:inline">{signingOut ? "جاري الخروج…" : "خروج"}</span>
          </Button>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl gap-6 px-4 py-5 pb-24 md:pb-8">
        <aside className="hidden w-56 shrink-0 md:block">
          <nav className="sticky top-24 space-y-1">
            {SHARED_NAV.map((item) => (
              <NavLink key={item.to} {...item} active={pathname === item.to} />
            ))}
            {profile.isManager &&
              MANAGER_NAV.map((item) => (
                <NavLink key={item.to} {...item} active={pathname === item.to} />
              ))}
            {profile.isManager && (
              <NavLink to="/team" label="حسابات المحاسبين" icon={Users} active={pathname === "/team"} />
            )}
          </nav>
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur-sm md:hidden">
        <div className="grid grid-cols-4 gap-0.5 px-1 py-1 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
          {SHARED_NAV.map((item) => {
            const active = pathname === item.to;
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-md px-1 text-[10px] font-medium",
                  active ? "text-primary" : "text-muted",
                )}
              >
                <Icon className="size-4" />
                <span className="truncate">{item.label.split(" ")[0]}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function NavLink({
  to,
  label,
  icon: Icon,
  active,
}: {
  to: "/" | "/section/cards" | "/section/home" | "/section/ops" | "/section/agents" | "/section/ledger" | "/team";
  label: string;
  icon: typeof LayoutDashboard;
  active: boolean;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors duration-150",
        active ? "bg-primary text-primary-fg" : "text-ink hover:bg-surface-2",
      )}
    >
      <Icon className="size-4" />
      {label}
    </Link>
  );
}
