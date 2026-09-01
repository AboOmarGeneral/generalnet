import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getLedger } from "@/lib/api";
import { cn } from "@/lib/cn";
import { currentMonthKey, formatUsd, formatWhen, monthLabel } from "@/lib/money";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";

function kindLabel(kind: string): string {
  if (kind === "debt_add") return "إضافة دين";
  if (kind === "debt_pay") return "وارد / تسديد";
  if (kind === "expense") return "مصروف";
  if (kind === "salary") return "سحب راتب";
  if (kind === "agent_in") return "وارد مندوب";
  if (kind === "agent_out") return "مصروف مندوب";
  if (kind === "account_delete") return "حذف حساب";
  return kind;
}

const MONTH_NAMES = Array.from({ length: 12 }, (_, i) =>
  new Intl.DateTimeFormat("ar", { month: "long" }).format(new Date(2020, i, 1)),
);

export function LedgerView() {
  const [month, setMonth] = useState(currentMonthKey());
  const q = useQuery({
    queryKey: ["ledger", month],
    queryFn: () => getLedger({ data: month }),
  });

  return (
    <div>
      <PageHeader title="كشف المحاسبين" action={<MonthPicker value={month} onChange={setMonth} />} />
      {q.isPending ? (
        <div className="h-40 animate-pulse rounded-xl bg-surface-2" />
      ) : q.isError ? (
        <p className="text-sm text-debt">{q.error instanceof Error ? q.error.message : "تعذر التحميل"}</p>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-surface px-4 py-3 shadow-[var(--shadow-card)]">
              <p className="text-xs text-muted">وارد الشهر</p>
              <p className="mt-1 font-semibold tabular-nums text-credit">{formatUsd(q.data.monthIn)}</p>
            </div>
            <div className="rounded-xl bg-surface px-4 py-3 shadow-[var(--shadow-card)]">
              <p className="text-xs text-muted">صادر الشهر</p>
              <p className="mt-1 font-semibold tabular-nums text-debt">{formatUsd(q.data.monthOut)}</p>
            </div>
          </div>
          <div className="space-y-4">
            {q.data.accountants.map((a) => (
              <article key={a.userId} className="rounded-xl bg-surface p-4 shadow-[var(--shadow-card)]">
                <header className="mb-3">
                  <h2 className="font-semibold">{a.displayName}</h2>
                </header>
                <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                  <Row label="وارد (تحصيل)" value={formatUsd(a.collected)} tone="credit" />
                  <Row label="ديون أضافها" value={formatUsd(a.added)} />
                  <Row label="شطبه / سدده" value={formatUsd(a.writtenOff)} />
                  <Row label="مصاريف" value={formatUsd(a.expenses)} tone="debt" />
                  <Row label="سحب راتب" value={formatUsd(a.salary)} tone="debt" />
                </dl>
                {a.movements.length === 0 ? (
                  <p className="mt-3 text-sm text-muted">لا حركات هذا الشهر.</p>
                ) : (
                  <ul className="mt-3 space-y-1.5 border-t border-border pt-3">
                    {a.movements.map((m) => (
                      <li key={m.id} className="flex justify-between gap-3 text-xs">
                        <span className="text-muted">
                          {formatWhen(m.createdAt)} · {kindLabel(m.kind)}
                          {m.subscriberName ? ` · على حساب ${m.subscriberName}` : ""}
                          {m.note && m.note !== m.subscriberName ? ` · ${m.note}` : ""}
                        </span>
                        <span className={cn("shrink-0 tabular-nums", m.kind === "debt_pay" ? "text-credit" : "text-ink")}>
                          {formatUsd(m.amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            ))}
            {q.data.agents.length > 0 ? (
              <>
                <h2 className="pt-2 text-sm font-semibold">المناديب</h2>
                {q.data.agents.map((a) => (
                  <article key={a.id} className="rounded-xl bg-surface p-4 shadow-[var(--shadow-card)]">
                    <header className="mb-3">
                      <h3 className="font-semibold">{a.name}</h3>
                    </header>
                    <dl className="grid grid-cols-2 gap-2 text-sm">
                      <Row label="وارد" value={formatUsd(a.incoming)} tone="credit" />
                      <Row label="مصروف" value={formatUsd(a.expenses)} tone="debt" />
                    </dl>
                    {a.movements.length === 0 ? (
                      <p className="mt-3 text-sm text-muted">لا مدفوعات هذا الشهر.</p>
                    ) : (
                      <ul className="mt-3 space-y-1.5 border-t border-border pt-3">
                        {a.movements.map((m) => (
                          <li key={m.id} className="flex justify-between gap-3 text-xs">
                            <span className="text-muted">
                              {formatWhen(m.createdAt)} · {kindLabel(m.kind)}
                              {m.note ? ` · ${m.note}` : ""}
                            </span>
                            <span className={cn("shrink-0 tabular-nums", m.kind === "agent_in" ? "text-credit" : "text-debt")}>
                              {formatUsd(m.amount)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </article>
                ))}
              </>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}

function MonthPicker({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const [open, setOpen] = useState(false);
  const [draftYear, setDraftYear] = useState(() => Number(value.slice(0, 4)));
  const [draftMonth, setDraftMonth] = useState(() => Number(value.slice(5, 7)));
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    setDraftYear(Number(value.slice(0, 4)));
    setDraftMonth(Number(value.slice(5, 7)));
  }, [open, value]);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  function confirm() {
    onChange(`${draftYear}-${String(draftMonth).padStart(2, "0")}`);
    setOpen(false);
  }
  return (
    <div ref={box} className="relative">
      <Button variant="secondary" onClick={() => setOpen((v) => !v)}>{monthLabel(value)}</Button>
      {open ? (
        <div className="absolute start-0 top-full z-20 mt-2 w-72 rounded-lg bg-surface p-3 shadow-[var(--shadow-card)] sm:start-auto sm:end-0">
          <div className="mb-3 flex items-center justify-between gap-2">
            <button type="button" className="grid size-11 place-items-center rounded-md hover:bg-surface-2" onClick={() => setDraftYear((y) => y - 1)} aria-label="السنة السابقة">
              <ChevronRight className="size-4" />
            </button>
            <p className="text-sm font-semibold tabular-nums">{draftYear}</p>
            <button type="button" className="grid size-11 place-items-center rounded-md hover:bg-surface-2" onClick={() => setDraftYear((y) => y + 1)} aria-label="السنة التالية">
              <ChevronLeft className="size-4" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {MONTH_NAMES.map((name, i) => {
              const n = i + 1;
              const selected = n === draftMonth;
              return (
                <button key={name} type="button" onClick={() => setDraftMonth(n)} className={cn("min-h-11 rounded-md px-1 text-xs font-medium", selected ? "bg-primary text-primary-fg" : "text-ink hover:bg-surface-2")}>
                  {name}
                </button>
              );
            })}
          </div>
          <Button className="mt-3 w-full" onClick={confirm}>تأكيد</Button>
        </div>
      ) : null}
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "credit" | "debt" }) {
  return (
    <div className="rounded-md bg-bg px-3 py-2">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={cn("mt-0.5 font-medium tabular-nums", tone === "credit" && "text-credit", tone === "debt" && "text-debt")}>
        {value}
      </dd>
    </div>
  );
}
