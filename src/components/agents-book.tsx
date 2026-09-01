import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { addAgent, addAgentMovement, deleteAgent, listAgents } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatUsd, formatWhen } from "@/lib/money";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";

function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : "تعذر إتمام العملية";
}

export function AgentsBook() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["agents"], queryFn: () => listAgents() });
  const [newName, setNewName] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: number; name: string } | null>(null);
  const [moveFor, setMoveFor] = useState<{ id: number; name: string; kind: "agent_in" | "agent_out" } | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const add = useMutation({
    mutationFn: () => addAgent({ data: { name: newName } }),
    onSuccess: () => {
      setNewName("");
      toast.success("أُضيف المندوب");
      void qc.invalidateQueries({ queryKey: ["agents"] });
      void qc.invalidateQueries({ queryKey: ["ledger"] });
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  const remove = useMutation({
    mutationFn: () => deleteAgent({ data: { id: pendingDelete!.id } }),
    onSuccess: () => {
      setPendingDelete(null);
      toast.success("حُذف المندوب");
      void qc.invalidateQueries({ queryKey: ["agents"] });
      void qc.invalidateQueries({ queryKey: ["ledger"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  const addMove = useMutation({
    mutationFn: () =>
      addAgentMovement({
        data: { agentId: moveFor!.id, kind: moveFor!.kind, amount: Number(amount), note },
      }),
    onSuccess: () => {
      setMoveFor(null);
      setAmount("");
      setNote("");
      toast.success("سُجّلت المدفوعة");
      void qc.invalidateQueries({ queryKey: ["agents"] });
      void qc.invalidateQueries({ queryKey: ["ledger"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  if (q.isPending) return <div className="h-40 animate-pulse rounded-xl bg-surface-2" />;
  if (q.isError) return <p className="text-sm text-debt">{errMessage(q.error)}</p>;
  const data = q.data!;

  return (
    <div>
      <PageHeader title="مدفوعات المناديب" />
      <form
        className="mb-5 flex flex-col gap-2 rounded-xl bg-surface p-3 shadow-[var(--shadow-card)] sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          add.mutate();
        }}
      >
        <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="اسم المندوب" required />
        <Button type="submit" disabled={add.isPending} className="sm:w-40">
          <Plus className="size-4" />
          مندوب جديد
        </Button>
      </form>
      {data.agents.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface px-5 py-10 text-center text-sm text-muted">
          لا مناديب بعد.
        </div>
      ) : (
        <ul className="space-y-3">
          {data.agents.map((agent) => {
            const history = data.movements.filter((m) => m.agentId === agent.id);
            const open = openId === agent.id;
            return (
              <li key={agent.id} className="rounded-xl bg-surface p-4 shadow-[var(--shadow-card)]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-1">
                    <button type="button" className="min-w-0 text-right" onClick={() => setOpenId(open ? null : agent.id)}>
                      <p className="font-semibold">{agent.name}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        وارد {formatUsd(agent.incoming)} · مصروف {formatUsd(agent.expenses)}
                      </p>
                    </button>
                    <button
                      type="button"
                      className="grid size-11 shrink-0 place-items-center rounded-md text-debt hover:bg-surface-2"
                      aria-label="حذف المندوب"
                      onClick={() => setPendingDelete({ id: agent.id, name: agent.name })}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button className="min-h-10 text-xs" onClick={() => setMoveFor({ id: agent.id, name: agent.name, kind: "agent_in" })}>
                      وارد شهري
                    </Button>
                    <Button variant="secondary" className="min-h-10 text-xs" onClick={() => setMoveFor({ id: agent.id, name: agent.name, kind: "agent_out" })}>
                      مصروف
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {pendingDelete && (
        <div className="fixed inset-0 z-50 grid place-items-center sm:p-4">
          <button type="button" className="absolute inset-0 bg-ink/40" onClick={() => setPendingDelete(null)} />
          <div className="relative w-full max-w-md rounded-xl bg-surface p-5">
            <p className="text-sm">هل تريد حذف هذا المندوب وكل مدفوعاته</p>
            <p className="mt-2 font-semibold">{pendingDelete.name}</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button variant="danger" disabled={remove.isPending} onClick={() => remove.mutate()}>حذف</Button>
              <Button variant="secondary" onClick={() => setPendingDelete(null)}>إلغاء</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
