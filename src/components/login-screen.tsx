import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { authClient, getBearerToken } from "@/lib/auth/client";
import { usernameToEmail, normalizeUsername } from "@/lib/auth-email";
import { claimManagerSeat } from "@/lib/api";
import { WalletMark } from "@/components/mark";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { markWalletUnlocked } from "@/lib/wallet-session";
import { runPreSignInSignOut } from "../../scripts/sign-out-plan.mjs";

const BEARER_KEY = "grok-auth.bearer-token";

async function persistSessionToken(token: string | null | undefined) {
  if (!token || typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(BEARER_KEY, token);
  } catch {
    /* ignore */
  }
}

async function clearPriorSession() {
  await runPreSignInSignOut({
    livePreview:
      typeof window !== "undefined" &&
      window.location.hostname.endsWith(".grok-sandbox.com"),
    hasBearer: Boolean(getBearerToken()),
    requestSignOut: () => authClient.signOut(),
    clearToken: () => {
      try {
        window.sessionStorage.removeItem(BEARER_KEY);
      } catch {
        /* ignore */
      }
    },
  });
}

function loginErrorMessage(message: string | undefined): string {
  const msg = (message ?? "").toLowerCase();
  if (msg.includes("origin")) return "تعذر التحقق من الجلسة. افتح الرابط المنشور وأعد المحاولة.";
  if (msg.includes("already") || msg.includes("session")) {
    return "كانت هناك جلسة سابقة. أعد إدخال اسم المستخدم وكلمة المرور.";
  }
  return "اسم المستخدم أو كلمة المرور غير صحيحة";
}

export function LoginScreen({
  needsManager,
  signedInUnlinked,
}: {
  needsManager: boolean;
  signedInUnlinked?: boolean;
}) {
  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-4 py-10">
      <div className="w-full max-w-md rounded-xl bg-surface p-6 shadow-[var(--shadow-card)] sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <WalletMark />
          <div>
            <h1 className="text-xl font-semibold">محفظة شبكة الجنرال</h1>
          </div>
        </div>
        {signedInUnlinked ? (
          needsManager ? (
            <ClaimForm />
          ) : (
            <p className="text-sm text-debt">
              هذا الحساب غير مرتبط بالمحفظة. اطلب من مدير الشبكة إنشاء حساب محاسب لك.
            </p>
          )
        ) : needsManager ? (
          <SetupForm />
        ) : (
          <SignInForm />
        )}
      </div>
    </main>
  );
}

function SignInForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <form
      action="#"
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setBusy(true);
        setError(null);
        const user = normalizeUsername(username);
        try {
          await clearPriorSession();
          let result = await authClient.signIn.email({
            email: usernameToEmail(user),
            password,
          });
          if (result.error) {
            await clearPriorSession();
            result = await authClient.signIn.email({
              email: usernameToEmail(user),
              password,
            });
          }
          if (result.error) {
            setBusy(false);
            setError(loginErrorMessage(result.error.message));
            return;
          }
          await persistSessionToken(
            result.data && "token" in result.data
              ? (result.data as { token?: string }).token
              : undefined,
          );
          markWalletUnlocked();
          try {
            await authClient.getSession();
          } catch {
            /* session store recovers */
          }
          window.location.replace("/");
        } catch (ex) {
          setBusy(false);
          setError(ex instanceof Error ? loginErrorMessage(ex.message) : "تعذر الدخول");
        }
      }}
    >
      <div>
        <Label htmlFor="u">اسم المستخدم</Label>
        <Input id="u" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required dir="ltr" className="text-left" />
      </div>
      <div>
        <Label htmlFor="p">كلمة المرور</Label>
        <Input id="p" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required dir="ltr" className="text-left" />
      </div>
      {error ? <p className="text-sm text-debt">{error}</p> : null}
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? "جاري الدخول…" : "دخول المحفظة"}
      </Button>
    </form>
  );
}

function SetupForm() {
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <form
      action="#"
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        if (password.length < 8) {
          setBusy(false);
          setError("كلمة المرور 8 أحرف على الأقل";
          return;
        }
        const { data, error: err } = await authClient.signUp.email({
          email: usernameToEmail(username),
          password,
          name: displayName.trim(),
        });
        if (err) {
          setBusy(false);
          setError(err.message === "User already exists" ? "اسم المستخدم مستخدم" : "تعذر إنشاء الحساب");
          return;
        }
        await persistSessionToken(data && "token" in data ? (data as { token?: string }).token : undefined);
        markWalletUnlocked();
        try {
          await authClient.getSession();
        } catch {
          /* ignore */
        }
        try {
          await claimManagerSeat({ data: { username, displayName: displayName.trim() } });
          window.location.replace("/");
        } catch (ex) {
          setBusy(false);
          setError(ex instanceof Error ? ex.message : "تعذر ربط حساب المدير");
        }
      }}
    >
      <div>
        <Label htmlFor="dn">اسمك الظاهر على الحركات</Label>
        <Input id="dn" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
      </div>
      <div>
        <Label htmlFor="su">اسم المستخدم</Label>
        <Input id="su" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required minLength={3} dir="ltr" className="text-left" />
      </div>
      <div>
        <Label htmlFor="sp">كلمة المرور</Label>
        <Input id="sp" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required minLength={8} dir="ltr" className="text-left" />
      </div>
      {error ? <p className="text-sm text-debt">{error}</p> : null}
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? "جاري الإنشاء…" : "إنشاء حساب المدير"}
      </Button>
    </form>
  );
}

function ClaimForm() {
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const claim = useMutation({
    mutationFn: () => claimManagerSeat({ data: { username, displayName: displayName.trim() } }),
    onSuccess: () => {
      markWalletUnlocked();
      window.location.replace("/");
    },
  });

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        claim.mutate();
      }}
    >
      <p className="text-sm text-muted">أكمل بيانات مدير الشبكة لفتح المحفظة.</p>
      <div>
        <Label htmlFor="cdn">الاسم الظاهر</Label>
        <Input id="cdn" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
      </div>
      <div>
        <Label htmlFor="cun">اسم المستخدم</Label>
        <Input id="cun" value={username} onChange={(e) => setUsername(e.target.value)} required dir="ltr" className="text-left" />
      </div>
      {claim.isError ? (
        <p className="text-sm text-debt">{claim.error instanceof Error ? claim.error.message : "تعذر الإكمال"}</p>
      ) : null}
      <Button type="submit" className="w-full" disabled={claim.isPending}>
        فتح المحفظة
      </Button>
    </form>
  );
}
