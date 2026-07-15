import { describe, expect, it, vi } from "vitest";
import { logger } from "@/lib/observability/logger";

describe("logger — guard-rail contro segreti/corpo email nei log (CLAUDE.md invariante 7)", () => {
  it("lancia se si tenta di loggare bodyText", () => {
    expect(() => logger.info("email processata", { bodyText: "contenuto email" })).toThrow();
  });

  it("lancia se si tenta di loggare un token", () => {
    expect(() => logger.error("errore auth", { token: "segreto" })).toThrow();
  });

  it("non lancia per metadati innocui e scrive una riga JSON valida", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    expect(() => logger.info("job.succeeded", { jobId: "abc", attempts: 1 })).not.toThrow();
    expect(spy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    expect(parsed.message).toBe("job.succeeded");
    expect(parsed.jobId).toBe("abc");
    spy.mockRestore();
  });
});
