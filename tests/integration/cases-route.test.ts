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
const { GET } = await import("@/app/api/cases/route");

describe("GET /api/cases", () => {
  beforeEach(() => {
    cookieStore.clear();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("returns 401 when no session cookie is present", async () => {
    const response = await GET();
    expect(response.status).toBe(401);
  });

  it("returns the seeded cases for an authenticated user", async () => {
    const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } });
    await createSession(admin.id);

    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body.cases)).toBe(true);
    expect(body.cases.length).toBeGreaterThan(0);
  });
});
