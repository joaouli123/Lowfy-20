import { db, pool } from "../db";
import { logger } from "../utils/logger";

type RequestLike = any;
type RequestHandlerLike = (req: RequestLike, res: any, next: any) => Promise<any> | any;

type KeyMode = "ip" | "user" | "user-or-ip";

export interface DistributedRateLimitOptions {
  name: string;
  windowMs: number;
  max: number;
  message: string;
  keyMode?: KeyMode;
  keyGenerator?: (req: RequestLike) => string;
  onBlocked?: (req: RequestLike) => void;
}

let initialized = false;
let initPromise: Promise<void> | null = null;

async function initStore(): Promise<void> {
  if (initialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS rate_limit_hits (
        limiter_name TEXT NOT NULL,
        limiter_key TEXT NOT NULL,
        bucket_start_ms BIGINT NOT NULL,
        count INTEGER NOT NULL DEFAULT 0,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (limiter_name, limiter_key, bucket_start_ms)
      )
    `);

    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_rate_limit_hits_updated_at
      ON rate_limit_hits (updated_at)
    `);

    initialized = true;
    logger.info("[RateLimit] Distributed rate limit store initialized");
  })();

  try {
    await initPromise;
  } finally {
    initPromise = null;
  }
}

function resolveKey(req: RequestLike, options: DistributedRateLimitOptions): string {
  if (options.keyGenerator) {
    return options.keyGenerator(req);
  }

  const userId = (req as any).user?.id as string | undefined;
  const ip = req.ip || req.socket.remoteAddress || "unknown";

  switch (options.keyMode ?? "user-or-ip") {
    case "user":
      return `u:${userId || "anonymous"}`;
    case "ip":
      return `ip:${ip}`;
    case "user-or-ip":
    default:
      return userId ? `u:${userId}` : `ip:${ip}`;
  }
}

async function hitCounter(options: DistributedRateLimitOptions, limiterKey: string, bucketStartMs: number): Promise<number> {
  const result = await pool.query<{ count: number }>(`
    INSERT INTO rate_limit_hits (limiter_name, limiter_key, bucket_start_ms, count, updated_at)
    VALUES ($1, $2, $3, 1, NOW())
    ON CONFLICT (limiter_name, limiter_key, bucket_start_ms)
    DO UPDATE SET
      count = rate_limit_hits.count + 1,
      updated_at = NOW()
    RETURNING count
  `, [options.name, limiterKey, bucketStartMs]);

  return Number(result.rows[0]?.count ?? 0);
}

function maybeCleanupOldRows(): void {
  if (Math.random() > 0.01) return;

  db.execute(`
    DELETE FROM rate_limit_hits
    WHERE updated_at < NOW() - INTERVAL '2 days'
  `).catch((error: any) => {
    logger.warn("[RateLimit] Cleanup failed:", error);
  });
}

export function createDistributedRateLimiter(options: DistributedRateLimitOptions): RequestHandlerLike {
  return async (req, res, next) => {
    try {
      await initStore();

      const now = Date.now();
      const bucketStartMs = Math.floor(now / options.windowMs) * options.windowMs;
      const resetAtMs = bucketStartMs + options.windowMs;
      const limiterKey = resolveKey(req, options);

      const currentCount = await hitCounter(options, limiterKey, bucketStartMs);
      maybeCleanupOldRows();

      const remaining = Math.max(0, options.max - currentCount);
      res.setHeader("X-RateLimit-Limit", String(options.max));
      res.setHeader("X-RateLimit-Remaining", String(remaining));
      res.setHeader("X-RateLimit-Reset", String(Math.ceil(resetAtMs / 1000)));

      if (currentCount > options.max) {
        if (options.onBlocked) {
          options.onBlocked(req);
        }

        return res.status(429).json({
          message: options.message,
        });
      }

      return next();
    } catch (error) {
      logger.error("[RateLimit] Middleware failure, allowing request:", error);
      return next();
    }
  };
}
