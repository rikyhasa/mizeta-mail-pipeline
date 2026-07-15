import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.url().default("http://localhost:3000"),
  SESSION_COOKIE_NAME: z.string().min(1).default("mizeta_session"),
  SESSION_TTL_HOURS: z.coerce.number().positive().default(12),

  DATABASE_URL: z.string().min(1),

  EMAIL_PROVIDER: z.enum(["microsoft365", "pec_imap", "mock"]).default("mock"),
  LLM_PROVIDER: z.enum(["anthropic", "openai", "mock"]).default("mock"),
  ANTHROPIC_API_KEY: z
    .string()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  ANTHROPIC_MODEL: z.string().min(1).default("claude-sonnet-5"),

  MICROSOFT365_CLIENT_ID: z
    .string()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  MICROSOFT365_CLIENT_SECRET: z
    .string()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  MICROSOFT365_TENANT_ID: z
    .string()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  MICROSOFT365_INITIAL_SYNC_LOOKBACK_DAYS: z.coerce.number().positive().default(30),
  MICROSOFT365_INITIAL_SYNC_MAX_MESSAGES: z.coerce.number().positive().default(200),
  MICROSOFT365_SUBSCRIPTION_RENEWAL_MARGIN_HOURS: z.coerce.number().positive().default(24),

  // pec_imap resta uno scheletro documentato in questa fase (SPEC.md §3): queste variabili
  // sono lette solo da env.ts per completezza di configurazione, non usate da alcun codice.
  PEC_IMAP_HOST: z
    .string()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  PEC_IMAP_PORT: z.coerce.number().positive().default(993),
  PEC_IMAP_USER: z
    .string()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  PEC_IMAP_PASSWORD: z
    .string()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),

  JOB_POLL_INTERVAL_MS: z.coerce.number().positive().default(5000),
  JOB_MAX_ATTEMPTS: z.coerce.number().positive().default(6),
  JOB_BACKOFF_BASE_MS: z.coerce.number().positive().default(60000),
  JOB_RECOVERY_INTERVAL_MINUTES: z.coerce.number().positive().default(15),

  ATTACHMENT_STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  ATTACHMENT_STORAGE_LOCAL_DIR: z.string().min(1).default("./storage"),

  SEED_DEMO_PASSWORD: z.string().min(8).default("Password123!"),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      `Invalid environment configuration:\n${parsed.error.issues
        .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
        .join("\n")}`,
    );
  }
  return parsed.data;
}

export const env = loadEnv();
