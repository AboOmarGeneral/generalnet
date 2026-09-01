import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { ForbiddenError, num, requireManager, type MemberRole } from "@/lib/server/member";

function asMonthRange(month: string): { start: string; end: string } {
  const m = /^(\d{4})-(\d{2})$/.exec(month.trim());
  if (!m) throw new Error("شهر غير صالح");
  const year = Number(m[1]);
  const mon = Number(m[2]);
  const start = `${m[1]}-${m[2]}-01`;
  const endMon = mon === 12 ? 1 : mon + 1;
  const endYear = mon === 12 ? year + 1 : year;
  const end = `${endYear}-${String(endMon).padStart(2, "0")}-01`;
  return { start, end };
}

export const getLedger = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((month: string) => month)
  .handler(async ({ context, data: month }) => {
    const me = await requireManager(context.userId);
    const { start, end } = asMonthRange(month);
    const sql = await getSql();
    const members = await sql<{ user_id: string; role: MemberRole; display_name: string; username: string }>`
      select user_id, role, display_name, username from wallet_members
      where wallet_id = ${me.walletId}
      order by case when role = 'manager' then 0 else 1 end, display_name
    `;
    const agentRows = await sql<{ id: number; name: string }>`
      select id, name from subscribers where wallet_id = ${me.walletId} and section = 'agents' order by name
    `;
    const moves = await sql<{
      id: number; subscriber_id: number | null; book: string; kind: string; amount: string | number;
      note: string; actor_user_id: string; actor_name: string; created_at: string; subscriber_name: string | null;
    }>`
      select m.id, m.subscriber_id, m.book, m.kind, m.amount::text as amount, m.note,
             m.actor_user_id, m.actor_name, m.created_at,
             coalesce(s.name, case when m.kind = 'account_delete' then m.note else null end) as subscriber_name
      from movements m left join subscribers s on s.id = m.subscriber_id
      where m.wallet_id = ${me.walletId} and m.created_at >= ${start}::date and m.created_at < ${end}::date
      order by m.created_at desc
    `;
    const byUser = new Map<string, { collected: number; added: number; writtenOff: number; expenses: number; salary: number; movements: { id: number; book: string; kind: string; amount: number; note: string; actorName: string; createdAt: string; subscriberName: string }[] }>();
    for (const mem of members) byUser.set(mem.user_id, { collected: 0, added: 0, writtenOff: 0, expenses: 0, salary: 0, movements: [] });
    type AgentBucket = { incoming: number; expenses: number; movements: { id: number; kind: string; amount: number; note: string; createdAt: string }[] };
    const byAgent = new Map<number, AgentBucket>();
    for (const a of agentRows) byAgent.set(a.id, { incoming: 0, expenses: 0, movements: [] });
    let monthIn = 0;
    let monthOut = 0;
    for (const m of moves) {
      const amount = num(m.amount);
      if (m.kind === "agent_in" || m.kind === "agent_out") {
        const key = m.subscriber_id ?? -1;
        const bucket = byAgent.get(key) ?? { incoming: 0, expenses: 0, movements: [] };
        if (m.kind === "agent_in") { bucket.incoming += amount; monthIn += amount; }
        else { bucket.expenses += amount; monthOut += amount; }
        bucket.movements.push({ id: m.id, kind: m.kind, amount, note: m.note, createdAt: m.created_at });
        byAgent.set(key, bucket);
        continue;
      }
      const bucket = byUser.get(m.actor_user_id) ?? { collected: 0, added: 0, writtenOff: 0, expenses: 0, salary: 0, movements: [] };
      if (m.kind === "debt_pay") { bucket.collected += amount; bucket.writtenOff += amount; monthIn += amount; }
      else if (m.kind === "account_delete") bucket.writtenOff += amount;
      else if (m.kind === "debt_add") bucket.added += amount;
      else if (m.kind === "expense") { bucket.expenses += amount; monthOut += amount; }
      else if (m.kind === "salary") { bucket.salary += amount; monthOut += amount; }
      bucket.movements.push({ id: m.id, book: m.book, kind: m.kind, amount, note: m.note, actorName: m.actor_name, createdAt: m.created_at, subscriberName: m.subscriber_name ?? "" });
      byUser.set(m.actor_user_id, bucket);
    }
    return {
      month, monthIn, monthOut,
      accountants: members.map((mem) => {
        const b = byUser.get(mem.user_id)!;
        return { userId: mem.user_id, role: mem.role, displayName: mem.display_name, username: mem.username, collected: b.collected, added: b.added, writtenOff: b.writtenOff, expenses: b.expenses, salary: b.salary, movements: b.movements };
      }),
      agents: agentRows.map((a) => {
        const b = byAgent.get(a.id)!;
        return { id: a.id, name: a.name, incoming: b.incoming, expenses: b.expenses, movements: b.movements };
      }),
    };
  });

