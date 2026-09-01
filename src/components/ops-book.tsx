import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { addOpsMovement, listOps, updateMovement } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatUsd, formatWhen } from "@/lib/money";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";

function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : "تعذر إتمام العملية";
}

export function OpsBook() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["ops"], queryFn: () => listOps() });
  const [kind, setKind] = useState<"expense" | "salary">("expense");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [edit, setEdit] = useState<{ id: number; amount: string; note: string } | null>(null);

  const add = useMutation({
    mutationFn: () => addOpsMovement({ data: { kind, amount: Number(amount), note } }),
    onSuccess: () => {
      setAmount("");
      setNote("");
      toast.success(kind === "salary" ? "سُجّل سحب الراتب" : "سُجّلت المصروف");
      void qc.invalidateQueries({ queryKey: ["ops"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      void qc.invalidateQueries({ queryKey: ["ledger"] });
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  const save = useMutation({
    mutationFn: () => updateMovement({ data: { id: edit!.id, amount: Number(edit!.amount), note: edit!.note } }),
    onSuccess: () => {
      setEdit(null);
      toast.success("عُدّلت الحركة");
      void qc.invalidateQueries({ queryKey: ["ops"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      void qc.invalidateQueries({ queryKey: ["ledger"] });
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  if (q.isPending) return <div className="h-40 animate-pulse rounded-xl bg-surface-2" />;
  if (q.isError) return <p className="text-sm text-debt">{errMessage(q.error)}</p>;
  const data = q.data!;

  return (
    <div>
      <PageHeader title="المصاريف وسحب الرواتب" />
      <div className="mb-5 grid grid-cols-2 gap-3">
        <Stat label="إجمالي المصاريف" value={formatUsd(data.expenses)} />
        <Stat label="إجمالي سحب الرواتب" value={formatUsd(data.salaries)} />
      </div>
      <form className="mb-6 space-y-3 rounded-xl bg-surface p-4 shadow-[var(--shadow-card)]" onSubmit={(e) => { e.preventDefault(); add.mutate(); }}>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setKind("expense")} className={cn("min-h-11 rounded-md text-sm font-medium", kind === "expense" ? "bg-primary text-primary-fg" : "bg-bg text-ink")}>مصروف</button>
          <button type="button" onClick={() => setKind("salary")} className={cn("min-h-11 rounded-md text-sm font-medium", kind === "salary" ? "bg-primary text-primary-fg" : "bg-bg text-ink")}>سحب راتب</button>
        </div>
        <div>
          <Label htmlFor="op-amt">المبلغ بالدولار</Label>
          <Input id="op-amt" inputMode="decimal" type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </div>
        <div>
          <Label htmlFor="op-note">{kind === "salary" ? "ملاحظة (اختياري)" : "بيان المصروف"}</Label>
          <Input id="op-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder={kind === "salary" ? "مثلاً سلفة أو راتب أسبوع" : "مثلاً كابل / صيانة"} required={kind === "expense"} />
        </div>
        <Button type="submit" className="w-full" disabled={add.isPending}>
          {kind === "salary" ? "تسجيل سحب الراتب" : "تسجيل المصروف"}
        </Button>
      </form>
      {data.movements.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface px-5 py-10 text-center text-sm text-muted">لا مصاريف ولا سحوبات بعد.</div>
      ) : (
        <ul className="space-y-2">
          {data.movements.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface px-4 py-3 shadow-[var(--shadow-card)]">
              <div>
                <p className="text-sm font-medium">
                  {m.kind === "salary" ? "سحب راتب" : "مصروف"}{" "}
                  <span className="tabular-nums text-debt">{formatUsd(m.amount)}</span>
                </p>
                <p className="text-xs text-muted">
                  {m.actorName} · {formatWhen(m.createdAt)}
                  {m.editedByName ? ` · عدّلها ${m.editedByName}` : ""}
                  {m.note ? ` · ${m.note}` : ""}
                </p>
              </div>
              <Button variant="ghost" className="min-h-10 text-xs" onClick={() => setEdit({ id: m.id, amount: String(m.amount), note: m.note })}>تعديل</Button>
            </li>
          ))}
        </ul>
      )}
      {edit && (
        <Modal title="تعديل الحركة" onClose={() => setEdit(null)}>
          <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-3">
            <div>
              <Label htmlFor="eamt">المبلغ</Label>
              <Input id="eamt" type="number" min="0.01" step="0.01" value={edit.amount} onChange={(e) => setEdit({ ...edit, amount: e.target.value })} required />
            </div>
            <div>
              <Label htmlFor="enote">ملاحظة</Label>
              <Input id="enote" value={edit.note} onChange={(e) => setEdit({ ...edit, note: e.target.value })} />
            </div>
            <Button type="submit" className="w-full" disabled={save.isPending}>حفظ</Button>
          </form>
        </Modal>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface px-4 py-3 shadow-[var(--shadow-card)]">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-end sm:place-items-center sm:p-4">
      <button type="button" className="absolute inset-0 bg-ink/40" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-t-xl bg-surface p-5 sm:rounded-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">{title}</h2>
          <button type="button" className="text-sm text-muted" onClick={onClose}>إغلاق</button>
        </div>
        {children}
      </div>
    </div>
  );
}
