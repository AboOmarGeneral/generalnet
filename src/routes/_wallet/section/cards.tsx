import { createFileRoute } from "@tanstack/react-router";
import { DebtBook } from "@/components/debt-book";

export const Route = createFileRoute("/_wallet/section/cards")({
  component: CardsPage,
});

function CardsPage() {
  return <DebtBook section="cards" title="ديون البطاقات" />;
}
