import net from "net";
import type { Request, Response, NextFunction } from "express";

/**
 * IP real do visitante. O site fica atrás do Cloudflare → Traefik, então `req.ip` (trust proxy 1)
 * é o IP do servidor do Cloudflare — e todo limite "por IP" virava limite por servidor do Cloudflare.
 * O Cloudflare manda o IP do visitante em `CF-Connecting-IP`; só confiamos nele quando o pedido
 * veio MESMO de um IP do Cloudflare (senão qualquer um forjaria o cabeçalho batendo direto no VPS).
 * Faixas oficiais: https://www.cloudflare.com/ips/
 */
const CLOUDFLARE = new net.BlockList();
for (const c of [
  "173.245.48.0/20", "103.21.244.0/22", "103.22.200.0/22", "103.31.4.0/22", "141.101.64.0/18",
  "108.162.192.0/18", "190.93.240.0/20", "188.114.96.0/20", "197.234.240.0/22", "198.41.128.0/17",
  "162.158.0.0/15", "104.16.0.0/13", "104.24.0.0/14", "172.64.0.0/13", "131.0.72.0/22",
]) {
  const [ip, bits] = c.split("/");
  CLOUDFLARE.addSubnet(ip, Number(bits), "ipv4");
}
for (const c of ["2400:cb00::/32", "2606:4700::/32", "2803:f800::/32", "2405:b500::/32", "2405:8100::/32", "2a06:98c0::/29", "2c0f:f248::/32"]) {
  const [ip, bits] = c.split("/");
  CLOUDFLARE.addSubnet(ip, Number(bits), "ipv6");
}

const semPrefixo = (ip: string) => (ip.startsWith("::ffff:") ? ip.slice(7) : ip);

export function isCloudflareIp(ip: string): boolean {
  const v = semPrefixo(ip || "");
  const tipo = net.isIP(v);
  return tipo === 4 ? CLOUDFLARE.check(v, "ipv4") : tipo === 6 ? CLOUDFLARE.check(v, "ipv6") : false;
}

/** Middleware: troca `req.ip` pelo IP do visitante quando o pedido vem do Cloudflare. */
export function realClientIp(req: Request, _res: Response, next: NextFunction) {
  const proxy = req.ip || "";
  const cf = String(req.headers["cf-connecting-ip"] || "").trim();
  if (cf && net.isIP(cf) && isCloudflareIp(proxy)) {
    Object.defineProperty(req, "ip", { value: cf, configurable: true, enumerable: true });
  }
  next();
}
