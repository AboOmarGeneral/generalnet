import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { requireManager, requireMember, type MemberRole } from "@/lib/server/member";

function moneyText(value: unknown): string {
  const raw = String(value ?? "").trim();
  const m = raw.match(/^(-?\d+)(?:\.(\d+))?$/);
  if (m) return `${m[1]}.${(m[2] ?? "").padEnd(2, "0").slice(0, 2)}`;
  const n = Number(raw);
  if (!Number.isFinite(n)) return "0.00";
  return (Math.round(n * 100) / 100).toFixed(2);
}

export const exportBackup = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const me = await requireMember(context.userId);
    const sql = await getSql();
    const members = await sql<{ display_name: string; username: string; role: MemberRole }>`
      select display_name, username, role from wallet_members
      where wallet_id = ${me.walletId}
      order by case when role = 'manager' then 0 else 1 end, display_name
    `;
    const subs = await sql<{ id: number; section: string; name: string; balance: string | number }>`
      select s.id, s.section, s.name,
        coalesce(sum(case when m.kind = 'debt_add' then m.amount when m.kind = 'debt_pay' then -m.amount else 0 end), 0) as balance
      from subscribers s left join movements m on m.subscriber_id = s.id
      where s.wallet_id = ${me.walletId} group by s.id order by s.section, s.name
    `;
    const moves = await sql<{
      id: number; subscriber_id: number | null; book: string; kind: string; amount: string;
      note: string; actor_name: string; edited_by_name: string | null; created_at: string; subscriber_name: string | null;
    }>`
      select m.id, m.subscriber_id, m.book, m.kind, m.amount::text as amount, m.note, m.actor_name,
             m.edited_by_name, m.created_at::text as created_at,
             coalesce(s.name, case when m.kind = 'account_delete' then m.note else null end) as subscriber_name
      from movements m left join subscribers s on s.id = m.subscriber_id
      where m.wallet_id = ${me.walletId} order by m.created_at asc, m.id asc
    `;
    const isManager = me.role === "manager";
    return {
      format: "general-wallet-backup" as const,
      version: 1 as const,
      walletName: "محفظة شبكة الجنرال",
      exportedAt: new Date().toISOString(),
      exportedBy: me.displayName,
      isManager,
      members: isManager ? members.map((m) => ({ displayName: m.display_name, username: m.username, role: m.role })) : [],
      subscribers: subs.filter((s) => isManager || s.section !== "agents").map((s) => ({ id: s.id, section: s.section, name: s.name, balance: moneyText(s.balance) })),
      movements: moves.filter((m) => isManager || m.book !== "agents").map((m) => ({
        id: m.id, subscriberId: m.subscriber_id, subscriberName: m.subscriber_name ?? "",
        book: m.book, kind: m.kind, amount: moneyText(m.amount), note: m.note,
        actorName: m.actor_name, editedByName: m.edited_by_name, createdAt: m.created_at,
      })),
    };
  });

type BackupPayload = {
  format?: string; version?: number;
  subscribers?: { id?: number; section?: string; name?: string }[];
  movements?: { subscriberId?: number | null; subscriberName?: string; book?: string; kind?: string; amount?: string | number; note?: string; actorName?: string; createdAt?: string }[];
};

function stampKey(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value.slice(0, 19);
  return d.toISOString().slice(0, 19);
}
function moveKey(kind: string, amount: string, book: string, actorName: string, createdAt: string, note: string): string {
  return [kind, amount, book, actorName.trim(), stampKey(createdAt), note.trim()].join("|");
}

export const restoreBackup = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: BackupPayload) => input)
  .handler(async ({ context, data }) => {
    const me = await requireManager(context.userId);
    if (data.format !== "general-wallet-backup" || data.version !== 1) {
      throw new Error("الملف ليس نسخة احتياطية قابلة للاسترداد. استخدم ملف JSON من زر النسخ الاحتياطي بعد هذا التحديث.");
    }
    const sql = await getSql();
    const members = await sql<{ user_id: string; display_name: string }>`select user_id, display_name from wallet_members where wallet_id = ${me.walletId}`;
    const memberByName = new Map(members.map((m) => [m.display_name.trim(), m.user_id]));
    const existingSubs = await sql<{ id: number; section: string; name: string }>`select id, section, name from subscribers where wallet_id = ${me.walletId}`;
    const subKey = (section: string, name: string) => `${section}\0${name.trim()}`;
    const subIds = new Map<string, number>();
    for (const s of existingSubs) subIds.set(subKey(s.section, s.name), s.id);
    const idFromBackup = new Map<number, number>();
    let addedSubs = 0;
    for (const s of data.subscribers ?? []) {
      const section = (s.section ?? "").trim();
      const name = (s.name ?? "").trim();
      if (!name) continue;
      if (section !== "cards" && section !== "home" && section !== "agents") continue;
      const key = subKey(section, name);
      let id = subIds.get(key);
      if (!id) {
        const rows = await sql<{ id: number }>`insert into subscribers (wallet_id, section, name) values (${me.walletId}, ${section}, ${name}) returning id`;
        id = rows[0]!.id;
        subIds.set(key, id);
        addedSubs += 1;
      }
      if (typeof s.id === "number") idFromBackup.set(s.id, id);
    }
    const existingMoves = await sql<{ kind: string; amount: string; book: string; actor_name: string; created_at: string; note: string }>`
      select kind, amount::text as amount, book, actor_name, created_at::text as created_at, note from movements where wallet_id = ${me.walletId}
    `;
    const seen = new Set(existingMoves.map((m) => moveKey(m.kind, moneyText(m.amount), m.book, m.actor_name, m.created_at, m.note)));
    const allowedKind = new Set(["debt_add", "debt_pay", "expense", "salary", "agent_in", "agent_out", "account_delete"]);
    const allowedBook = new Set(["cards", "home", "ops", "agents"]);
    let addedMoves = 0;
    let skippedMoves = 0;
    for (const m of data.movements ?? []) {
      const kind = (m.kind ?? "").trim();
      const book = (m.book ?? "").trim();
      const amount = moneyText(m.amount);
      const note = (m.note ?? "").trim();
      const actorName = (m.actorName ?? "").trim() || me.displayName;
      const createdAt = (m.createdAt ?? "").trim();
      if (!allowedKind.has(kind) || !allowedBook.has(book) || !(Number(amount) >= 0) || !createdAt) { skippedMoves += 1; continue; }
      const key = moveKey(kind, amount, book, actorName, createdAt, note);
      if (seen.has(key)) { skippedMoves += 1; continue; }
      let subscriberId: number | null = null;
      const customer = (m.subscriberName ?? "").trim();
      if (typeof m.subscriberId === "number" && idFromBackup.has(m.subscriberId)) subscriberId = idFromBackup.get(m.subscriberId)!;
      else if (customer && book !== "ops") subscriberId = subIds.get(subKey(book === "agents" ? "agents" : book, customer)) ?? null;
      const actorId = memberByName.get(actorName) ?? me.userId;
      await sql`
        insert into movements (wallet_id, subscriber_id, book, kind, amount, note, actor_user_id, actor_name, created_at, updated_at)
        values (${me.walletId}, ${subscriberId}, ${book}, ${kind}, ${amount}::numeric, ${note}, ${actorId}, ${actorName}, ${createdAt}::timestamptz, ${createdAt}::timestamptz)
      `;
      seen.add(key);
      addedMoves += 1;
    }
    return { addedSubs, addedMoves, skippedMoves };
  });
