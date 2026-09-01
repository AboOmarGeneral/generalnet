import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { ForbiddenError, num, requireMember } from "@/lib/server/member";

export const getDashboard = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const me = await requireMember(context.userId);
    const sql = await getSql();
    const cards = await sql<{ total: string | number }>`
      select coalesce(sum(case
        when kind = 'debt_add' then amount
        when kind = 'debt_pay' then -amount
        when kind = 'account_delete' then -amount
        else 0 end), 0) as total
      from movements where wallet_id = ${me.walletId} and book = 'cards'
    `;
    const home = await sql<{ total: string | number }>`
      select coalesce(sum(case
        when kind = 'debt_add' then amount
        when kind = 'debt_pay' then -amount
        when kind = 'account_delete' then -amount
        else 0 end), 0) as total
      from movements where wallet_id = ${me.walletId} and book = 'home'
    `;
    const opsMonth = await sql<{ expenses: string | number; salaries: string | number }>`
      select
        coalesce(sum(case when kind = 'expense' then amount else 0 end), 0) as expenses,
        coalesce(sum(case when kind = 'salary' then amount else 0 end), 0) as salaries
      from movements
      where wallet_id = ${me.walletId} and book = 'ops' and created_at >= date_trunc('month', now())
    `;
    const collectedMonth = await sql<{ total: string | number }>`
      select coalesce(sum(amount), 0) as total
      from movements
      where wallet_id = ${me.walletId} and kind = 'debt_pay' and created_at >= date_trunc('month', now())
    `;
    const agentsMonth = await sql<{ incoming: string | number; expenses: string | number }>`
      select
        coalesce(sum(case when kind = 'agent_in' then amount else 0 end), 0) as incoming,
        coalesce(sum(case when kind = 'agent_out' then amount else 0 end), 0) as expenses
      from movements
      where wallet_id = ${me.walletId} and book = 'agents' and created_at >= date_trunc('month', now())
    `;
    const recent = await sql<{
      id: number; book: string; kind: string; amount: string | number; note: string;
      actor_name: string; created_at: string; subscriber_name: string | null;
    }>`
      select m.id, m.book, m.kind, m.amount::text as amount, m.note, m.actor_name, m.created_at,
        coalesce(s.name, case when m.kind = 'account_delete' then m.note else null end) as subscriber_name
      from movements m
      left join subscribers s on s.id = m.subscriber_id
      where m.wallet_id = ${me.walletId} and m.book <> 'agents'
      order by m.created_at desc
      limit 8
    `;
    return {
      cardDebt: num(cards[0]?.total),
      homeDebt: num(home[0]?.total),
      monthExpenses: num(opsMonth[0]?.expenses),
      monthSalaries: num(opsMonth[0]?.salaries),
      monthCollected: num(collectedMonth[0]?.total),
      monthAgentIn: num(agentsMonth[0]?.incoming),
      monthAgentOut: num(agentsMonth[0]?.expenses),
      isManager: me.role === "manager",
      recent: recent.map((r) => ({
        id: r.id, book: r.book, kind: r.kind, amount: num(r.amount), note: r.note,
        actorName: r.actor_name, createdAt: r.created_at, subscriberName: r.subscriber_name ?? "",
      })),
    };
  });

export type MovementDto = {
  id: number; subscriberId: number | null; book: string; kind: string; amount: number;
  note: string; actorUserId: string; actorName: string; editedByName: string | null;
  createdAt: string; updatedAt: string;
};

