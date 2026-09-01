import { Download, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { exportBackup, restoreBackup } from "@/lib/api";
import { Button } from "@/components/ui/button";

export function BackupButton({ isManager }: { isManager: boolean }) {
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<BackupFile | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  async function download() {
    setBusy(true);
    try {
      const data = await exportBackup();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json;charset=utf-8",
      });
      const stamp = new Date().toISOString().slice(0, 10);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `محفظة-شبكة-الجنرال-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("تم تنزيل النسخة الاحتياطية — احفظ الملف لاستعادته لاحقاً");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر إنشاء النسخة");
    } finally {
      setBusy(false);
    }
  }

  function onPick(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as BackupFile;
        if (parsed.format !== "general-wallet-backup" || parsed.version !== 1) {
          toast.error("هذا الملف لا يُستعاد. خذ نسخة جديدة من زر النسخ الاحتياطي بعد التحديث.");
          return;
        }
        setPendingFile(parsed);
        setConfirmOpen(true);
      } catch {
        toast.error("تعذر قراءة الملف. يلزم ملف JSON من زر النسخ الاحتياطي.");
      }
    };
    reader.readAsText(file);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function confirmRestore() {
    if (!pendingFile) return;
    setBusy(true);
    try {
      const result = await restoreBackup({ data: pendingFile });
      setConfirmOpen(false);
      setPendingFile(null);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["dashboard"] }),
        qc.invalidateQueries({ queryKey: ["debt"] }),
        qc.invalidateQueries({ queryKey: ["ledger"] }),
        qc.invalidateQueries({ queryKey: ["ops"] }),
        qc.invalidateQueries({ queryKey: ["agents"] }),
      ]);
      toast.success(
        `تمت الاستعادة دون حذف شيء: أُضيف ${result.addedSubs} حساباً و ${result.addedMoves} حركة. تُرك ${result.skippedMoves} لأنها موجودة مسبقاً.`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر الاستعادة");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-1">
      <Button variant="secondary" className="min-h-11 shrink-0 px-3 text-xs sm:text-sm" disabled={busy} onClick={() => void download()}>
        <Download className="size-4" />
        <span className="hidden sm:inline">{busy ? "جاري التجهيز…" : "نسخ احتياطي"}</span>
        <span className="sm:hidden">{busy ? "…" : "نسخ"}</span>
      </Button>
      {isManager ? (
        <>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => onPick(e.target.files?.[0])} />
          <Button variant="secondary" className="min-h-11 shrink-0 px-3 text-xs sm:text-sm" disabled={busy} onClick={() => fileRef.current?.click()}>
            <Upload className="size-4" />
            <span className="hidden sm:inline">استعادة</span>
          </Button>
        </>
      ) : null}

      {confirmOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-end p-0 sm:place-items-center sm:p-4">
          <button
            type="button"
            className="absolute inset-0 bg-ink/40"
            aria-label="إغلاق"
            onClick={() => {
              if (!busy) {
                setConfirmOpen(false);
                setPendingFile(null);
              }
            }}
          />
          <div className="relative w-full max-w-md rounded-t-xl bg-surface p-5 shadow-[var(--shadow-card)] sm:rounded-xl">
            <h2 className="text-base font-semibold">استعادة البيانات</h2>
            <p className="mt-3 text-sm text-ink">
              الاستعادة تضيف الأسماء والحركات الناقصة من الملف، ولا تحذف ولا تستبدل أي شيء موجود في المحفظة.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button disabled={busy} onClick={() => void confirmRestore()}>
                {busy ? "جاري الاستعادة…" : "تأكيد الاستعادة"}
              </Button>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => {
                  setConfirmOpen(false);
                  setPendingFile(null);
                }}
              >
                إلغاء
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

type BackupFile = {
  format?: string;
  version?: number;
  subscribers?: { id?: number; section?: string; name?: string }[];
  movements?: {
    subscriberId?: number | null;
    subscriberName?: string;
    book?: string;
    kind?: string;
    amount?: number;
    note?: string;
    actorName?: string;
    createdAt?: string;
  }[];
};
