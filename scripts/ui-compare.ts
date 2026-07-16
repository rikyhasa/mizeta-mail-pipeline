import "dotenv/config";
import { spawn, type ChildProcess } from "node:child_process";
import net from "node:net";
import path from "node:path";
import fs from "node:fs";
import { chromium, type Browser, type BrowserContext } from "playwright";
import { prisma } from "../src/lib/db/prisma";

/**
 * FASE 8B (FASE-8B-DETTAGLIO-PARITY.md): cattura screenshot del dettaglio pratica sul target
 * e sulla reference (.reference/mizeta-flow) per un confronto visivo reale, non solo
 * strutturale. Strumento di sola verifica: non tocca l'app, non scrive nel DB oltre al login
 * di sessione. Non usa MAI la porta 3000 (demo in uso in ufficio).
 *
 * Uso: npm run ui:compare -- --iter 1
 */

const REPO_ROOT = path.resolve(__dirname, "..");
const REFERENCE_ROOT = path.join(REPO_ROOT, ".reference/mizeta-flow");
const FORBIDDEN_PORT = 3000;

const TARGET_PORT = Number(process.env.UI_COMPARE_TARGET_PORT ?? 4100);
const REFERENCE_PORT = Number(process.env.UI_COMPARE_REFERENCE_PORT ?? 4200);

const VIEWPORTS = [
  { name: "1440x900", width: 1440, height: 900 },
  { name: "1920x1080", width: 1920, height: 1080 },
] as const;

const TARGET_LOGIN = {
  email: "admin@mizeta.local",
  password: process.env.SEED_DEMO_PASSWORD ?? "Password123!",
};
const REFERENCE_LOGIN = {
  email: process.env.DEMO_ADMIN_EMAIL ?? "admin@demo.invalid",
  password: process.env.DEMO_ADMIN_PASSWORD ?? "Demo-Mizeta-2026!",
};

function parseIterArg(): string {
  const idx = process.argv.indexOf("--iter");
  if (idx === -1 || !process.argv[idx + 1]) return "latest";
  return process.argv[idx + 1];
}

async function assertPortFree(port: number): Promise<void> {
  if (port === FORBIDDEN_PORT) {
    throw new Error(`La porta ${FORBIDDEN_PORT} è vietata: è una demo in uso in ufficio.`);
  }
  const busy = await new Promise<boolean>((resolve) => {
    const socket = net.createConnection({ port, host: "127.0.0.1" });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => {
      socket.destroy();
      resolve(false);
    });
  });
  if (busy) {
    throw new Error(`La porta ${port} è già occupata. Libera la porta o imposta una porta diversa via env.`);
  }
}

async function waitForServer(url: string, timeoutMs = 90_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.status < 500) return;
    } catch {
      // server non ancora pronto
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Timeout in attesa di ${url}`);
}

function spawnDevServer(cwd: string, port: number): ChildProcess {
  const child = spawn("npm", ["run", "dev", "--", "-p", String(port)], {
    cwd,
    env: process.env,
    stdio: "pipe",
    detached: true,
  });
  child.stdout?.on("data", () => {});
  child.stderr?.on("data", () => {});
  return child;
}

function killServer(child: ChildProcess | null): void {
  if (!child || child.pid == null) return;
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    try {
      child.kill("SIGTERM");
    } catch {
      // già terminato
    }
  }
}

async function ensureReferenceDeps(): Promise<void> {
  if (fs.existsSync(path.join(REFERENCE_ROOT, "node_modules"))) return;
  console.log("[ui-compare] Installo le dipendenze della reference (prima esecuzione)...");
  await new Promise<void>((resolve, reject) => {
    const install = spawn("npm", ["install"], { cwd: REFERENCE_ROOT, stdio: "inherit" });
    install.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`npm install nella reference fallito (codice ${code})`))));
  });
}

async function login(
  context: BrowserContext,
  baseUrl: string,
  creds: { email: string; password: string },
): Promise<void> {
  const page = await context.newPage();
  await page.goto(`${baseUrl}/login`);
  await page.fill("#email", creds.email);
  await page.fill("#password", creds.password);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15_000 }),
    page.click('button[type="submit"]'),
  ]);
  await page.close();
}

async function capture(
  context: BrowserContext,
  baseUrl: string,
  casePath: string,
  label: string,
  outDir: string,
): Promise<void> {
  const page = await context.newPage();
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto(`${baseUrl}${casePath}`, { waitUntil: "networkidle" });
    await page.screenshot({ path: path.join(outDir, `${label}-${vp.name}-fold.png`) });
    await page.screenshot({ path: path.join(outDir, `${label}-${vp.name}-full.png`), fullPage: true });
  }
  await page.close();
}

/** Stesso tipo di pratica su entrambe le app: categoria FINE_OR_PENALTY. Sulla reference è
 * l'elemento a indice 6 (0-based) di seeds in mock-data.ts -> id deterministico "case-007". */
async function findTargetFineCaseId(): Promise<string> {
  const found = await prisma.case.findFirst({
    where: { category: "FINE_OR_PENALTY" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!found) throw new Error("Nessuna pratica FINE_OR_PENALTY trovata nel seed del target.");
  return found.id;
}

async function main(): Promise<void> {
  const iter = parseIterArg();
  const outDir = path.join(REPO_ROOT, "docs/screenshots", `iter-${iter}`);
  fs.mkdirSync(outDir, { recursive: true });

  await assertPortFree(TARGET_PORT);
  await assertPortFree(REFERENCE_PORT);
  await ensureReferenceDeps();

  let targetServer: ChildProcess | null = null;
  let referenceServer: ChildProcess | null = null;
  let browser: Browser | null = null;

  try {
    const targetCaseId = await findTargetFineCaseId();

    console.log(`[ui-compare] Avvio target su :${TARGET_PORT}...`);
    targetServer = spawnDevServer(REPO_ROOT, TARGET_PORT);
    await waitForServer(`http://localhost:${TARGET_PORT}/login`);

    console.log(`[ui-compare] Avvio reference su :${REFERENCE_PORT}...`);
    referenceServer = spawnDevServer(REFERENCE_ROOT, REFERENCE_PORT);
    await waitForServer(`http://localhost:${REFERENCE_PORT}/login`);

    browser = await chromium.launch();
    const targetContext = await browser.newContext();
    const referenceContext = await browser.newContext();

    console.log("[ui-compare] Login target...");
    await login(targetContext, `http://localhost:${TARGET_PORT}`, TARGET_LOGIN);
    console.log("[ui-compare] Login reference...");
    await login(referenceContext, `http://localhost:${REFERENCE_PORT}`, REFERENCE_LOGIN);

    console.log("[ui-compare] Cattura target...");
    await capture(targetContext, `http://localhost:${TARGET_PORT}`, `/pratiche/${targetCaseId}`, "target", outDir);
    console.log("[ui-compare] Cattura reference...");
    await capture(referenceContext, `http://localhost:${REFERENCE_PORT}`, "/pratiche/case-007", "reference", outDir);

    console.log(`[ui-compare] Fatto. Screenshot in ${outDir}`);
  } finally {
    if (browser) await browser.close().catch(() => {});
    killServer(targetServer);
    killServer(referenceServer);
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[ui-compare] Errore:", err);
  process.exitCode = 1;
});
