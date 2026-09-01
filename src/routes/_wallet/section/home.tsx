import { createFileRoute } from "@tanstack/react-router";
import { DebtBook } from "@/components/debt-book";

export const Route = createFileRoute("/_wallet/section/home")({
  component: HomeDebtsPage,
});

function HomeDebtsPage() {
  return <DebtBook section="home" title="ديون الاشتراكات المنزلية" />;
}
