-- Hack Ads: banco compartilhado de anúncios da Biblioteca da Meta + salvos e monitoramento por usuário.
CREATE TABLE IF NOT EXISTS hack_ads (
  id bigserial PRIMARY KEY,
  ext_id varchar(40) NOT NULL UNIQUE,
  page_id varchar(40),
  page_name varchar(200),
  page_key varchar(220) NOT NULL,
  text text,
  media_type varchar(10) NOT NULL DEFAULT 'unknown',
  image_url text, video_url text, avatar_url text,
  image_local varchar(300), video_local varchar(300), avatar_local varchar(300),
  library_url text,
  destination_url text,
  domain varchar(200),
  checkout_url text,
  checkout_platform varchar(20),
  countries text[] NOT NULL DEFAULT '{}',
  language varchar(5),
  category varchar(40),
  started_at date,
  active boolean,
  creative_uses integer,
  creative_key varchar(64) NOT NULL,
  first_seen timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hack_ads_last_seen ON hack_ads (last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_hack_ads_page_key ON hack_ads (page_key);
CREATE INDEX IF NOT EXISTS idx_hack_ads_creative_key ON hack_ads (creative_key);
CREATE INDEX IF NOT EXISTS idx_hack_ads_started ON hack_ads (started_at);
CREATE INDEX IF NOT EXISTS idx_hack_ads_category ON hack_ads (category);
CREATE INDEX IF NOT EXISTS idx_hack_ads_domain ON hack_ads (domain);

CREATE TABLE IF NOT EXISTS hack_ads_observations (
  ad_id bigint NOT NULL REFERENCES hack_ads(id) ON DELETE CASCADE,
  dia date NOT NULL DEFAULT CURRENT_DATE,
  creative_uses integer,
  active boolean,
  PRIMARY KEY (ad_id, dia)
);

CREATE TABLE IF NOT EXISTS hack_ads_searches (
  id bigserial PRIMARY KEY,
  user_id varchar REFERENCES users(id) ON DELETE SET NULL,
  term varchar(120) NOT NULL,
  country varchar(3) NOT NULL,
  requested integer NOT NULL,
  found integer NOT NULL DEFAULT 0,
  added integer NOT NULL DEFAULT 0,
  status varchar(12) NOT NULL DEFAULT 'queued',
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_hack_ads_searches_user ON hack_ads_searches (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS hack_ads_search_ads (
  search_id bigint NOT NULL REFERENCES hack_ads_searches(id) ON DELETE CASCADE,
  ad_id bigint NOT NULL REFERENCES hack_ads(id) ON DELETE CASCADE,
  PRIMARY KEY (search_id, ad_id)
);

CREATE TABLE IF NOT EXISTS hack_ads_favorites (
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ad_id bigint NOT NULL REFERENCES hack_ads(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, ad_id)
);

CREATE TABLE IF NOT EXISTS hack_ads_pages (
  page_key varchar(220) PRIMARY KEY,
  page_id varchar(40),
  page_name varchar(200) NOT NULL,
  last_checked_at timestamptz,
  last_error text
);

CREATE TABLE IF NOT EXISTS hack_ads_page_snapshots (
  id bigserial PRIMARY KEY,
  page_key varchar(220) NOT NULL REFERENCES hack_ads_pages(page_key) ON DELETE CASCADE,
  checked_at timestamptz NOT NULL DEFAULT now(),
  active_cards integer NOT NULL,
  active_ads integer NOT NULL,
  capped boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_hack_ads_snapshots_page ON hack_ads_page_snapshots (page_key, checked_at);

CREATE TABLE IF NOT EXISTS hack_ads_monitors (
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  page_key varchar(220) NOT NULL REFERENCES hack_ads_pages(page_key) ON DELETE CASCADE,
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, page_key)
);
