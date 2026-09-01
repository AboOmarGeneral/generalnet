import { createFileRoute } from "@tanstack/react-router";
import { ManagerOnly } from "@/components/manager-only";
import { TeamPanel } from "@/components/team-panel";

export const Route = createFileRoute("/_wallet/team")({
  component: TeamPage,
});

function TeamPage() {
  return (
    <ManagerOnly>
      <TeamPanel />
    </ManagerOnly>
  );
}
