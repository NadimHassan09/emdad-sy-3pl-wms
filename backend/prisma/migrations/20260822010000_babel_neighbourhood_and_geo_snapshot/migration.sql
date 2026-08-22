-- Babel neighbourhood id on orders (quote/create identity) + refreshable Babel geo snapshot tables.
-- Snapshot is a copy of Babel at sync time — refresh via BabelGeoSyncService / admin sync endpoint.

ALTER TABLE oms_orders
  ADD COLUMN IF NOT EXISTS babel_neighbourhood_id INTEGER;

ALTER TABLE outbound_orders
  ADD COLUMN IF NOT EXISTS babel_neighbourhood_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_oms_orders_babel_neighbourhood
  ON oms_orders (babel_neighbourhood_id);

CREATE INDEX IF NOT EXISTS idx_outbound_orders_babel_neighbourhood
  ON outbound_orders (babel_neighbourhood_id);

CREATE TABLE IF NOT EXISTS babel_cities (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS babel_areas (
  id INTEGER PRIMARY KEY,
  city_id INTEGER NOT NULL REFERENCES babel_cities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_babel_areas_city ON babel_areas (city_id);

CREATE TABLE IF NOT EXISTS babel_neighbourhoods (
  id INTEGER PRIMARY KEY,
  area_id INTEGER NOT NULL REFERENCES babel_areas(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_babel_neighbourhoods_area ON babel_neighbourhoods (area_id);
CREATE INDEX IF NOT EXISTS idx_babel_neighbourhoods_name ON babel_neighbourhoods (name);
