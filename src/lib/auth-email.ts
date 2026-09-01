export const AUTH_EMAIL_DOMAIN = "shabaka.net";

export function usernameToEmail(username: string): string {
  const raw = username.trim().toLowerCase();
  if (raw.includes("@")) return raw;
  return `${raw}@${AUTH_EMAIL_DOMAIN}`;
}

export function emailToUsername(email: string | null | undefined): string {
  if (!email) return "";
  const lower = email.toLowerCase();
  const suffix = `@${AUTH_EMAIL_DOMAIN}`;
  if (lower.endsWith(suffix)) return lower.slice(0, -suffix.length);
  return email;
}

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}