export const listDebtBook = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((section: "cards" | "home") => section)
  .handler(async ({ context, data: section }) => {
    const me = await requireMember(context.userId);
    const sql = await getSql();
    const subs = await sql<{ id: number; name: string; created_at: string; balance: string | number }>`
      select s.id, s.name, s.created_at,
        coalesce(sum(case when m.kind = 'debt_add' then m.amount when m.kind = 'debt_pay' then -m.amount else 0 end), 0) as balance
      from subscribers s
      left join movements m on m.subscriber_id = s.id
      where s.wallet_id = ${me.walletId} and s.section = ${section}
      group by s.id
      order by balance desc, s.name
    `;
    const moves = await sql<{
      id: number; subscriber_id: number | null; book: string; kind: string; amount: string | number;
      note: string; actor_user_id: string; actor_name: string; edited_by_name: string | null;
      created_at: string; updated_at: string;
    }>`
      select id, subscriber_id, book, kind, amount, note, actor_user_id, actor_name, edited_by_name, created_at, updated_at
      from movements where wallet_id = ${me.walletId} and book = ${section} order by created_at desc
    `;
    const movements: MovementDto[] = moves.map((m) => ({
      id: m.id, subscriberId: m.subscriber_id, book: m.book, kind: m.kind, amount: num(m.amount),
      note: m.note, actorUserId: m.actor_user_id, actorName: m.actor_name, editedByName: m.edited_by_name,
      createdAt: m.created_at, updatedAt: m.updated_at,
    }));
    return {
      total: subs.reduce((s, r) => s + num(r.balance), 0),
      subscribers: subs.map((s) => ({ id: s.id, name: s.name, createdAt: s.created_at, balance: num(s.balance) })),
      movements,
    };
  });

export const addSubscriber = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { section: "cards" | "home"; name: string }) => input)
  .handler(async ({ context, data }) => {
    const me = await requireMember(context.userId);
    const name = data.name.trim();
    if (!name) throw new Error("اسم المشترك مطلوب");
    const sql = await getSql();
    const rows = await sql<{ id: number }>`
      insert into subscribers (wallet_id, section, name) values (${me.walletId}, ${data.section}, ${name}) returning id
    `;
    return { id: rows[0]!.id };
  });

export const renameSubscriber = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: number; name: string }) => input)
  .handler(async ({ context, data }) => {
    const me = await requireMember(context.userId);
    const name = data.name.trim();
    if (!name) throw new Error("اسم المشترك مطلوب");
    const sql = await getSql();
    await sql`update subscribers set name = ${name}, updated_at = now() where id = ${data.id} and wallet_id = ${me.walletId} and section in ('cards', 'home')`;
    return { ok: true };
  });

export const deleteSubscriber = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: number }) => input)
  .handler(async ({ context, data }) => {
    const me = await requireMember(context.userId);
    const sql = await getSql();
    const found = await sql<{ id: number; name: string; section: string; balance: string | number }>`
      select s.id, s.name, s.section,
        coalesce(sum(case when m.kind = 'debt_add' then m.amount when m.kind = 'debt_pay' then -m.amount else 0 end), 0) as balance
      from subscribers s left join movements m on m.subscriber_id = s.id
      where s.id = ${data.id} and s.wallet_id = ${me.walletId} and s.section in ('cards', 'home')
      group by s.id
    `;
    const row = found[0];
    if (!row) throw new ForbiddenError("المشترك غير موجود");
    const writtenOff = Math.max(0, num(row.balance));
    await sql`
      insert into movements (wallet_id, subscriber_id, book, kind, amount, note, actor_user_id, actor_name)
      values (${me.walletId}, ${row.id}, ${row.section}, 'account_delete', ${writtenOff}, ${row.name}, ${me.userId}, ${me.displayName})
    `;
    await sql`delete from subscribers where id = ${row.id} and wallet_id = ${me.walletId}`;
    return { ok: true };
  });

export const addDebtMovement = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { subscriberId: number; section: "cards" | "home"; kind: "debt_add" | "debt_pay"; amount: number; note: string }) => input)
  .handler(async ({ context, data }) => {
    const me = await requireMember(context.userId);
    if (!(data.amount > 0)) throw new Error("المبلغ يجب أن يكون أكبر من صفر");
    const sql = await getSql();
    const owned = await sql<{ id: number }>`
      select id from subscribers where id = ${data.subscriberId} and wallet_id = ${me.walletId} and section = ${data.section}
    `;
    if (!owned[0]) throw new ForbiddenError("المشترك غير موجود");
    await sql`
      insert into movements (wallet_id, subscriber_id, book, kind, amount, note, actor_user_id, actor_name)
      values (${me.walletId}, ${data.subscriberId}, ${data.section}, ${data.kind}, ${data.amount}, ${data.note.trim()}, ${me.userId}, ${me.displayName})
    `;
    return { ok: true };
  });
