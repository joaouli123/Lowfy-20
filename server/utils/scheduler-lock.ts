import { pool } from "../db";
import { logger } from "./logger";

const LOCK_KEY_1 = 4242;
const LOCK_KEY_2 = 20260302;

let lockClient: Awaited<ReturnType<typeof pool.connect>> | null = null;

export async function acquireSchedulerLeadership(): Promise<boolean> {
  if (lockClient) {
    return true;
  }

  const client = await pool.connect();

  try {
    const result = await client.query<{ locked: boolean }>(
      "SELECT pg_try_advisory_lock($1, $2) AS locked",
      [LOCK_KEY_1, LOCK_KEY_2],
    );

    const locked = result.rows[0]?.locked === true;
    if (!locked) {
      client.release();
      return false;
    }

    lockClient = client;
    logger.info("[Schedulers] Advisory lock acquired");

    const releaseLock = async () => {
      if (!lockClient) return;

      try {
        await lockClient.query("SELECT pg_advisory_unlock($1, $2)", [LOCK_KEY_1, LOCK_KEY_2]);
      } catch (error) {
        logger.error("[Schedulers] Failed to release advisory lock:", error);
      } finally {
        lockClient.release();
        lockClient = null;
      }
    };

    process.once("SIGINT", () => {
      void releaseLock();
    });

    process.once("SIGTERM", () => {
      void releaseLock();
    });

    return true;
  } catch (error) {
    client.release();
    logger.error("[Schedulers] Failed to acquire advisory lock:", error);
    return false;
  }
}
