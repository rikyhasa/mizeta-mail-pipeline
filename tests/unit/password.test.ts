import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

describe("password", () => {
  it("hashes and verifies a password roundtrip", async () => {
    const hash = await hashPassword("Password123!");
    expect(hash).not.toBe("Password123!");
    await expect(verifyPassword("Password123!", hash)).resolves.toBe(true);
    await expect(verifyPassword("wrong-password", hash)).resolves.toBe(false);
  });
});
