-- LOC-2A: hierarchical list — direct children by warehouse + parent, ordered by sort_order
CREATE INDEX IF NOT EXISTS "idx_locations_wh_parent_sort"
  ON "locations" ("warehouse_id", "parent_id", "sort_order");
