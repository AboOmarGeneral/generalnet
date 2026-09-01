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
