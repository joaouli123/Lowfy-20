-- Hack Ads: plataformas onde o anúncio roda (facebook, instagram, messenger, whatsapp, threads, audience_network).
ALTER TABLE hack_ads ADD COLUMN IF NOT EXISTS platforms text[] NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_hack_ads_platforms ON hack_ads USING gin (platforms);
-- Anúncios gravados antes da correção do merge ficaram com tipo "unknown" mesmo tendo vídeo/imagem.
UPDATE hack_ads SET media_type = 'video' WHERE video_url IS NOT NULL AND media_type <> 'video';
UPDATE hack_ads SET media_type = 'image' WHERE media_type = 'unknown' AND image_url IS NOT NULL;
