import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const cookieStore = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (cookieStore.has(name) ? { name, value: cookieStore.get(name)! } : undefined),
    set: (name: string, value: string) => {
      cookieStore.set(name, value);
    },
    delete: (name: string) => {
      cookieStore.delete(name);
    },
    has: (name: string) => cookieStore.has(name),
  }),
}));

const { prisma } = await import("@/lib/db/prisma");
const { createSession } = await import("@/lib/auth/session");
const { invalidateRuleSettingsCache, updateRuleSettings } = await import("@/lib/rules/settings-repository");
const { DEFAULT_RULE_SETTINGS } = await import("@/lib/rules/default-settings");
const { PATCH: patchRules } = await import("@/app/api/settings/rules/route");
const { POST: postUser } = await import("@/app/api/settings/users/route");
const { PATCH: patchUser } = await import("@/app/api/settings/users/[id]/route");
const { POST: postTemplate } = await import("@/app/api/settings/reply-templates/route");
const { PATCH: patchTemplate } = await import("@/app/api/settings/reply-templates/[id]/route");

function request(method: string, body?: unknown) {
  return new Request("http://localhost/test", {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

describe("Impostazioni API routes (SPEC.md §16, minimo privilegio §14)", () => {
  let adminId: string;
  let operationsId: string;
  const createdUserIds: string[] = [];

  beforeEach(() => {
    cookieStore.clear();
  });

  afterAll(async () => {
    invalidateRuleSettingsCache();
    const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
    await updateRuleSettings(DEFAULT_RULE_SETTINGS, admin?.id ?? "");
    if (createdUserIds.length > 0) {
      await prisma.auditLog.deleteMany({ where: { entityId: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await prisma.$disconnect();
  });

  it("PATCH /api/settings/rules rejects a non-ADMIN user", async () => {
    const operations = await prisma.user.findFirstOrThrow({ where: { role: "OPERATIONS" } });
    operationsId = operations.id;
    await createSession(operationsId);
    const response = await patchRules(request("PATCH", { claimAmountHighThreshold: 5000 }));
    expect(response.status).toBe(403);
  });

  it("PATCH /api/settings/rules updates a threshold as ADMIN", async () => {
    const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } });
    adminId = admin.id;
    await createSession(adminId);
    const response = await patchRules(request("PATCH", { claimAmountHighThreshold: 4321 }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.settings.claimAmountHighThreshold).toBe(4321);
  });

  it("POST /api/settings/users rejects a non-ADMIN user", async () => {
    await createSession(operationsId);
    const response = await postUser(
      request("POST", { email: `nope-${Date.now()}@mizeta.local`, name: "Nope", role: "OPERATIONS", password: "Password123!" }),
    );
    expect(response.status).toBe(403);
  });

  it("POST /api/settings/users creates a user without leaking the password hash", async () => {
    await createSession(adminId);
    const email = `nuovo-${Date.now()}@mizeta.local`;
    const response = await postUser(request("POST", { email, name: "Nuovo Utente", role: "OPERATIONS", password: "Password123!" }));
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.user.email).toBe(email);
    expect(body.user).not.toHaveProperty("passwordHash");
    createdUserIds.push(body.user.id);

    const audit = await prisma.auditLog.findFirst({ where: { action: "ADMIN_ACTION", entityId: body.user.id }, orderBy: { createdAt: "desc" } });
    expect(audit).toBeTruthy();
  });

  it("POST /api/settings/users rejects a duplicate email", async () => {
    await createSession(adminId);
    const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } });
    const response = await postUser(request("POST", { email: admin.email, name: "Duplicato", role: "OPERATIONS", password: "Password123!" }));
    expect(response.status).toBe(409);
  });

  it("PATCH /api/settings/users/[id] toggles active and changes role", async () => {
    await createSession(adminId);
    const created = await postUser(
      request("POST", { email: `toggle-${Date.now()}@mizeta.local`, name: "Toggle", role: "OPERATIONS", password: "Password123!" }),
    );
    const { user } = await created.json();
    createdUserIds.push(user.id);

    const response = await patchUser(request("PATCH", { active: false, role: "ACCOUNTING" }), { params: Promise.resolve({ id: user.id }) });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.user.active).toBe(false);
    expect(body.user.role).toBe("ACCOUNTING");
  });

  it("POST /api/settings/reply-templates creates a template and PATCH toggles isActive", async () => {
    await createSession(adminId);
    const created = await postTemplate(
      request("POST", { category: "QUOTE_REQUEST", name: "Modello di test", subject: "Oggetto {{customer_name}}", bodyText: "Corpo {{customer_name}}" }),
    );
    expect(created.status).toBe(201);
    const { template } = await created.json();
    expect(template.isActive).toBe(true);

    const response = await patchTemplate(request("PATCH", { isActive: false }), { params: Promise.resolve({ id: template.id }) });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.template.isActive).toBe(false);
  });
});
