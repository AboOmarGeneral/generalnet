import { createFileRoute } from "@tanstack/react-router";
import { OpsBook } from "@/components/ops-book";

export const Route = createFileRoute("/_wallet/section/ops")({
  component: OpsPage,
});

function OpsPage() {
  return <OpsBook />;
}
