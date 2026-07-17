import { env } from "@/lib/config/env";
import type { SpeedRegistryFetcher } from "@/lib/adapters/speed-registry/types";
import { MockSpeedRegistryFetcher } from "@/lib/adapters/speed-registry/mock-fetcher";
import { RealSpeedRegistryFetcher } from "@/lib/adapters/speed-registry/real-fetcher";

/** Factory basata su `env.SPEED_REGISTRY_FETCHER`, stesso pattern di `mail-provider-factory.ts`/`llm-provider-factory.ts`. */
export function getSpeedRegistryFetcher(): SpeedRegistryFetcher {
  switch (env.SPEED_REGISTRY_FETCHER) {
    case "mock":
      return new MockSpeedRegistryFetcher();
    case "real":
      return new RealSpeedRegistryFetcher();
    default: {
      const exhaustiveCheck: never = env.SPEED_REGISTRY_FETCHER;
      throw new Error(`SPEED_REGISTRY_FETCHER non riconosciuto: ${String(exhaustiveCheck)}`);
    }
  }
}

let cachedFetcher: SpeedRegistryFetcher | null = null;

export function getCachedSpeedRegistryFetcher(): SpeedRegistryFetcher {
  if (!cachedFetcher) cachedFetcher = getSpeedRegistryFetcher();
  return cachedFetcher;
}

/** Usata dai test per forzare la ricostruzione del fetcher dopo un cambio env. */
export function resetCachedSpeedRegistryFetcher(): void {
  cachedFetcher = null;
}
