import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { createAccountant, listTeam } from "@/lib/api";
import { formatWhen } from "@/lib/money";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";

function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : "تعذر إتمام العملية";
}

export function TeamPanel() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["team"], queryFn: () => listTeam() });
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");

  const add = useMutation({
    mutationFn: () => createAccountant({ data: { username, displayName, password } }),
    onSuccess: () => {
      setUsername("");
      setDisplayName("");
      setPassword("");
      toast.success("أُنشئ حساب المحاسب — أعطِه اسم المستخدم وكلمة المرور");
      void qc.invalidateQueries({ queryKey: ["team"] });
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  if (q.isPending) return <div className="h-40 animate-pulse rounded-xl bg-surface-2" />;
  if (q.isError) return <p className="text-sm text-debt">{errMessage(q.error)}</p>;
  const data = q.data!;

  if (!data.isManager) {
    return (
      <p className="rounded-xl bg-surface p-5 text-sm text-muted shadow-[var(--shadow-card)]">
        إضافة المحاسبين متاحة لمدير الشبكة فقط.
      </p>
    );
  }

  return (
    <div>
      <PageHeader title="حسابات المحاسبين" />
      <form
        className="mb-6 space-y-3 rounded-xl bg-surface p-4 shadow-[var(--shadow-card)]"
        onSubmit={(e) => {
          e.preventDefault();
          add.mutate();
        }}
      >
        <div>
          <Label htmlFor="dn">الاسم الظاهر (يظهر بجانب كل حركة)</Label>
          <Input id="dn" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
        </div>
        <div>
          <Label htmlFor="un">اسم المستخدم للدخول</Label>
          <Input id="un" autoComplete="off" value={username} onChange={(e) => setUsername(e.target.value)} required dir="ltr" className="text-left" />
        </div>
        <div>
          <Label htmlFor="pw">كلمة المرور</Label>
          <Input id="pw" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required dir="ltr" className="text-left" />
        </div>
        <Button type="submit" className="w-full" disabled={add.isPending || data.remaining <= 0}>
          إنشاء حساب محاسب
        </Button>
      </form>
      <ul className="space-y-2">
        {data.members.map((m) => (
          <li key={m.id} className="flex items-center justify-between rounded-xl bg-surface px-4 py-3 shadow-[var(--shadow-card)]">
            <div>
              <p className="font-medium">
                {m.displayName}
                {m.isYou ? " (أنت)" : ""}
              </p>
              <p className="text-xs text-muted">
                {m.role === "manager" ? "مدير الشبكة" : "محاسب"} · {m.username} · {formatWhen(m.createdAt)}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
