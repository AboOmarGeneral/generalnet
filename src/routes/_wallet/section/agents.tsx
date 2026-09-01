import { createFileRoute } from "@tanstack/react-router";
import { AgentsBook } from "@/components/agents-book";
import { ManagerOnly } from "@/components/manager-only";

export const Route = createFileRoute("/_wallet/section/agents")({
  component: AgentsPage,
});

function AgentsPage() {
  return (
    <ManagerOnly>
      <AgentsBook />
    </ManagerOnly>
  );
}
