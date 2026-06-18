import { Response } from "express";
import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";

/**
 * Armazenamento de objetos em FILESYSTEM LOCAL (volume persistente do Railway).
 *
 * Substitui o Object Storage do Replit (que dependia do sidecar 127.0.0.1:1106,
 * inexistente fora do Replit). Os uploads são gravados sob OBJECT_STORAGE_DIR e
 * servidos pela rota GET /objects/:path. Mantém a MESMA interface pública usada
 * pelo restante do app (uploadBuffer / getObjectBuffer / getObjectEntityFile /
 * downloadObject / normalizeObjectEntityPath / canAccessObjectEntity) e o mesmo
 * esquema de URL `/objects/<subpasta>/<id>`.
 */

const STORAGE_DIR = process.env.OBJECT_STORAGE_DIR || path.join(process.cwd(), "objects-data");

const MIME_BY_EXT: Record<string, string> = {
  webp: "image/webp",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  svg: "image/svg+xml",
  avif: "image/avif",
  ico: "image/x-icon",
  mp4: "video/mp4",
  webm: "video/webm",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  pdf: "application/pdf",
  json: "application/json",
  txt: "text/plain; charset=utf-8",
};

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

/** Representa um objeto local resolvido. */
export interface LocalObjectFile {
  localPath: string;
  objectPath: string;
}

/**
 * Resolve com segurança um caminho `/objects/...` (ou `subpasta/arquivo`) para um
 * caminho absoluto DENTRO de STORAGE_DIR, bloqueando path traversal.
 */
function resolveObjectPath(objectPath: string): string {
  const rel = String(objectPath)
    .replace(/^https?:\/\/[^/]+/i, "")
    .replace(/^\/?objects\//i, "")
    .replace(/^\/+/, "");
  const base = path.resolve(STORAGE_DIR);
  const resolved = path.resolve(base, rel);
  if (resolved !== base && !resolved.startsWith(base + path.sep)) {
    throw new ObjectNotFoundError();
  }
  return resolved;
}

export class ObjectStorageService {
  constructor() {}

  /** Grava um buffer e devolve a URL pública `/objects/<subfolder>/<id>.<ext>`. */
  async uploadBuffer(
    buffer: Buffer,
    subfolder: string = "products",
    _contentType: string = "image/webp",
    extension: string = "webp",
  ): Promise<string> {
    const safeSub = String(subfolder).replace(/[^a-zA-Z0-9_-]/g, "") || "uploads";
    const objectId = `${randomUUID()}-${Date.now()}.${extension.replace(/[^a-zA-Z0-9]/g, "")}`;
    const dest = path.join(STORAGE_DIR, safeSub, objectId);
    await fs.promises.mkdir(path.dirname(dest), { recursive: true });
    await fs.promises.writeFile(dest, buffer);
    return `/objects/${safeSub}/${objectId}`;
  }

  /** Lê o buffer de um objeto a partir de seu caminho `/objects/...`. */
  async getObjectBuffer(objectPath: string): Promise<Buffer | null> {
    try {
      return await fs.promises.readFile(resolveObjectPath(objectPath));
    } catch {
      return null;
    }
  }

  /** Resolve um objeto a partir do path da requisição (`/objects/...`). */
  async getObjectEntityFile(objectPath: string): Promise<LocalObjectFile> {
    const localPath = resolveObjectPath(objectPath);
    try {
      const stat = await fs.promises.stat(localPath);
      if (!stat.isFile()) throw new ObjectNotFoundError();
    } catch {
      throw new ObjectNotFoundError();
    }
    return { localPath, objectPath };
  }

  /** Faz streaming do objeto local para a resposta com o MIME correto. */
  async downloadObject(file: LocalObjectFile, res: Response, cacheTtlSec: number = 86400): Promise<void> {
    try {
      const ext = path.extname(file.localPath).slice(1).toLowerCase();
      const mime = MIME_BY_EXT[ext] || "application/octet-stream";
      const stat = await fs.promises.stat(file.localPath);
      res.set({
        "Content-Type": mime,
        "Content-Length": String(stat.size),
        "Cache-Control": `public, max-age=${cacheTtlSec}`,
      });
      const stream = fs.createReadStream(file.localPath);
      stream.on("error", (err) => {
        console.error("Stream error:", err);
        if (!res.headersSent) res.status(500).json({ error: "Error streaming file" });
      });
      stream.pipe(res);
    } catch (error) {
      console.error("Error downloading file:", error);
      if (!res.headersSent) res.status(500).json({ error: "Error downloading file" });
    }
  }

  /** Normaliza qualquer URL antiga (GCS/host) para o formato `/objects/...`. */
  normalizeObjectEntityPath(rawPath: string): string {
    if (!rawPath) return rawPath;
    if (rawPath.startsWith("/objects/")) return rawPath;
    const m = rawPath.match(/\/objects\/.+$/);
    return m ? m[0] : rawPath;
  }

  /** No storage local todos os objetos são públicos (sem ACL do GCS). */
  async canAccessObjectEntity(_opts?: { userId?: string; objectFile?: any; requestedPermission?: any }): Promise<boolean> {
    return true;
  }

  /** Compat: ACL no-op (não há metadados de GCS no filesystem). */
  async trySetObjectEntityAclPolicy(rawPath: string, _aclPolicy: any): Promise<string> {
    return this.normalizeObjectEntityPath(rawPath);
  }

  /** Diretório base do storage (para diagnóstico). */
  getStorageDir(): string {
    return STORAGE_DIR;
  }
}
