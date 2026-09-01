const UNLOCK_KEY = "general-wallet.unlocked";

export function readWalletUnlocked(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(UNLOCK_KEY) === "1";
  } catch {
    return false;
  }
}

export function markWalletUnlocked(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(UNLOCK_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function clearWalletUnlock(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(UNLOCK_KEY);
  } catch {
    /* ignore */
  }
}
