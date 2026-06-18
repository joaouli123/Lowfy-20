import { logger } from "./logger";

/**
 * Envolve um callback de cron com proteção contra sobreposição (reentrância).
 *
 * node-cron dispara o próximo tick mesmo se a execução anterior ainda não
 * terminou. Para jobs longos (ex.: recovery de checkout a cada 5 min), isso
 * causa execuções concorrentes, dobrando carga no banco e podendo reenviar
 * mensagens. Este wrapper ignora o novo tick enquanto o anterior está rodando.
 */
export function exclusive(name: string, fn: () => Promise<void>): () => Promise<void> {
  let running = false;
  return async () => {
    if (running) {
      logger.warn(`[Cron] "${name}" ainda em execução — tick ignorado para evitar sobreposição.`);
      return;
    }
    running = true;
    try {
      await fn();
    } catch (err) {
      logger.error(`[Cron] "${name}" falhou:`, err);
    } finally {
      running = false;
    }
  };
}
