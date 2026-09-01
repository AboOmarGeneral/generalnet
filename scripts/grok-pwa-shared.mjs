import { readFileSync } from "node:fs";
import { join } from "node:path";

export const DEFAULT_APP_NAME = "محفظة شبكة الجنرال";
export const OG_SITE_REL_PATH = "src/lib/og/site.json";
export const GROK_EXTENSIONS_SCRIPT_SRC =
  "https://grok.com/grok-app-builder/extensions.js";

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function appNameFromHost() {
  return DEFAULT_APP_NAME;
}

export function publicAppHost(hostHeader) {
  return String(hostHeader ?? "localhost").split(",")[0].trim();
}

export function resolvePublicHost(hostHeader) {
  return publicAppHost(hostHeader);
}

export function isInstallQuery(url) {
  try {
    const q = new URL(url ?? "/", "http://local").searchParams;
    return q.get("install") === "1";
  } catch {
    return false;
  }
}

export function isDocumentPath(pathname) {
  const p = pathname ?? "/";
  if (p.startsWith("/api/") || p.startsWith("/__grok/")) return false;
  return !/\.\w{2,5}$/.test(p) || p.endsWith(".html");
}

export function acceptsHtml(accept) {
  return String(accept ?? "").includes("text/html");
}

export function stripInstallParams(url) {
  return url ?? "/";
}

export function renderInstallPageHtml(template, context = {}) {
  return String(template ?? "")
    .replaceAll("{{host}}", escapeHtml(context.host ?? ""))
    .replaceAll("{{url}}", escapeHtml(context.url ?? "/"));
}

export function renderWebManifest(hostHeader) {
  const name = DEFAULT_APP_NAME;
  return JSON.stringify({
    name,
    short_name: name,
    start_url: "/",
    display: "standalone",
    background_color: "#f3efe4",
    theme_color: "#1A4D44",
    id: `https://${publicAppHost(hostHeader)}/`,
  });
}

export function grokPwaHeadTags(appName = DEFAULT_APP_NAME) {
  return [
    ["meta", `name="application-name" content="${escapeHtml(appName)}"`],
  ];
}

export function readGrokProjectId() {
  return process.env.GROK_PROJECT_ID ?? "";
}

export function readXCreator() {
  return "";
}

export function readXCreatorId() {
  return "";
}

export function grokXCreatorHeadTags() {
  return [];
}

export function grokExtensionsHeadTags() {
  return [`<script src="${GROK_EXTENSIONS_SCRIPT_SRC}" defer></script>`];
}

export function readOgSite(cwd = process.cwd()) {
  try {
    return JSON.parse(readFileSync(join(cwd, OG_SITE_REL_PATH), "utf8"));
  } catch {
    return { title: DEFAULT_APP_NAME, color: "1A4D44" };
  }
}

export function snapshotOgIdentity(cwd) {
  return { site: readOgSite(cwd) };
}

export function ogCardPublicPath() {
  return "/og.jpg";
}

export function customOgAssetPath() {
  return "";
}

export function resolveOgCardAsset() {
  return "/og.jpg";
}

export function ogServiceUrl() {
  return "";
}

export function titleFromDocument() {
  return DEFAULT_APP_NAME;
}

export function resolveOgTitle(site, appName) {
  return site?.title || appName || DEFAULT_APP_NAME;
}

export function siteHasCustomCard() {
  return false;
}

export function grokOgHeadTags(ctx = {}) {
  const title = resolveOgTitle(ctx.site, ctx.appName);
  return [
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    `<meta name="theme-color" content="#${escapeHtml(ctx.site?.color ?? "1A4D44")}">`,
  ];
}

export function stripShareMetaTags(html) {
  return html;
}

export function normalizeHeadContext(ctx = {}) {
  return {
    appName: ctx.appName || DEFAULT_APP_NAME,
    projectId: ctx.projectId || readGrokProjectId(),
    creator: ctx.creator || "",
    creatorId: ctx.creatorId || "",
    host: ctx.host || "",
    cwd: ctx.cwd || process.cwd(),
    site: ctx.site || readOgSite(ctx.cwd),
  };
}

export function injectGrokPwaHead(html, ctx = {}) {
  const tags = [
    ...grokOgHeadTags(normalizeHeadContext(ctx)),
    ...grokExtensionsHeadTags(),
  ].join("");
  if (!html.includes("</head>")) return html + tags;
  return html.replace("</head>", `${tags}</head>`);
}

export function createHeadInjector(ctx = {}) {
  let buf = "";
  let done = false;
  return {
    push(chunk) {
      if (done) return [typeof chunk === "string" ? Buffer.from(chunk) : chunk];
      buf += Buffer.from(chunk).toString("utf8");
      if (buf.includes("</head>")) {
        done = true;
        const injected = injectGrokPwaHead(buf, ctx);
        buf = "";
        return [Buffer.from(injected)];
      }
      return [];
    },
    flush() {
      if (!buf) return [];
      const out = done ? buf : injectGrokPwaHead(buf, ctx);
      buf = "";
      return [Buffer.from(out)];
    },
  };
}
