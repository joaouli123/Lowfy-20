import type { Express } from "express";
import { authMiddleware, fullAccessMiddleware } from "../auth";
import { logger } from "../utils/logger";
import * as hack from "./service";

/** Rotas do Hack Ads (minerador de criativos da Biblioteca de Anúncios da Meta). */
export function registerHackAdsRoutes(app: Express) {
  const guard = [authMiddleware, fullAccessMiddleware];
  const fail = (res: any, e: any, msg: string) => {
    if (!e?.status) logger.error(`[Hack Ads] ${msg}:`, e?.message);
    res.status(e?.status || 500).json({ message: e?.status ? e.message : msg });
  };

  // Minerar: entra na fila e responde na hora; o andamento fica em /jobs/:id.
  app.post("/api/hack-ads/search", ...guard, async (req: any, res) => {
    try { res.json(await hack.startSearch(req.user.id, req.body || {})); }
    catch (e) { fail(res, e, "Erro ao iniciar a busca"); }
  });

  app.get("/api/hack-ads/jobs/:id", authMiddleware, (req: any, res) => {
    const j = hack.jobInfo(req.params.id);
    if (!j || (j.userId && j.userId !== req.user.id)) return res.status(404).json({ message: "Busca não encontrada" });
    res.json({ status: j.status, position: j.position, progress: j.progress, result: j.result, error: j.error, kind: j.kind });
  });

  app.get("/api/hack-ads/searches", ...guard, async (req: any, res) => {
    try { res.json({ searches: await hack.listSearches(req.user.id), fila: hack.filaTamanho() }); }
    catch (e) { fail(res, e, "Erro ao carregar as buscas"); }
  });

  app.get("/api/hack-ads/ads", ...guard, async (req: any, res) => {
    try { res.json(await hack.listAds(req.user.id, req.query || {}, req.query?.modo === "trending" ? "trending" : "library")); }
    catch (e) { fail(res, e, "Erro ao carregar os anúncios"); }
  });

  app.get("/api/hack-ads/ads/:id", ...guard, async (req: any, res) => {
    try {
      const d = await hack.getAd(req.user.id, Number(req.params.id));
      if (!d) return res.status(404).json({ message: "Anúncio não encontrado" });
      res.json(d);
    } catch (e) { fail(res, e, "Erro ao carregar o anúncio"); }
  });

  app.get("/api/hack-ads/facets", ...guard, async (_req, res) => {
    try { res.json(await hack.facets()); }
    catch (e) { fail(res, e, "Erro ao carregar os filtros"); }
  });

  // Mídia: serve a cópia guardada; na 1ª vez baixa do CDN da Meta (os links de lá expiram).
  app.get("/api/hack-ads/media/:id/:kind", authMiddleware, async (req: any, res) => {
    const kind = String(req.params.kind);
    if (!["image", "video", "avatar"].includes(kind)) return res.status(400).end();
    try {
      const local = await hack.mediaLocal(Number(req.params.id), kind as any);
      if (!local) return res.status(404).json({ message: "Mídia indisponível (o link da Meta expirou)" });
      res.set("Cache-Control", "private, max-age=86400");
      res.redirect(302, local);
    } catch (e) { fail(res, e, "Erro ao carregar a mídia"); }
  });

  app.post("/api/hack-ads/favorites/:id", ...guard, async (req: any, res) => {
    try { await hack.setFavorite(req.user.id, Number(req.params.id), req.body?.on !== false); res.json({ ok: true }); }
    catch (e) { fail(res, e, "Erro ao salvar"); }
  });

  app.get("/api/hack-ads/monitors", ...guard, async (req: any, res) => {
    try { res.json({ monitors: await hack.listMonitors(req.user.id) }); }
    catch (e) { fail(res, e, "Erro ao carregar o monitoramento"); }
  });

  app.post("/api/hack-ads/monitors", ...guard, async (req: any, res) => {
    try { res.json(await hack.addMonitor(req.user.id, Number(req.body?.adId))); }
    catch (e) { fail(res, e, "Erro ao monitorar a página"); }
  });

  app.delete("/api/hack-ads/monitors/:pageKey", ...guard, async (req: any, res) => {
    try { await hack.removeMonitor(req.user.id, String(req.params.pageKey)); res.json({ ok: true }); }
    catch (e) { fail(res, e, "Erro ao remover"); }
  });

  app.post("/api/hack-ads/monitors/:pageKey/check", ...guard, async (req: any, res) => {
    try { res.json({ jobId: await hack.checkNow(req.user.id, String(req.params.pageKey)) }); }
    catch (e) { fail(res, e, "Erro ao conferir a página"); }
  });
}
