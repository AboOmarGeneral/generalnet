import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { usernameToEmail, normalizeUsername } from "@/lib/auth-email";
import { getSql } from "@/lib/db";
import {
  ForbiddenError,
  managerExists,
  requireManager,
  requireMember,
  type MemberRole,
} from "@/lib/server/member";

const MAX_ACCOUNTANTS = 4;

export const getSetupState = createServerFn({ method: "GET" }).handler(async () => {
  return { needsManager: !(await managerExists()) };
});

export const getSessionProfile = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql<{
      id: number;
      wallet_id: number;
      role: MemberRole;
      display_name: string;
      username: string;
      wallet_name: string;
    }>`
      select m.id, m.wallet_id, m.role, m.display_name, m.username, w.name as wallet_name
      from wallet_members m
      join wallets w on w.id = m.wallet_id
      where m.user_id = ${context.userId}
      limit 1
    `;
    const row = rows[0];
    if (!row) {
      return {
        linked: false as const,
        needsManager: !(await managerExists()),
        userId: context.userId,
      };
    }
    return {
      linked: true as const,
      needsManager: false,
      userId: context.userId,
      walletId: row.wallet_id,
      walletName: row.wallet_name,
      role: row.role,
      displayName: row.display_name,
      username: row.username,
      isManager: row.role === "manager",
    };
  });

export const claimManagerSeat = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { username: string; displayName: string }) => input)
  .handler(async ({ context, data }) => {
    const username = normalizeUsername(data.username);
    const displayName = data.displayName.trim();
    if (username.length < 3) throw new Error("اسم المستخدم قصير جداً");
    if (!displayName) throw new Error("الاسم الظاهر مطلوب");
    const sql = await getSql();
    if (await managerExists()) {
      throw new ForbiddenError("تم إنشاء حساب المدير مسبقاً");
    }
    const existing = await sql<{ n: number }>`
      select count(*)::int as n from wallet_members where user_id = ${context.userId}
    `;
    if ((existing[0]?.n ?? 0) > 0) return { ok: true };
    const wallets = await sql<{ id: number }>`
      insert into wallets (name, created_by)
      values ('محفظة شبكة الجنرال', ${context.userId})
      returning id
    `;
    const walletId = wallets[0]!.id;
    await sql`
      insert into wallet_members (wallet_id, user_id, role, display_name, username)
      values (${walletId}, ${context.userId}, 'manager', ${displayName}, ${username})
    `;
    return { ok: true };
  });

export const listTeam = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const me = await requireMember(context.userId);
    const sql = await getSql();
    const members = await sql<{
      id: number;
      user_id: string;
      role: MemberRole;
      display_name: string;
      username: string;
      created_at: string;
    }>`
      select id, user_id, role, display_name, username, created_at
      from wallet_members
      where wallet_id = ${me.walletId}
      order by case when role = 'manager' then 0 else 1 end, created_at
    `;
    const accountants = members.filter((m) => m.role === "accountant").length;
    return {
      isManager: me.role === "manager",
      accountants,
      remaining: Math.max(0, MAX_ACCOUNTANTS - accountants),
      members: members.map((m) => ({
        id: m.id,
        userId: m.user_id,
        role: m.role,
        displayName: m.display_name,
        username: m.username,
        createdAt: m.created_at,
        isYou: m.user_id === context.userId,
      })),
    };
  });

export const createAccountant = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { username: string; displayName: string; password: string }) => input)
  .handler(async ({ context, data }) => {
    const me = await requireManager(context.userId);
    const username = normalizeUsername(data.username);
    const displayName = data.displayName.trim();
    const password = data.password;
    if (!/^[a-z0-9_]{3,32}$/.test(username)) {
      throw new Error("اسم المستخدم: أحرف إنجليزية وأرقام وشرطة سفلية فقط، 3–32");
    }
    if (!displayName) throw new Error("الاسم الظاهر مطلوب");
    if (password.length < 8) throw new Error("كلمة المرور 8 أحرف على الأقل");
    const sql = await getSql();
    const countRows = await sql<{ n: number }>`
      select count(*)::int as n from wallet_members
      where wallet_id = ${me.walletId} and role = 'accountant'
    `;
    if ((countRows[0]?.n ?? 0) >= MAX_ACCOUNTANTS) {
      throw new Error(`الحد الأقصى ${MAX_ACCOUNTANTS} محاسبين`);
    }
    const taken = await sql<{ n: number }>`
      select count(*)::int as n from wallet_members
      where wallet_id = ${me.walletId} and username = ${username}
    `;
    if ((taken[0]?.n ?? 0) > 0) throw new Error("اسم المستخدم مستخدم");
    const email = usernameToEmail(username);
    const existingUser = await sql<{ n: number }>`
      select count(*)::int as n from "user" where email = ${email}
    `;
    if ((existingUser[0]?.n ?? 0) > 0) throw new Error("اسم المستخدم مستخدم");
    const { hashPassword } = await import("better-auth/crypto");
    const { randomBytes } = await import("node:crypto");
    const userId = randomBytes(16).toString("hex");
    const accountRowId = randomBytes(16).toString("hex");
    const passwordHash = await hashPassword(password);
    await sql`
      insert into "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
      values (${userId}, ${displayName}, ${email}, false, now(), now())
    `;
    await sql`
      insert into "account" (
        id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt"
      ) values (
        ${accountRowId}, ${userId}, 'credential', ${userId}, ${passwordHash}, now(), now()
      )
    `;
    await sql`
      insert into wallet_members (wallet_id, user_id, role, display_name, username)
      values (${me.walletId}, ${userId}, 'accountant', ${displayName}, ${username})
    `;
    return { ok: true };
  });
