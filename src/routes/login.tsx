import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getSessionProfile, getSetupState } from "@/lib/api";
import { LoginScreen } from "@/components/login-screen";
import { LoadingScreen } from "@/routes/_wallet";
import { readWalletUnlocked } from "@/lib/wallet-session";

export const Route = createFileRoute("/login")({
  loader: () => getSetupState(),
  component: Login,
});

function Login() {
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
  });

  if (!hydrated || isPending) return <LoadingScreen />;
  if (unlocked && user && profile.isPending) return <LoadingScreen />;
  if (unlocked && user && profile.data?.linked) return <Navigate to="/" />;

  return (
    <LoginScreen
      needsManager={setup.needsManager}
      signedInUnlinked={Boolean(unlocked && user && profile.data && !profile.data.linked)}
    />
  );
}
