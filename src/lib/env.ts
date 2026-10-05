import { z } from "zod";

import { LEGAL_VECTOR_DIMENSIONS } from "@/lib/db/schema/vector";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  BETTER_AUTH_SECRET: z
    .string()
    .min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
  BETTER_AUTH_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900_000),
  AUTH_RATE_LIMIT_MAX_ATTEMPTS: z.coerce.number().int().positive().default(10),
  EMAIL_PROVIDER: z.enum(["console", "resend"]).default("console"),
  EMAIL_FROM: z.string().min(3).default("Lawyer Workbench <onboarding@localhost>"),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_VERIFICATION_EXPIRES_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(24 * 60 * 60 * 1000),
  EMAIL_RESEND_RATE_LIMIT_WINDOW_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(15 * 60 * 1000),
  EMAIL_RESEND_RATE_LIMIT_MAX_ATTEMPTS: z.coerce
    .number()
    .int()
    .positive()
    .default(3),

  // Object storage
  STORAGE_PROVIDER: z.enum(["local", "s3"]).default("local"),
  LOCAL_STORAGE_PATH: z.string().default(".data/storage"),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default("us-east-1"),
  S3_BUCKET: z.string().default("lawyer-workbench"),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_FORCE_PATH_STYLE: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),

  // Documents
  DOCUMENT_MAX_UPLOAD_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(20 * 1024 * 1024),
  DOCUMENT_AI_PROVIDER: z.enum(["mock", "google"]).default("mock"),
  GCP_PROJECT_ID: z.string().optional(),
  GCP_LOCATION: z.string().default("us"),
  GCP_DOCUMENT_AI_PROCESSOR_ID: z.string().optional(),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),

  // Chat + LLM
  LLM_PROVIDER: z.enum(["mock", "openai"]).default("mock"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  OPENAI_BASE_URL: z.string().url().default("https://api.openai.com/v1"),
  CHAT_RECENT_MESSAGE_LIMIT: z.coerce.number().int().positive().default(20),
  CHAT_MAX_MESSAGE_CHARS: z.coerce.number().int().positive().default(8_000),
  CHAT_RATE_LIMIT_WINDOW_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(60_000),
  CHAT_RATE_LIMIT_MAX_ATTEMPTS: z.coerce.number().int().positive().default(30),

  // Legal corpus ingestion
  // fixture = deterministic local samples / offline snapshots (default)
  // live = official public-web acquisition (no auth/CAPTCHA/paywall bypass)
  LEGAL_CORPUS_MODE: z.enum(["fixture", "live"]).default("fixture"),
  LEGAL_CORPUS_REQUEST_DELAY_MS: z.coerce
    .number()
    .int()
    .nonnegative()
    .default(1_500),
  LEGAL_CORPUS_REQUEST_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(20_000),
  // Compatible bot UA: identifies the workbench while remaining acceptable for
  // official ASP.NET public form posts (bare non-Mozilla UA is rejected by some portals).
  LEGAL_CORPUS_USER_AGENT: z
    .string()
    .min(3)
    .default(
      "Mozilla/5.0 (compatible; LawyerWorkbenchCorpusBot/0.1; +https://localhost; research; respectful)",
    ),
  LEGAL_CORPUS_ADMIN_TOKEN: z.string().optional(),

  // Legal retrieval (PostgreSQL FTS + pgvector). Dimension must match migration 0008.
  LEGAL_EMBEDDING_PROVIDER: z.enum(["mock", "openai"]).default("mock"),
  LEGAL_EMBEDDING_MODEL: z.string().min(1).optional(),
  LEGAL_EMBEDDING_DIMENSIONS: z.coerce
    .number()
    .int()
    .positive()
    .default(LEGAL_VECTOR_DIMENSIONS),
  LEGAL_EMBEDDING_VERSION: z.string().min(1).default("1"),
  LEGAL_RETRIEVAL_TOP_K: z.coerce.number().int().positive().max(50).default(10),
  LEGAL_KEYWORD_WEIGHT: z.coerce.number().nonnegative().default(0.45),
  LEGAL_VECTOR_WEIGHT: z.coerce.number().nonnegative().default(0.55),
  LEGAL_EXACT_REFERENCE_BOOST: z.coerce.number().nonnegative().default(3),
  LEGAL_DOCUMENT_MATCH_BOOST: z.coerce.number().nonnegative().default(0.5),
  LEGAL_PHRASE_BOOST: z.coerce.number().nonnegative().default(1),
  LEGAL_EVIDENCE_MIN_SCORE: z.coerce.number().nonnegative().default(0.2),
  LEGAL_VECTOR_MIN_SIMILARITY: z.coerce.number().min(0).max(1).default(0.12),
  LEGAL_CHUNK_MAX_CHARS: z.coerce.number().int().positive().default(4_000),

  // Web research (Phase 10). CORPUS mode never requires these.
  // App default is Brave. mock is test-only (enforced in the provider factory).
  WEB_SEARCH_PROVIDER: z.enum(["mock", "brave"]).default("brave"),
  BRAVE_SEARCH_API_KEY: z.string().optional(),
  WEB_SEARCH_MAX_RESULTS: z.coerce.number().int().positive().max(20).default(8),
  WEB_SEARCH_FETCH_CANDIDATES: z.coerce.number().int().positive().max(10).default(4),
  WEB_FETCH_TIMEOUT_MS: z.coerce.number().int().positive().default(12_000),
  WEB_FETCH_MAX_BYTES: z.coerce.number().int().positive().default(1_500_000),
  WEB_FETCH_MAX_REDIRECTS: z.coerce.number().int().nonnegative().max(5).default(3),
  WEB_AUTHORITY_PRIMARY_OFFICIAL: z.coerce.number().min(0).max(1).default(1),
  WEB_AUTHORITY_OFFICIAL_COURT: z.coerce.number().min(0).max(1).default(0.95),
  WEB_AUTHORITY_OFFICIAL_GOVERNMENT: z.coerce.number().min(0).max(1).default(0.9),
  WEB_AUTHORITY_OFFICIAL_PARLIAMENT: z.coerce.number().min(0).max(1).default(0.9),
  WEB_AUTHORITY_SECONDARY_LEGAL: z.coerce.number().min(0).max(1).default(0.7),
  WEB_AUTHORITY_ACADEMIC: z.coerce.number().min(0).max(1).default(0.6),
  WEB_AUTHORITY_GENERAL_WEB: z.coerce.number().min(0).max(1).default(0.3),
  WEB_AUTHORITY_SEARCH_RESULT: z.coerce.number().min(0).max(1).default(0.15),

  // AI agents (Phase 4). Hard limits prevent unbounded loops.
  // Multi-agent workflows (document→research→review→draft→review) need headroom.
  AGENT_MAX_STEPS: z.coerce.number().int().positive().max(80).default(40),
  AGENT_MAX_TOOL_CALLS: z.coerce.number().int().positive().max(60).default(30),
  AGENT_MAX_RETRIES: z.coerce.number().int().nonnegative().max(5).default(1),
  AGENT_MAX_EXECUTION_MS: z.coerce
    .number()
    .int()
    .positive()
    .max(300_000)
    .default(120_000),
  AGENT_RATE_LIMIT_WINDOW_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(60_000),
  AGENT_RATE_LIMIT_MAX_ATTEMPTS: z.coerce
    .number()
    .int()
    .positive()
    .default(20),
});

