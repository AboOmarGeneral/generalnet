import { getSql } from "@/lib/db";
import { parseAmount } from "@/lib/money";

export type MemberRole = "manager" | "accountant";

export type MemberRow = {
  id: number;
  walletId: number;
  userId: string;
  role: MemberRole;
  displayName: string;
  username: string;
};

export class ForbiddenError extends Error {
  readonly status = 403;
  constructor(message = "لا صلاحية لهذه العملية") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export async function requireMember(userId: string): Promise<MemberRow> {
  const sql = await getSql();
  const rows = await sql<{ id: number; wallet_id: number; user_id: string; role: MemberRole; display_name: string; username: string; }>`
    select id, wallet_id, user_id, role, display_name, username
    from wallet_members
    where user_id = ${userId}
    limit 1
  `;
  const row = rows[0];
  if (!row) throw new ForbiddenError("هذا الحساب غير مرتبط بالمحفظة");
  return { id: row.id, walletId: row.wallet_id, userId: row.user_id, role: row.role, displayName: row.display_name, username: row.username };
}

export async function requireManager(userId: string): Promise<MemberRow> {
  const member = await requireMember(userId);
  if (member.role !== "manager") throw new ForbiddenError("هذه الصفحة للمدير فقط");
  return member;
}

export async function managerExists(): Promise<boolean> {
  const sql = await getSql();
  const rows = await sql<{ n: number }>`select count(*)::int as n from wallet_members where role = 'manager'`;
  return (rows[0]?.n ?? 0) > 0;
}

export function num(value: unknown): number {
  return parseAmount(value);
}
