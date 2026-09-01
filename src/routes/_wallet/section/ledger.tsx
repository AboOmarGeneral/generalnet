import { createFileRoute } from "@tanstack/react-router";
import { LedgerView } from "@/components/ledger-view";
import { ManagerOnly } from "@/components/manager-only";

export const Route = createFileRoute("/_wallet/section/ledger")({
  component: LedgerPage,
});

function LedgerPage() {
  return (
    <ManagerOnly>
      <LedgerView />
    </ManagerOnly>
  );
}
