import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getSessionProfile, getSetupState } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import { Dashboard } from "@/components/dashboard";
import { LoginScreen } from "@/components/login-screen";
import { LoadingScreen } from "@/routes/_wallet";
import { readWalletUnlocked } from "@/lib/wallet-session";

export const Route = createFileRoute("/")({
  loader: () => getSetupState(),
  component: Home,
});

function Home() {
  const setup = Route.useLoaderData();
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
  if (unlocked && user && profile.isPending) return <LoadingScreen label="جاري فتح المحفظة" />;
  if (unlocked && user && profile.data?.linked) {
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
        <Dashboard isManager={profile.data.isManager} />
      </AppShell>
    );
  }

  return (
    <LoginScreen
      needsManager={setup.needsManager}
      signedInUnlinked={Boolean(unlocked && user && !isPending && profile.data && !profile.data.linked)}
    />
  );
}
