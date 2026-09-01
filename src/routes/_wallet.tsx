import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getSessionProfile } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import { WalletMark } from "@/components/mark";
import { readWalletUnlocked } from "@/lib/wallet-session";

export const Route = createFileRoute("/_wallet")({
  component: WalletGate,
});

export function LoadingScreen({ label = "جاري التحميل" }: { label?: string }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-bg px-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <WalletMark />
        <p className="text-sm font-medium text-ink">{label}</p>
        <p className="text-xs text-muted">محفظة شبكة الجنرال</p>
      </div>
    </div>
  );
}

function WalletGate() {
  const { user, isPending } = useCurrentUserState();
  const [hydrated, setHydrated] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  useEffect(() => {
    setUnlocked(readWalletUnlocked());
    setHydrated(true);
  }, []);
  const profile = useQuery({
    queryKey: ["profile"],
    queryFn: () => getSessionProfile(),
    enabled: Boolean(user) && unlocked,
    retry: false,
  });

  if (!hydrated || isPending) return <LoadingScreen />;
  if (!unlocked || !user) return <RedirectToSignIn />;
  if (profile.isPending) return <LoadingScreen label="جاري فتح المحفظة" />;
  if (!profile.data?.linked) return <RedirectToSignIn />;

  return (
    <AppShell
      profile={{
        displayName: profile.data.displayName,
        username: profile.data.username,
        role: profile.data.role,
        walletName: profile.data.walletName,
        isManager: profile.data.isManager,
      }}
    >
      <Outlet />
    </AppShell>
  );
}
