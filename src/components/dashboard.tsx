import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bike, CreditCard, Home, Receipt, ScrollText } from "lucide-react";
import { getDashboard } from "@/lib/api";
import { formatUsd, formatWhen } from "@/lib/money";
import { PageHeader } from "@/components/page-header";
import { cn } from "@/lib/cn";

function kindLabel(kind: string): string {
  if (kind === "debt_add") return "إضافة دين";
  if (kind === "debt_pay") return "تحصيل";
  if (kind === "expense") return "مصروف";
  if (kind === "salary") return "سحب راتب";
  if (kind === "account_delete") return "حذف حساب";
  return kind;
}

function bookLabel(book: string): string {
  if (book === "cards") return "بطاقات";
  if (book === "home") return "منازل";
  return "تشغيل";
}

export function Dashboard({ isManager }: { isManager: boolean }) {
  const q = useQuery({ queryKey: ["dashboard"], queryFn: () => getDashboard() });

  if (q.isPending) return <p className="text-sm text-muted">جاري تحميل أرقام المحفظة…</p>;
  if (q.isError) {
    return (
      <p className="text-sm text-debt">
        {q.error instanceof Error ? q.error.message : "تعذر التحميل"}
      </p>
    );
  }
  const d = q.data!;

  return (
    <div>
      <PageHeader eyebrow="المحفظة" title="نظرة على الشبكة" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi to="/section/cards" label="ديون البطاقات" value={formatUsd(d.cardDebt)} tone="debt" />
        <Kpi to="/section/home" label="ديون المنازل" value={formatUsd(d.homeDebt)} tone="debt" />
        <Kpi to="/section/ops" label="مصاريف هذا الشهر" value={formatUsd(d.monthExpenses)} />
        <Kpi to="/section/ops" label="رواتب هذا الشهر" value={formatUsd(d.monthSalaries)} />
      </div>
      <div className="mt-4 rounded-xl bg-surface px-4 py-3 shadow-[var(--shadow-card)]">
        <p className="text-xs text-muted">وارد التحصيل هذا الشهر</p>
        <p className="mt-1 text-lg font-semibold tabular-nums text-credit">{formatUsd(d.monthCollected)}</p>
      </div>
      {isManager ? (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-surface px-4 py-3 shadow-[var(--shadow-card)]">
            <p className="text-xs text-muted">وارد المناديب هذا الشهر</p>
            <p className="mt-1 font-semibold tabular-nums text-credit">{formatUsd(d.monthAgentIn)}</p>
          </div>
          <div className="rounded-xl bg-surface px-4 py-3 shadow-[var(--shadow-card)]">
            <p className="text-xs text-muted">مصروف المناديب هذا الشهر</p>
            <p className="mt-1 font-semibold tabular-nums text-debt">{formatUsd(d.monthAgentOut)}</p>
          </div>
        </div>
      ) : null}

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <SectionLink to="/section/cards" icon={CreditCard} title="ديون البطاقات" body="مشتركو كروت الشحن والرصيد الآجل" />
        <SectionLink to="/section/home" icon={Home} title="اشتراكات المنازل" body="ديون الخطوط المنزلية الشهرية" />
        <SectionLink to="/section/ops" icon={Receipt} title="مصاريف ورواتب" body="صادر التشغيل وسحب رواتب الفريق" />
        {isManager ? (
          <>
            <SectionLink to="/section/agents" icon={Bike} title="مدفوعات المناديب" body="الوارد الشهري ومصروف كل مندوب" />
            <SectionLink to="/section/ledger" icon={ScrollText} title="الكشف" body="وارد وصادر المحاسبين والمناديب" />
          </>
        ) : null}
      </div>

      <h2 className="mt-8 mb-3 text-sm font-semibold">آخر الحركات</h2>
      {d.recent.length === 0 ? (
        <p className="text-sm text-muted">لا حركات بعد. ابدأ بإضافة مشترك من قسم الديون.</p>
      ) : (
        <ul className="space-y-2">
          {d.recent.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface px-4 py-3 text-sm shadow-[var(--shadow-card)]">
              <span>
                {kindLabel(m.kind)} · {bookLabel(m.book)}
                {m.subscriberName ? ` · على حساب ${m.subscriberName}` : ""}
                {m.note && m.note !== m.subscriberName ? ` · ${m.note}` : ""}
                <span className="mt-0.5 block text-xs text-muted">
                  {m.actorName} · {formatWhen(m.createdAt)}
                </span>
              </span>
              <span className={cn("tabular-nums font-medium", m.kind === "debt_pay" ? "text-credit" : "text-ink")}>
                {formatUsd(m.amount)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Kpi({
  to,
  label,
  value,
  tone,
}: {
  to: "/section/cards" | "/section/home" | "/section/ops";
  label: string;
  value: string;
  tone?: "debt";
}) {
  return (
    <Link to={to} className="rounded-xl bg-surface px-4 py-3 shadow-[var(--shadow-card)] transition-transform duration-150 active:scale-[0.98]">
      <p className="text-xs text-muted">{label}</p>
      <p className={cn("mt-1 font-semibold tabular-nums", tone === "debt" && "text-debt")}>{value}</p>
    </Link>
  );
}

function SectionLink({
  to,
  icon: Icon,
  title,
  body,
}: {
  to: "/section/cards" | "/section/home" | "/section/ops" | "/section/ledger" | "/section/agents";
  icon: typeof CreditCard;
  title: string;
  body: string;
}) {
  return (
    <Link to={to} className="flex gap-3 rounded-xl bg-surface p-4 shadow-[var(--shadow-card)] transition-transform duration-150 active:scale-[0.98]">
      <span className="grid size-10 place-items-center rounded-md bg-primary text-primary-fg">
        <Icon className="size-4" />
      </span>
      <span>
        <span className="block font-semibold">{title}</span>
        <span className="block text-sm text-muted">{body}</span>
      </span>
    </Link>
  );
}
