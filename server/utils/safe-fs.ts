import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

/**
 * Escreve um arquivo de forma ATÔMICA e assíncrona: grava num arquivo temporário
 * no mesmo diretório e faz rename (operação atômica no mesmo filesystem).
 *
 * Isso evita corrupção de arquivos (ex.: páginas/metadata) se o processo cair ou
 * houver escrita concorrente — um leitor nunca vê um arquivo parcialmente escrito.
 */
export async function writeFileAtomic(filePath: string, content: string): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  const tmpPath = path.join(dir, `.${path.basename(filePath)}.${randomUUID()}.tmp`);
  try {
    await fs.writeFile(tmpPath, content, 'utf-8');
    await fs.rename(tmpPath, filePath);
  } catch (err) {
    // Limpeza best-effort do arquivo temporário em caso de falha
    try { await fs.unlink(tmpPath); } catch {}
    throw err;
  }
}

/**
 * Serializa e escreve JSON de forma atômica.
 */
export async function writeJsonAtomic(filePath: string, data: unknown): Promise<void> {
  await writeFileAtomic(filePath, JSON.stringify(data, null, 2));
}
