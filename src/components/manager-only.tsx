import { Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { getSessionProfile } from "@/lib/api";

export function ManagerOnly({ children }: { children: ReactNode }) {
  const profile = useQuery({
    queryKey: ["profile"],
    queryFn: () => getSessionProfile(),
  });

  if (profile.isPending) {
    return <p className="text-sm text-muted">جاري التحميل…</p>;
  }
  if (!profile.data?.linked || !profile.data.isManager) {
    return <Navigate to="/" />;
  }
  return children;
}
