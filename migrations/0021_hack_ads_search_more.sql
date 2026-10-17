-- Hack Ads: busca que continua na Meta conforme o usuário rola a lista.
ALTER TABLE hack_ads_searches ADD COLUMN IF NOT EXISTS meta_total integer;
ALTER TABLE hack_ads_searches ADD COLUMN IF NOT EXISTS only_active boolean NOT NULL DEFAULT false;
ALTER TABLE hack_ads_searches ADD COLUMN IF NOT EXISTS media varchar(10);
