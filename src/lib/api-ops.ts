import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { ForbiddenError, num, requireMember } from "@/lib/server/member";

export const listOps = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const me = await requireMember(context.userId);
    const sql = await getSql();
    const moves = await sql<{
      id: number; kind: string; amount: string | number; note: string;
      actor_user_id: string; actor_name: string; edited_by_name: string | null;
      created_at: string; updated_at: string;
    }>`
      select id, kind, amount, note, actor_user_id, actor_name, edited_by_name, created_at, updated_at
      from movements where wallet_id = ${me.walletId} and book = 'ops' order by created_at desc
    `;
    let expenses = 0;
    let salaries = 0;
    const movements = moves.map((m) => {
      const amount = num(m.amount);
      if (m.kind === "expense") expenses += amount;
      if (m.kind === "salary") salaries += amount;
      return {
        id: m.id, kind: m.kind as "expense" | "salary", amount, note: m.note,
        actorUserId: m.actor_user_id, actorName: m.actor_name, editedByName: m.edited_by_name,
        createdAt: m.created_at, updatedAt: m.updated_at,
      };
    });
    return { expenses, salaries, movements };
  });

export const addOpsMovement = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { kind: "expense" | "salary"; amount: number; note: string }) => input)
  .handler(async ({ context, data }) => {
    const me = await requireMember(context.userId);
    if (!(data.amount > 0)) throw new Error("المبلغ يجب أن يكون أكبر من صفر");
    const sql = await getSql();
    await sql`
      insert into movements (wallet_id, subscriber_id, book, kind, amount, note, actor_user_id, actor_name)
      values (${me.walletId}, null, 'ops', ${data.kind}, ${data.amount}, ${data.note.trim()}, ${me.userId}, ${me.displayName})
    `;
    return { ok: true };
  });

export const updateMovement = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: number; amount: number; note: string }) => input)
  .handler(async ({ context, data }) => {
    const me = await requireMember(context.userId);
    if (!(data.amount > 0)) throw new Error("المبلغ يجب أن يكون أكبر من صفر");
    const sql = await getSql();
    const rows = await sql<{ id: number; book: string }>`
      select id, book from movements where id = ${data.id} and wallet_id = ${me.walletId}
    `;
    const row = rows[0];
    if (!row) throw new ForbiddenError("الحركة غير موجودة");
    if (row.book === "agents" && me.role !== "manager") {
      throw new ForbiddenError("هذه الصفحة للمدير فقط");
    }
    await sql`
      update movements
      set amount = ${data.amount}, note = ${data.note.trim()}, edited_by_name = ${me.displayName}, updated_at = now()
      where id = ${data.id} and wallet_id = ${me.walletId}
    `;
    return { ok: true };
  });