export const listAgents = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const me = await requireManager(context.userId);
    const sql = await getSql();
    const agents = await sql<{ id: number; name: string; created_at: string; incoming: string | number; expenses: string | number }>`
      select s.id, s.name, s.created_at,
        coalesce(sum(case when m.kind = 'agent_in' then m.amount else 0 end), 0) as incoming,
        coalesce(sum(case when m.kind = 'agent_out' then m.amount else 0 end), 0) as expenses
      from subscribers s left join movements m on m.subscriber_id = s.id
      where s.wallet_id = ${me.walletId} and s.section = 'agents'
      group by s.id order by s.name
    `;
    const moves = await sql<{ id: number; subscriber_id: number | null; kind: string; amount: string | number; note: string; actor_name: string; edited_by_name: string | null; created_at: string }>`
      select id, subscriber_id, kind, amount, note, actor_name, edited_by_name, created_at
      from movements where wallet_id = ${me.walletId} and book = 'agents' order by created_at desc
    `;
    return {
      agents: agents.map((a) => ({ id: a.id, name: a.name, createdAt: a.created_at, incoming: num(a.incoming), expenses: num(a.expenses) })),
      movements: moves.map((m) => ({ id: m.id, agentId: m.subscriber_id, kind: m.kind as "agent_in" | "agent_out", amount: num(m.amount), note: m.note, actorName: m.actor_name, editedByName: m.edited_by_name, createdAt: m.created_at })),
    };
  });

export const addAgent = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { name: string }) => input)
  .handler(async ({ context, data }) => {
    const me = await requireManager(context.userId);
    const name = data.name.trim();
    if (!name) throw new Error("اسم المندوب مطلوب");
    const sql = await getSql();
    const rows = await sql<{ id: number }>`insert into subscribers (wallet_id, section, name) values (${me.walletId}, 'agents', ${name}) returning id`;
    return { id: rows[0]!.id };
  });

export const deleteAgent = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: number }) => input)
  .handler(async ({ context, data }) => {
    const me = await requireManager(context.userId);
    const sql = await getSql();
    const rows = await sql<{ id: number }>`delete from subscribers where id = ${data.id} and wallet_id = ${me.walletId} and section = 'agents' returning id`;
    if (!rows[0]) throw new ForbiddenError("المندوب غير موجود");
    return { ok: true };
  });

export const addAgentMovement = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { agentId: number; kind: "agent_in" | "agent_out"; amount: number; note: string }) => input)
  .handler(async ({ context, data }) => {
    const me = await requireManager(context.userId);
    if (!(data.amount > 0)) throw new Error("المبلغ يجب أن يكون أكبر من صفر");
    const sql = await getSql();
    const owned = await sql<{ id: number }>`select id from subscribers where id = ${data.agentId} and wallet_id = ${me.walletId} and section = 'agents'`;
    if (!owned[0]) throw new ForbiddenError("المندوب غير موجود");
    await sql`insert into movements (wallet_id, subscriber_id, book, kind, amount, note, actor_user_id, actor_name) values (${me.walletId}, ${data.agentId}, 'agents', ${data.kind}, ${data.amount}, ${data.note.trim()}, ${me.userId}, ${me.displayName})`;
    return { ok: true };
  });