export type AppEnv = z.infer<typeof envSchema>;

let cached: AppEnv | null = null;

export function getEnv(): AppEnv {
  if (cached) {
    return cached;
  }

  const parsed = envSchema.safeParse({
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    AUTH_RATE_LIMIT_WINDOW_MS: process.env.AUTH_RATE_LIMIT_WINDOW_MS,
    AUTH_RATE_LIMIT_MAX_ATTEMPTS: process.env.AUTH_RATE_LIMIT_MAX_ATTEMPTS,
    EMAIL_PROVIDER: process.env.EMAIL_PROVIDER,
    EMAIL_FROM: process.env.EMAIL_FROM,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_VERIFICATION_EXPIRES_MS: process.env.EMAIL_VERIFICATION_EXPIRES_MS,
    EMAIL_RESEND_RATE_LIMIT_WINDOW_MS:
      process.env.EMAIL_RESEND_RATE_LIMIT_WINDOW_MS,
    EMAIL_RESEND_RATE_LIMIT_MAX_ATTEMPTS:
      process.env.EMAIL_RESEND_RATE_LIMIT_MAX_ATTEMPTS,
    STORAGE_PROVIDER: process.env.STORAGE_PROVIDER,
    LOCAL_STORAGE_PATH: process.env.LOCAL_STORAGE_PATH,
    S3_ENDPOINT: process.env.S3_ENDPOINT,
    S3_REGION: process.env.S3_REGION,
    S3_BUCKET: process.env.S3_BUCKET,
    S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID,
    S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY,
    S3_FORCE_PATH_STYLE: process.env.S3_FORCE_PATH_STYLE,
    DOCUMENT_MAX_UPLOAD_BYTES: process.env.DOCUMENT_MAX_UPLOAD_BYTES,
    DOCUMENT_AI_PROVIDER: process.env.DOCUMENT_AI_PROVIDER,
    GCP_PROJECT_ID: process.env.GCP_PROJECT_ID,
    GCP_LOCATION: process.env.GCP_LOCATION,
    GCP_DOCUMENT_AI_PROCESSOR_ID: process.env.GCP_DOCUMENT_AI_PROCESSOR_ID,
    GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    LLM_PROVIDER: process.env.LLM_PROVIDER,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_MODEL: process.env.OPENAI_MODEL,
    OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
    CHAT_RECENT_MESSAGE_LIMIT: process.env.CHAT_RECENT_MESSAGE_LIMIT,
    CHAT_MAX_MESSAGE_CHARS: process.env.CHAT_MAX_MESSAGE_CHARS,
    CHAT_RATE_LIMIT_WINDOW_MS: process.env.CHAT_RATE_LIMIT_WINDOW_MS,
    CHAT_RATE_LIMIT_MAX_ATTEMPTS: process.env.CHAT_RATE_LIMIT_MAX_ATTEMPTS,
    LEGAL_CORPUS_MODE: process.env.LEGAL_CORPUS_MODE,
    LEGAL_CORPUS_REQUEST_DELAY_MS: process.env.LEGAL_CORPUS_REQUEST_DELAY_MS,
    LEGAL_CORPUS_REQUEST_TIMEOUT_MS: process.env.LEGAL_CORPUS_REQUEST_TIMEOUT_MS,
    LEGAL_CORPUS_USER_AGENT: process.env.LEGAL_CORPUS_USER_AGENT,
    LEGAL_CORPUS_ADMIN_TOKEN: process.env.LEGAL_CORPUS_ADMIN_TOKEN,
    LEGAL_EMBEDDING_PROVIDER: process.env.LEGAL_EMBEDDING_PROVIDER,
    LEGAL_EMBEDDING_MODEL: process.env.LEGAL_EMBEDDING_MODEL,
    LEGAL_EMBEDDING_DIMENSIONS: process.env.LEGAL_EMBEDDING_DIMENSIONS,
    LEGAL_EMBEDDING_VERSION: process.env.LEGAL_EMBEDDING_VERSION,
    LEGAL_RETRIEVAL_TOP_K: process.env.LEGAL_RETRIEVAL_TOP_K,
    LEGAL_KEYWORD_WEIGHT: process.env.LEGAL_KEYWORD_WEIGHT,
    LEGAL_VECTOR_WEIGHT: process.env.LEGAL_VECTOR_WEIGHT,
    LEGAL_EXACT_REFERENCE_BOOST: process.env.LEGAL_EXACT_REFERENCE_BOOST,
    LEGAL_DOCUMENT_MATCH_BOOST: process.env.LEGAL_DOCUMENT_MATCH_BOOST,
    LEGAL_PHRASE_BOOST: process.env.LEGAL_PHRASE_BOOST,
    LEGAL_EVIDENCE_MIN_SCORE: process.env.LEGAL_EVIDENCE_MIN_SCORE,
    LEGAL_VECTOR_MIN_SIMILARITY: process.env.LEGAL_VECTOR_MIN_SIMILARITY,
    LEGAL_CHUNK_MAX_CHARS: process.env.LEGAL_CHUNK_MAX_CHARS,
    WEB_SEARCH_PROVIDER: process.env.WEB_SEARCH_PROVIDER,
    BRAVE_SEARCH_API_KEY: process.env.BRAVE_SEARCH_API_KEY,
    WEB_SEARCH_MAX_RESULTS: process.env.WEB_SEARCH_MAX_RESULTS,
    WEB_SEARCH_FETCH_CANDIDATES: process.env.WEB_SEARCH_FETCH_CANDIDATES,
    WEB_FETCH_TIMEOUT_MS: process.env.WEB_FETCH_TIMEOUT_MS,
    WEB_FETCH_MAX_BYTES: process.env.WEB_FETCH_MAX_BYTES,
    WEB_FETCH_MAX_REDIRECTS: process.env.WEB_FETCH_MAX_REDIRECTS,
    WEB_AUTHORITY_PRIMARY_OFFICIAL: process.env.WEB_AUTHORITY_PRIMARY_OFFICIAL,
    WEB_AUTHORITY_OFFICIAL_COURT: process.env.WEB_AUTHORITY_OFFICIAL_COURT,
    WEB_AUTHORITY_OFFICIAL_GOVERNMENT: process.env.WEB_AUTHORITY_OFFICIAL_GOVERNMENT,
    WEB_AUTHORITY_OFFICIAL_PARLIAMENT: process.env.WEB_AUTHORITY_OFFICIAL_PARLIAMENT,
    WEB_AUTHORITY_SECONDARY_LEGAL: process.env.WEB_AUTHORITY_SECONDARY_LEGAL,
    WEB_AUTHORITY_ACADEMIC: process.env.WEB_AUTHORITY_ACADEMIC,
    WEB_AUTHORITY_GENERAL_WEB: process.env.WEB_AUTHORITY_GENERAL_WEB,
    WEB_AUTHORITY_SEARCH_RESULT: process.env.WEB_AUTHORITY_SEARCH_RESULT,
    AGENT_MAX_STEPS: process.env.AGENT_MAX_STEPS,
    AGENT_MAX_TOOL_CALLS: process.env.AGENT_MAX_TOOL_CALLS,
    AGENT_MAX_RETRIES: process.env.AGENT_MAX_RETRIES,
    AGENT_MAX_EXECUTION_MS: process.env.AGENT_MAX_EXECUTION_MS,
    AGENT_RATE_LIMIT_WINDOW_MS: process.env.AGENT_RATE_LIMIT_WINDOW_MS,
    AGENT_RATE_LIMIT_MAX_ATTEMPTS: process.env.AGENT_RATE_LIMIT_MAX_ATTEMPTS,
  });

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration: ${details}`);
  }

  if (parsed.data.EMAIL_PROVIDER === "resend" && !parsed.data.RESEND_API_KEY) {
    throw new Error(
      "Invalid environment configuration: RESEND_API_KEY is required when EMAIL_PROVIDER=resend",
    );
  }

  if (parsed.data.STORAGE_PROVIDER === "s3") {
    if (
      !parsed.data.S3_ENDPOINT ||
      !parsed.data.S3_ACCESS_KEY_ID ||
      !parsed.data.S3_SECRET_ACCESS_KEY
    ) {
      throw new Error(
        "Invalid environment configuration: S3_ENDPOINT, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY are required when STORAGE_PROVIDER=s3",
      );
    }
  }

  if (parsed.data.DOCUMENT_AI_PROVIDER === "google") {
    if (
      !parsed.data.GCP_PROJECT_ID ||
      !parsed.data.GCP_DOCUMENT_AI_PROCESSOR_ID
    ) {
      throw new Error(
        "Invalid environment configuration: GCP_PROJECT_ID and GCP_DOCUMENT_AI_PROCESSOR_ID are required when DOCUMENT_AI_PROVIDER=google",
      );
    }
  }

  if (parsed.data.LLM_PROVIDER === "openai" && !parsed.data.OPENAI_API_KEY) {
    throw new Error(
      "Invalid environment configuration: OPENAI_API_KEY is required when LLM_PROVIDER=openai",
    );
  }

  if (parsed.data.LEGAL_EMBEDDING_DIMENSIONS !== LEGAL_VECTOR_DIMENSIONS) {
    throw new Error(
      `Invalid environment configuration: LEGAL_EMBEDDING_DIMENSIONS must be ${LEGAL_VECTOR_DIMENSIONS} to match the pgvector column in migration 0008`,
    );
  }

  if (
    parsed.data.LEGAL_EMBEDDING_PROVIDER === "openai" &&
    !parsed.data.OPENAI_API_KEY
  ) {
    throw new Error(
      "Invalid environment configuration: OPENAI_API_KEY is required when LEGAL_EMBEDDING_PROVIDER=openai",
    );
  }

  // Missing BRAVE_SEARCH_API_KEY does not block app boot (CORPUS still works).
  // WEB/BOTH modes fail at request time via isWebSearchConfigured().

  if (
    parsed.data.WEB_SEARCH_PROVIDER === "mock" &&
    parsed.data.NODE_ENV !== "test"
  ) {
    throw new Error(
      "Invalid environment configuration: WEB_SEARCH_PROVIDER=mock is only allowed when NODE_ENV=test",
    );
  }

  cached = parsed.data;
  return cached;
}

export function resetEnvCacheForTests() {
  cached = null;
}
