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

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

const { prisma } = await import("@/lib/db/prisma");
const { createSession, destroySession } = await import("@/lib/auth/session");
const { requireUser, requireRole } = await import("@/lib/auth/guard");

describe("auth guard", () => {
  beforeEach(() => {
    cookieStore.clear();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("requireUser rejects with 401 when no session cookie is present", async () => {
    await expect(requireUser()).rejects.toMatchObject({ status: 401 });
  });

  it("requireUser resolves the user for a valid session", async () => {
    const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } });
    await createSession(admin.id);
    const user = await requireUser();
    expect(user.id).toBe(admin.id);
  });

  it("requireRole rejects with 403 when the user's role is not allowed", async () => {
    const readOnly = await prisma.user.findFirstOrThrow({ where: { role: "READ_ONLY" } });
    await createSession(readOnly.id);
    await expect(requireRole(["ADMIN"])).rejects.toMatchObject({ status: 403 });
  });

  it("requireRole resolves the user when the role is allowed", async () => {
    const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } });
    await createSession(admin.id);
    const user = await requireRole(["ADMIN"]);
    expect(user.role).toBe("ADMIN");
  });

  it("destroySession revokes the session so requireUser rejects again", async () => {
    const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } });
    await createSession(admin.id);
    await expect(requireUser()).resolves.toBeTruthy();
    await destroySession();
    await expect(requireUser()).rejects.toMatchObject({ status: 401 });
  });
});
