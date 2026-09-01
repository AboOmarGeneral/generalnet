import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  addDebtMovement,
  addSubscriber,
  deleteSubscriber,
  listDebtBook,
  renameSubscriber,
  updateMovement,
} from "@/lib/api";
import { formatUsd, formatWhen } from "@/lib/money";
import { cn } from "@/lib/cn";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";

type Section = "cards" | "home";

function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : "تعذر إتمام العملية";
}

export function DebtBook({ section, title }: { section: Section; title: string }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["debt", section], queryFn: () => listDebtBook({ data: section }) });
  const [search, setSearch] = useState("");
  const [newName, setNewName] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);
  const [renameId, setRenameId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [moveFor, setMoveFor] = useState<{ id: number; name: string; kind: "debt_add" | "debt_pay" } | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [edit, setEdit] = useState<{ id: number; amount: string; note: string } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: number; name: string } | null>(null);

  const addSub = useMutation({
    mutationFn: () => addSubscriber({ data: { section, name: newName } }),
    onSuccess: () => { setNewName(""); toast.success("تمت إضافة المشترك"); void qc.invalidateQueries({ queryKey: ["debt", section] }); },
    onError: (e) => toast.error(errMessage(e)),
  });
  const rename = useMutation({
    mutationFn: () => renameSubscriber({ data: { id: renameId!, name: renameValue } }),
    onSuccess: () => { setRenameId(null); toast.success("تم تعديل الاسم"); void qc.invalidateQueries({ queryKey: ["debt", section] }); },
    onError: (e) => toast.error(errMessage(e)),
  });
  const remove = useMutation({
    mutationFn: () => deleteSubscriber({ data: { id: pendingDelete!.id } }),
    onSuccess: () => {
      setPendingDelete(null);
      toast.success("حُذف الحساب وشُطبت ديونه");
      void qc.invalidateQueries({ queryKey: ["debt", section] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      void qc.invalidateQueries({ queryKey: ["ledger"] });
    },
    onError: (e) => toast.error(errMessage(e)),
  });
  const addMove = useMutation({
    mutationFn: () => addDebtMovement({ data: { subscriberId: moveFor!.id, section, kind: moveFor!.kind, amount: Number(amount), note } }),
    onSuccess: () => {
      setMoveFor(null); setAmount(""); setNote(""); toast.success("سُجّلت الحركة");
      void qc.invalidateQueries({ queryKey: ["debt", section] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      void qc.invalidateQueries({ queryKey: ["ledger"] });
    },
    onError: (e) => toast.error(errMessage(e)),
  });
  const saveMove = useMutation({
    mutationFn: () => updateMovement({ data: { id: edit!.id, amount: Number(edit!.amount), note: edit!.note } }),
    onSuccess: () => {
      setEdit(null); toast.success("عُدّلت الحركة");
      void qc.invalidateQueries({ queryKey: ["debt", section] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      void qc.invalidateQueries({ queryKey: ["ledger"] });
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  const filtered = useMemo(() => {
    const list = q.data?.subscribers ?? [];
    const s = search.trim();
    if (!s) return list;
    return list.filter((x) => x.name.includes(s));
  }, [q.data, search]);

  if (q.isPending) return <div className="space-y-3"><div className="h-10 w-48 animate-pulse rounded-md bg-surface-2" /><div className="h-28 animate-pulse rounded-xl bg-surface-2" /></div>;
  if (q.isError) return <p className="text-sm text-debt">{errMessage(q.error)}</p>;
  const data = q.data!;

  return (
    <div>
      <PageHeader title={title} action={<div className="rounded-lg bg-surface px-4 py-3 shadow-[var(--shadow-card)]"><p className="text-xs text-muted">إجمالي الديون</p><p className="font-semibold tabular-nums text-debt">{formatUsd(data.total)}</p></div>} />
      <form className="mb-5 flex flex-col gap-2 rounded-xl bg-surface p-3 shadow-[var(--shadow-card)] sm:flex-row" onSubmit={(e) => { e.preventDefault(); addSub.mutate(); }}>
        <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="اسم المشترك المدان" required />
        <Button type="submit" disabled={addSub.isPending} className="sm:w-40"><Plus className="size-4" /> مشترك جديد</Button>
      </form>
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted" />
        <Input className="pr-10" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث بالاسم" />
      </div>
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface px-5 py-10 text-center text-sm text-muted">لا مشتركين في هذا القسم بعد.</div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((sub) => {
            const history = data.movements.filter((m) => m.subscriberId === sub.id);
            const open = openId === sub.id;
            return (
              <li key={sub.id} className="rounded-xl bg-surface p-4 shadow-[var(--shadow-card)]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-1">
                    <button type="button" className="min-w-0 text-right" onClick={() => setOpenId(open ? null : sub.id)}>
                      <p className="font-semibold">{sub.name}</p>
                      <p className={cn("mt-0.5 text-sm tabular-nums", sub.balance > 0 ? "text-debt" : "text-credit")}>الرصيد: {formatUsd(sub.balance)}</p>
                    </button>
                    <button type="button" className="grid size-11 shrink-0 place-items-center rounded-md text-debt hover:bg-surface-2" aria-label="حذف الحساب" onClick={() => setPendingDelete({ id: sub.id, name: sub.name })}>
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" className="min-h-10 text-xs" onClick={() => { setRenameId(sub.id); setRenameValue(sub.name); }}><Pencil className="size-3.5" /> تعديل الاسم</Button>
                    <Button className="min-h-10 text-xs" onClick={() => setMoveFor({ id: sub.id, name: sub.name, kind: "debt_add" })}>إضافة دين</Button>
                    <Button variant="secondary" className="min-h-10 text-xs" onClick={() => setMoveFor({ id: sub.id, name: sub.name, kind: "debt_pay" })}>خصم / تسديد</Button>
                  </div>
                </div>
                {open && (
                  <div className="mt-4 border-t border-border pt-3">
                    {history.length === 0 ? <p className="text-sm text-muted">لا حركات بعد.</p> : (
                      <ul className="space-y-2">
                        {history.map((m) => (
                          <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-bg px-3 py-2 text-sm">
                            <div>
                              <p className="font-medium">{m.kind === "debt_add" ? "إضافة دين" : "تسديد"} <span className={cn("tabular-nums", m.kind === "debt_add" ? "text-debt" : "text-credit")}>{formatUsd(m.amount)}</span></p>
                              <p className="text-xs text-muted">{m.actorName} · {formatWhen(m.createdAt)}{m.editedByName ? ` · عدّلها ${m.editedByName}` : ""}{m.note ? ` · ${m.note}` : ""}</p>
                            </div>
                            <Button variant="ghost" className="min-h-10 text-xs" onClick={() => setEdit({ id: m.id, amount: String(m.amount), note: m.note })}>تعديل الحركة</Button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {renameId !== null && (
        <Modal title="تعديل اسم المشترك" onClose={() => setRenameId(null)}>
          <form onSubmit={(e) => { e.preventDefault(); rename.mutate(); }} className="space-y-3">
            <Label htmlFor="rename">الاسم</Label>
            <Input id="rename" value={renameValue} onChange={(e) => setRenameValue(e.target.value)} required />
            <Button type="submit" className="w-full" disabled={rename.isPending}>حفظ الاسم</Button>
          </form>
        </Modal>
      )}
      {moveFor && (
        <Modal title={moveFor.kind === "debt_add" ? "إضافة دين" : "خصم / تسديد"} onClose={() => setMoveFor(null)}>
          <p className="mb-3 text-sm text-muted">{moveFor.name}</p>
          <form onSubmit={(e) => { e.preventDefault(); addMove.mutate(); }} className="space-y-3">
            <div><Label htmlFor="amt">المبلغ بالدولار</Label><Input id="amt" inputMode="decimal" type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required /></div>
            <div><Label htmlFor="note">ملاحظة (اختياري)</Label><Input id="note" value={note} onChange={(e) => setNote(e.target.value)} /></div>
            <Button type="submit" className="w-full" disabled={addMove.isPending}>تسجيل الحركة</Button>
          </form>
        </Modal>
      )}
      {edit && (
        <Modal title="تعديل الحركة المالية" onClose={() => setEdit(null)}>
          <form onSubmit={(e) => { e.preventDefault(); saveMove.mutate(); }} className="space-y-3">
            <div><Label htmlFor="eamt">المبلغ بالدولار</Label><Input id="eamt" inputMode="decimal" type="number" min="0.01" step="0.01" value={edit.amount} onChange={(e) => setEdit({ ...edit, amount: e.target.value })} required /></div>
            <div><Label htmlFor="enote">ملاحظة</Label><Input id="enote" value={edit.note} onChange={(e) => setEdit({ ...edit, note: e.target.value })} /></div>
            <Button type="submit" className="w-full" disabled={saveMove.isPending}>حفظ التعديل</Button>
          </form>
        </Modal>
      )}
      {pendingDelete && (
        <Modal title="حذف الحساب" onClose={() => setPendingDelete(null)}>
          <p className="text-sm text-ink">هل تريد حذف هذا الحساب و شطب ديونه</p>
          <p className="mt-2 font-semibold">{pendingDelete.name}</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button variant="danger" disabled={remove.isPending} onClick={() => remove.mutate()}>حذف</Button>
            <Button variant="secondary" onClick={() => setPendingDelete(null)}>إلغاء</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-end p-0 sm:place-items-center sm:p-4">
      <button type="button" className="absolute inset-0 bg-ink/40" aria-label="إغلاق" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-t-xl bg-surface p-5 shadow-[var(--shadow-card)] sm:rounded-xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">{title}</h2>
          <button type="button" className="text-sm text-muted" onClick={onClose}>إغلاق</button>
        </div>
        {children}
      </div>
    </div>
  );
}
