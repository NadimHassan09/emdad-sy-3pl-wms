#!/usr/bin/env python3
"""Scoped production repair for the allowlisted OMS orders. One transaction per order."""

import json
import os
import re
import sys
from decimal import Decimal
from pathlib import Path

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb as Json

RETURNS_LOCATION = "c297d028-364f-4a34-aa3d-8bf8fa617b38"
OUT_DIR = Path("/var/www/emdad-sy-3pl-wms-staging/tmp/order-repair-20261008")

DELIVERED_DECREMENT = [
    "OMS-2026-00925", "OMS-2026-00442", "OMS-2026-01954", "OMS-2026-00909",
    "OMS-2026-00378", "OMS-2026-00691", "OMS-2026-01618", "OMS-2026-05261",
    "OMS-2026-04091", "OMS-2026-04736", "OMS-2026-05432", "OMS-2026-05210",
    "OMS-2026-06162", "OMS-2026-04838", "OMS-2026-03843", "OMS-2026-00114",
    "OMS-2026-04449", "OMS-2026-04419", "OMS-2026-06923",
]
DELIVERED_ZERO = ["OMS-2026-04342"]
OFD_DRAFT = ["OMS-2026-06400", "OMS-2026-06703"]
OFD_DECREMENT = ["OMS-2026-07057"]
OFD_STATUS = ["OMS-2026-06775", "OMS-2026-06790", "OMS-2026-06792", "OMS-2026-06992"]
RETURN_NONE = ["OMS-2026-00012"]
RETURN_PLUS = ["OMS-2026-00197"]

ALLOW = (
    DELIVERED_DECREMENT + DELIVERED_ZERO + OFD_DRAFT + OFD_DECREMENT
    + OFD_STATUS + RETURN_NONE + RETURN_PLUS
)
assert len(ALLOW) == len(set(ALLOW)) == 29
assert "OMS-2026-07160" not in ALLOW


def connect():
    text = Path("/var/www/emdad-sy-3pl-wms/backend/.env").read_text()
    url = re.search(r"^DATABASE_URL=(.*)$", text, re.M).group(1).strip().strip('"').strip("'")
    url = url.split("?")[0]
    conn = psycopg.connect(url, autocommit=False, row_factory=dict_row)
    return conn


def fingerprint(cur):
    cur.execute(
        """
        SELECT md5(COALESCE(string_agg(order_number || ':' || status::text, ',' ORDER BY order_number), '')) AS orders,
               count(*) AS n
        FROM oms_orders
        WHERE order_number <> ALL(%s)
        """,
        (ALLOW,),
    )
    orders = dict(cur.fetchone())
    cur.execute(
        """
        SELECT md5(COALESCE(string_agg(
                 sr.id::text || ':' || sr.status::text || ':' || sr.quantity::text, ',' ORDER BY sr.id), '')) AS reservations,
               count(*) AS n
        FROM stock_reservations sr
        WHERE sr.outbound_order_id IS NULL
           OR sr.outbound_order_id NOT IN (
                SELECT outbound_order_id FROM oms_orders
                WHERE order_number = ANY(%s) AND outbound_order_id IS NOT NULL
           )
        """,
        (ALLOW,),
    )
    reservations = dict(cur.fetchone())
    cur.execute(
        """
        SELECT md5(COALESCE(string_agg(
                 cs.id::text || ':' || cs.status::text || ':' || COALESCE(cs.external_awb, '') || ':' || COALESCE(cs.tracking_number, ''),
                 ',' ORDER BY cs.id), '')) AS shipments,
               count(*) AS n
        FROM carrier_shipments cs
        WHERE cs.outbound_order_id NOT IN (
            SELECT outbound_order_id FROM oms_orders
            WHERE order_number = ANY(%s) AND outbound_order_id IS NOT NULL
        )
        """,
        (ALLOW,),
    )
    shipments = dict(cur.fetchone())
    return {"orders": orders, "reservations": reservations, "shipments": shipments}


def snapshot(conn):
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    cur = conn.cursor()
    cur.execute(
        """
        SELECT o.order_number, o.id, o.status::text AS oms, oo.status::text AS outbound,
               o.cod_amount, o.cod_status::text, o.cod_generation_status::text AS cod_gen,
               o.delivered_at, o.returned_at, o.out_for_delivery_at, o.tracking_number,
               cr.id AS cod_id, cr.status::text AS cod_rec, cr.original_amount,
               (SELECT COALESCE(SUM(a.amount),0) FROM cod_adjustments a WHERE a.cod_record_id = cr.id) AS adj_sum,
               (SELECT COUNT(*) FROM cod_adjustments a WHERE a.cod_record_id = cr.id) AS adj_n,
               (SELECT COUNT(*) FROM carrier_shipments s WHERE s.outbound_order_id = o.outbound_order_id) AS shipments,
               (SELECT COUNT(*) FROM stock_reservations sr WHERE sr.outbound_order_id = o.outbound_order_id AND sr.status = 'active') AS active_res
        FROM oms_orders o
        LEFT JOIN outbound_orders oo ON oo.id = o.outbound_order_id
        LEFT JOIN cod_records cr ON cr.oms_order_id = o.id
        WHERE o.order_number = ANY(%s)
        ORDER BY o.order_number
        """,
        (ALLOW,),
    )
    rows = cur.fetchall()
    if len(rows) != 29:
        raise SystemExit(f"expected 29 orders, found {len(rows)}")
    fp = fingerprint(cur)
    cur.execute(
        """
        SELECT status::text, count(*) FROM oms_orders
        WHERE order_number <> ALL(%s) GROUP BY 1 ORDER BY 1
        """,
        (ALLOW,),
    )
    outside = cur.fetchall()
    payload = {
        "orders": rows,
        "fingerprint": fp,
        "outside_status_counts": outside,
    }
    path = OUT_DIR / "before.json"

    def default(o):
        if isinstance(o, Decimal):
            return str(o)
        return str(o)

    path.write_text(json.dumps(payload, default=default, indent=2))
    print(f"snapshot {path} orders={len(rows)} outside_fp={fp['orders']['orders'][:12]}")
    return fp


def load_return_move(cur, order_number):
    cur.execute(
        """
        SELECT o.id AS oms_id, o.company_id, o.order_number, o.status::text AS oms_status,
               o.outbound_order_id, oo.status::text AS outbound_status,
               o.cod_amount, o.currency, o.payment_method::text AS payment_method,
               o.delivered_at, o.out_for_delivery_at, o.returned_at,
               r.id AS oms_return_id, r.status::text AS oms_return_status, r.created_by AS return_created_by,
               r.warehouse_return_id,
               wr.status::text AS wh_status,
               wl.id AS line_id, wl.posted_quantity, wl.product_id, wl.lot_id, wl.target_location_id,
               l.id AS ledger_id, l.quantity AS ledger_qty, l.company_id AS ledger_company,
               l.product_id AS ledger_product, l.lot_id AS ledger_lot, l.to_location_id,
               l.operator_id, l.movement_type::text AS movement_type
        FROM oms_orders o
        JOIN outbound_orders oo ON oo.id = o.outbound_order_id
        JOIN oms_returns r ON r.oms_order_id = o.id
        LEFT JOIN return_orders wr ON wr.id = r.warehouse_return_id
        LEFT JOIN return_order_lines wl ON wl.return_order_id = wr.id
        LEFT JOIN inventory_ledger l
          ON l.reference_type = 'return_order' AND l.reference_id = wr.id
         AND l.movement_type = 'return_receive'
        WHERE o.order_number = %s
        """,
        (order_number,),
    )
    rows = cur.fetchall()
    if len(rows) != 1:
        raise RuntimeError(f"{order_number}: expected 1 return line, got {len(rows)}")
    return rows[0]


def assert_fp(cur, before, label):
    after = fingerprint(cur)
    if after != before:
        raise RuntimeError(f"outside-allowlist fingerprint changed after {label}: {after} vs {before}")


def decrement_return(cur, move):
    key = f"repair:undo-return:{move['warehouse_return_id']}:line:{move['line_id']}"
    cur.execute("SELECT ledger_id FROM ledger_idempotency WHERE idempotency_key = %s", (key,))
    if cur.fetchone():
        raise RuntimeError(f"{move['order_number']}: undo key already exists")
    if move["movement_type"] != "return_receive":
        raise RuntimeError(f"{move['order_number']}: missing return_receive")
    qty = move["ledger_qty"]
    if qty != move["posted_quantity"]:
        raise RuntimeError(f"{move['order_number']}: posted qty != ledger qty")
    company = str(move["ledger_company"])
    product = str(move["ledger_product"])
    location = str(move["to_location_id"])
    lot = move["ledger_lot"]
    if lot is None:
        cur.execute(
            """
            SELECT quantity_on_hand, quantity_reserved FROM current_stock
            WHERE company_id = %s AND product_id = %s AND location_id = %s
              AND lot_id IS NULL AND package_id IS NULL
            FOR UPDATE
            """,
            (company, product, location),
        )
    else:
        cur.execute(
            """
            SELECT quantity_on_hand, quantity_reserved FROM current_stock
            WHERE company_id = %s AND product_id = %s AND location_id = %s
              AND lot_id = %s AND package_id IS NULL
            FOR UPDATE
            """,
            (company, product, location, str(lot)),
        )
    stock = cur.fetchone()
    if not stock:
        raise RuntimeError(f"{move['order_number']}: stock row missing")
    before_qty = stock["quantity_on_hand"]
    if before_qty - qty < 0 or before_qty - qty < stock["quantity_reserved"]:
        raise RuntimeError(f"{move['order_number']}: insufficient stock {before_qty} reserved {stock['quantity_reserved']}")
    if lot is None:
        cur.execute(
            """
            UPDATE current_stock
               SET quantity_on_hand = quantity_on_hand - %s::numeric,
                   version = version + 1,
                   last_movement_at = NOW()
             WHERE company_id = %s AND product_id = %s AND location_id = %s
               AND lot_id IS NULL AND package_id IS NULL
               AND quantity_on_hand - %s::numeric >= 0
               AND quantity_on_hand - %s::numeric >= quantity_reserved
            RETURNING quantity_on_hand
            """,
            (qty, company, product, location, qty, qty),
        )
    else:
        cur.execute(
            """
            UPDATE current_stock
               SET quantity_on_hand = quantity_on_hand - %s::numeric,
                   version = version + 1,
                   last_movement_at = NOW()
             WHERE company_id = %s AND product_id = %s AND location_id = %s
               AND lot_id = %s AND package_id IS NULL
               AND quantity_on_hand - %s::numeric >= 0
               AND quantity_on_hand - %s::numeric >= quantity_reserved
            RETURNING quantity_on_hand
            """,
            (qty, company, product, location, str(lot), qty, qty),
        )
    updated = cur.fetchone()
    if not updated:
        raise RuntimeError(f"{move['order_number']}: decrement affected 0 rows")
    after_qty = updated["quantity_on_hand"]
    if after_qty != before_qty - qty:
        raise RuntimeError(f"{move['order_number']}: unexpected stock after decrement")
    cur.execute(
        """
        INSERT INTO inventory_ledger (
          company_id, product_id, lot_id, from_location_id, movement_type, quantity,
          quantity_before, quantity_after, reference_type, reference_id, operator_id,
          idempotency_key, notes
        ) VALUES (
          %s, %s, %s, %s, 'adjustment_negative', %s,
          %s, %s, 'return_order', %s, %s,
          %s, %s
        ) RETURNING id
        """,
        (
            company, product, lot, location, qty,
            before_qty, after_qty, move["warehouse_return_id"], move["operator_id"],
            key, f"repair undo return_receive for {move['order_number']}",
        ),
    )
    ledger_id = cur.fetchone()["id"]
    cur.execute(
        "INSERT INTO ledger_idempotency (idempotency_key, ledger_id) VALUES (%s, %s)",
        (key, ledger_id),
    )
    return before_qty, after_qty, key


def cancel_completed_return(cur, move):
    cur.execute(
        """
        UPDATE return_orders
           SET status = 'cancelled', cancelled_at = NOW(), cancelled_by = %s,
               notes = LEFT(COALESCE(notes, '') || ' | repair: voided incorrect return', 2000)
         WHERE id = %s AND status = 'completed'
        """,
        (move["return_created_by"], move["warehouse_return_id"]),
    )
    if cur.rowcount != 1:
        raise RuntimeError(f"{move['order_number']}: warehouse return not cancelled")
    cur.execute(
        """
        UPDATE oms_returns
           SET status = 'cancelled',
               notes = LEFT(COALESCE(notes, '') || ' | repair: voided incorrect return', 2000)
         WHERE id = %s AND oms_order_id = %s AND status = 'completed'
        """,
        (move["oms_return_id"], move["oms_id"]),
    )
    if cur.rowcount != 1:
        raise RuntimeError(f"{move['order_number']}: oms return not cancelled")


def cod_clear_adjustments(cur, move):
    cur.execute(
        "SELECT id, original_amount, status::text AS status, created_by FROM cod_records WHERE oms_order_id = %s",
        (move["oms_id"],),
    )
    records = cur.fetchall()
    cod_amount = move["cod_amount"]
    if cod_amount is None:
        raise RuntimeError(f"{move['order_number']}: cod_amount is null")
    if len(records) == 0:
        return "create"
    if len(records) != 1:
        raise RuntimeError(f"{move['order_number']}: multiple COD records")
    rec = records[0]
    if Decimal(rec["original_amount"]) != Decimal(cod_amount):
        raise RuntimeError(
            f"{move['order_number']}: original_amount {rec['original_amount']} != cod_amount {cod_amount}"
        )
    cur.execute(
        "SELECT id, amount, oms_return_id FROM cod_adjustments WHERE cod_record_id = %s",
        (rec["id"],),
    )
    adjs = cur.fetchall()
    if len(adjs) != 1 or str(adjs[0]["oms_return_id"]) != str(move["oms_return_id"]):
        raise RuntimeError(f"{move['order_number']}: unexpected COD adjustments {adjs}")
    cur.execute("DELETE FROM cod_adjustments WHERE id = %s AND oms_return_id = %s", (adjs[0]["id"], move["oms_return_id"]))
    if cur.rowcount != 1:
        raise RuntimeError(f"{move['order_number']}: adjustment delete failed")
    cur.execute(
        """
        UPDATE cod_records
           SET status = 'pending', available_at = NULL, paid_out_at = NULL
         WHERE id = %s AND oms_order_id = %s
        """,
        (rec["id"], move["oms_id"]),
    )
    cur.execute(
        """
        INSERT INTO oms_order_events (oms_order_id, outbound_order_id, company_id, event_type, payload, created_by)
        VALUES (%s, %s, %s, 'cod.status_changed', %s, %s)
        """,
        (
            move["oms_id"], move["outbound_order_id"], move["company_id"],
            Json({"from": rec["status"], "to": "pending", "codRecordId": str(rec["id"]), "reason": "repair_delivered"}),
            move["return_created_by"],
        ),
    )
    return "kept"


def cod_create(cur, move, actor):
    cur.execute("SELECT id FROM cod_records WHERE oms_order_id = %s", (move["oms_id"],))
    if cur.fetchone():
        raise RuntimeError(f"{move['order_number']}: COD record already exists")
    amount = move["cod_amount"]
    if amount is None or Decimal(amount) == 0:
        raise RuntimeError(f"{move['order_number']}: cannot create COD without positive cod_amount")
    if move["payment_method"] != "COD":
        raise RuntimeError(f"{move['order_number']}: payment method is not COD")
    cur.execute(
        """
        INSERT INTO cod_records (company_id, oms_order_id, original_amount, currency, status, created_by)
        VALUES (%s, %s, %s, %s, 'pending', %s)
        RETURNING id, original_amount
        """,
        (move["company_id"], move["oms_id"], amount, move["currency"] or "USD", actor),
    )
    rec = cur.fetchone()
    if Decimal(rec["original_amount"]) != Decimal(amount):
        raise RuntimeError(f"{move['order_number']}: stored original_amount mismatch")
    cur.execute(
        """
        INSERT INTO oms_order_events (oms_order_id, outbound_order_id, company_id, event_type, payload, created_by)
        VALUES (%s, %s, %s, 'cod.generated', %s, %s)
        """,
        (
            move["oms_id"], move["outbound_order_id"], move["company_id"],
            Json({"codRecordId": str(rec["id"]), "originalAmount": str(amount), "source": "repair"}),
            actor,
        ),
    )


def set_order_cod_pending(cur, oms_id):
    cur.execute(
        """
        UPDATE oms_orders
           SET cod_generation_status = 'ok',
               cod_status = 'pending',
               cod_collected_at = NULL,
               cod_remitted_at = NULL
         WHERE id = %s
        """,
        (oms_id,),
    )


def assert_cod(cur, oms_id, order_number):
    cur.execute(
        """
        SELECT o.cod_amount, o.cod_status::text AS cod_status, o.cod_generation_status::text AS gen,
               cr.id, cr.original_amount, cr.status::text AS rec_status,
               (SELECT COUNT(*) FROM cod_adjustments a WHERE a.cod_record_id = cr.id) AS adj_n,
               (SELECT COALESCE(SUM(a.amount),0) FROM cod_adjustments a WHERE a.cod_record_id = cr.id) AS adj_sum
        FROM oms_orders o
        JOIN cod_records cr ON cr.oms_order_id = o.id
        WHERE o.id = %s
        """,
        (oms_id,),
    )
    row = cur.fetchone()
    if not row:
        raise RuntimeError(f"{order_number}: COD record missing after repair")
    if Decimal(row["original_amount"]) != Decimal(row["cod_amount"]):
        raise RuntimeError(f"{order_number}: COD original != cod_amount")
    if row["adj_n"] != 0 or Decimal(row["adj_sum"]) != 0:
        raise RuntimeError(f"{order_number}: COD adjustments remain")
    if row["rec_status"] != "pending" or row["cod_status"] != "pending" or row["gen"] != "ok":
        raise RuntimeError(f"{order_number}: COD status {row}")
    cur.execute("SELECT COUNT(*) AS n FROM cod_records WHERE oms_order_id = %s", (oms_id,))
    if cur.fetchone()["n"] != 1:
        raise RuntimeError(f"{order_number}: duplicate COD")


def event(cur, move, event_type, payload, actor):
    cur.execute(
        """
        INSERT INTO oms_order_events (oms_order_id, outbound_order_id, company_id, event_type, payload, created_by)
        VALUES (%s, %s, %s, %s, %s, %s)
        """,
        (move["oms_id"], move["outbound_order_id"], move["company_id"], event_type, Json(payload), actor),
    )


def count_event(cur, oms_id, event_type):
    cur.execute(
        "SELECT COUNT(*) AS n FROM oms_order_events WHERE oms_order_id = %s AND event_type = %s",
        (oms_id, event_type),
    )
    return cur.fetchone()["n"]


def repair_delivered(conn, fp, order_number, zero_stock, reason="zero_net"):
    cur = conn.cursor()
    move = load_return_move(cur, order_number)
    if move["oms_status"] == "delivered" and move["oms_return_status"] == "cancelled":
        print(f"skip {order_number} already delivered")
        conn.rollback()
        return
    if move["oms_status"] != "returned" or move["outbound_status"] != "shipped":
        raise RuntimeError(f"{order_number}: unexpected status {move['oms_status']}/{move['outbound_status']}")
    if str(move["to_location_id"]) != RETURNS_LOCATION:
        raise RuntimeError(f"{order_number}: return location is not Returns")
    picks_before = count_picks(cur, move["outbound_order_id"])
    ships_before = count_shipments(cur, move["outbound_order_id"])
    stock_before = None
    if zero_stock:
        stock_before = lock_stock_qty(cur, move)
    else:
        decrement_return(cur, move)
    cancel_completed_return(cur, move)
    actor = move["return_created_by"] or move["operator_id"]
    mode = cod_clear_adjustments(cur, move)
    if mode == "create":
        cod_create(cur, move, actor)
    set_order_cod_pending(cur, move["oms_id"])
    cur.execute(
        """
        UPDATE oms_orders
           SET status = 'delivered',
               delivered_at = COALESCE(delivered_at, NOW()),
               returned_at = NULL
         WHERE id = %s AND order_number = %s AND status = 'returned'
        """,
        (move["oms_id"], order_number),
    )
    if cur.rowcount != 1:
        raise RuntimeError(f"{order_number}: status update failed")
    if count_event(cur, move["oms_id"], "oms.delivered") == 0:
        event(cur, move, "oms.delivered", {"source": "repair"}, actor)
    payload = {"source": "repair", "inventory": reason if zero_stock else "adjustment_negative"}
    event(cur, move, "repair.delivered", payload, actor)
    assert_cod(cur, move["oms_id"], order_number)
    if count_picks(cur, move["outbound_order_id"]) != picks_before:
        raise RuntimeError(f"{order_number}: pick count changed")
    if count_shipments(cur, move["outbound_order_id"]) != ships_before:
        raise RuntimeError(f"{order_number}: shipment count changed")
    if zero_stock and lock_stock_qty(cur, move) != stock_before:
        raise RuntimeError(f"{order_number}: stock changed")
    cur.execute(
        """
        SELECT o.status::text AS oms, oo.status::text AS outbound, o.returned_at, o.delivered_at,
               r.status::text AS ret
        FROM oms_orders o
        JOIN outbound_orders oo ON oo.id = o.outbound_order_id
        JOIN oms_returns r ON r.id = %s
        WHERE o.id = %s
        """,
        (move["oms_return_id"], move["oms_id"]),
    )
    check = cur.fetchone()
    if check["oms"] != "delivered" or check["outbound"] != "shipped" or check["ret"] != "cancelled":
        raise RuntimeError(f"{order_number}: invariant {check}")
    if check["returned_at"] is not None or check["delivered_at"] is None:
        raise RuntimeError(f"{order_number}: timestamps {check}")
    conn.commit()
    cur = conn.cursor()
    assert_fp(cur, fp, order_number)
    print(f"ok delivered {order_number} cod={mode} zero_stock={zero_stock}")


def lock_stock_qty(cur, move):
    lot = move["ledger_lot"]
    args = [str(move["ledger_company"]), str(move["ledger_product"]), str(move["to_location_id"])]
    if lot is None:
        cur.execute(
            """
            SELECT quantity_on_hand FROM current_stock
            WHERE company_id=%s AND product_id=%s AND location_id=%s AND lot_id IS NULL AND package_id IS NULL
            FOR UPDATE
            """,
            args,
        )
    else:
        cur.execute(
            """
            SELECT quantity_on_hand FROM current_stock
            WHERE company_id=%s AND product_id=%s AND location_id=%s AND lot_id=%s AND package_id IS NULL
            FOR UPDATE
            """,
            args + [str(lot)],
        )
    row = cur.fetchone()
    if not row:
        raise RuntimeError(f"{move['order_number']}: stock missing")
    return Decimal(row["quantity_on_hand"])


def count_picks(cur, outbound_id):
    cur.execute(
        """
        SELECT COUNT(*) AS n FROM inventory_ledger
        WHERE reference_type = 'outbound_order' AND reference_id = %s AND movement_type = 'outbound_pick'
        """,
        (outbound_id,),
    )
    return cur.fetchone()["n"]


def count_shipments(cur, outbound_id):
    cur.execute(
        "SELECT COUNT(*) AS n FROM carrier_shipments WHERE outbound_order_id = %s",
        (outbound_id,),
    )
    return cur.fetchone()["n"]


def repair_ofd_decrement(conn, fp, order_number, zero_stock=False, reason="zero_net"):
    cur = conn.cursor()
    move = load_return_move(cur, order_number)
    if move["oms_status"] == "out_for_delivery" and move["oms_return_status"] == "cancelled":
        print(f"skip {order_number}")
        conn.rollback()
        return
    if move["oms_status"] != "returned" or move["outbound_status"] != "shipped":
        raise RuntimeError(f"{order_number}: unexpected {move['oms_status']}")
    cur.execute("SELECT COUNT(*) AS n FROM cod_records WHERE oms_order_id = %s", (move["oms_id"],))
    if cur.fetchone()["n"] != 0:
        raise RuntimeError(f"{order_number}: unexpected COD")
    picks = count_picks(cur, move["outbound_order_id"])
    ships = count_shipments(cur, move["outbound_order_id"])
    stock_before = lock_stock_qty(cur, move) if zero_stock else None
    if zero_stock:
        pass
    else:
        decrement_return(cur, move)
    cancel_completed_return(cur, move)
    actor = move["return_created_by"] or move["operator_id"]
    cur.execute(
        """
        UPDATE oms_orders
           SET status = 'out_for_delivery',
               out_for_delivery_at = COALESCE(out_for_delivery_at, NOW()),
               returned_at = NULL
         WHERE id = %s AND order_number = %s AND status = 'returned' AND delivered_at IS NULL
        """,
        (move["oms_id"], order_number),
    )
    if cur.rowcount != 1:
        raise RuntimeError(f"{order_number}: ofd update failed")
    event(cur, move, "repair.out_for_delivery", {"source": "repair", "inventory": reason if zero_stock else "adjustment_negative"}, actor)
    if count_event(cur, move["oms_id"], "oms.delivered") != 0:
        raise RuntimeError(f"{order_number}: delivered event exists")
    if count_picks(cur, move["outbound_order_id"]) != picks or count_shipments(cur, move["outbound_order_id"]) != ships:
        raise RuntimeError(f"{order_number}: pick or shipment changed")
    if zero_stock and lock_stock_qty(cur, move) != stock_before:
        raise RuntimeError(f"{order_number}: stock changed")
    cur.execute("SELECT COUNT(*) AS n FROM cod_records WHERE oms_order_id = %s", (move["oms_id"],))
    if cur.fetchone()["n"] != 0:
        raise RuntimeError(f"{order_number}: COD created")
    conn.commit()
    cur = conn.cursor()
    assert_fp(cur, fp, order_number)
    print(f"ok ofd-decrement {order_number}")


def repair_ofd_draft(conn, fp, order_number):
    cur = conn.cursor()
    cur.execute(
        """
        SELECT o.id, o.company_id, o.outbound_order_id, o.status::text AS oms, oo.status::text AS outbound,
               o.delivered_at, o.out_for_delivery_at,
               (SELECT COUNT(*) FROM inventory_ledger l
                 WHERE l.reference_type='outbound_order' AND l.reference_id=o.outbound_order_id
                   AND l.movement_type='outbound_pick') AS picks
        FROM oms_orders o
        JOIN outbound_orders oo ON oo.id = o.outbound_order_id
        WHERE o.order_number = %s
        """,
        (order_number,),
    )
    order = cur.fetchone()
    if order["oms"] == "out_for_delivery":
        print(f"skip {order_number}")
        conn.rollback()
        return
    if order["oms"] != "failed_delivery" or order["outbound"] != "shipped" or order["delivered_at"] is not None:
        raise RuntimeError(f"{order_number}: bad state")
    if order["picks"] < 1:
        raise RuntimeError(f"{order_number}: missing pick")
    cur.execute(
        """
        SELECT id FROM oms_returns
        WHERE oms_order_id = %s AND status IN ('requested', 'approved')
        """,
        (order["id"],),
    )
    drafts = cur.fetchall()
    if len(drafts) != 1:
        raise RuntimeError(f"{order_number}: expected 1 draft return")
    cur.execute(
        """
        UPDATE oms_returns
           SET status = 'cancelled',
               notes = 'Auto-cancelled: admin resumed out-for-delivery after failed_delivery.'
         WHERE id = %s AND oms_order_id = %s AND status = 'requested' AND warehouse_return_id IS NULL
        """,
        (drafts[0]["id"], order["id"]),
    )
    if cur.rowcount != 1:
        raise RuntimeError(f"{order_number}: draft cancel failed")
    cur.execute(
        """
        UPDATE oms_orders
           SET status = 'out_for_delivery',
               out_for_delivery_at = COALESCE(out_for_delivery_at, NOW())
         WHERE id = %s AND order_number = %s AND status = 'failed_delivery'
        """,
        (order["id"], order_number),
    )
    if cur.rowcount != 1:
        raise RuntimeError(f"{order_number}: status failed")
    cur.execute(
        """
        INSERT INTO oms_order_events (oms_order_id, outbound_order_id, company_id, event_type, payload)
        VALUES (%s, %s, %s, 'oms.out_for_delivery_resumed', %s)
        """,
        (order["id"], order["outbound_order_id"], order["company_id"], Json({"source": "repair"})),
    )
    cur.execute("SELECT COUNT(*) AS n FROM cod_records WHERE oms_order_id = %s", (order["id"],))
    if cur.fetchone()["n"] != 0:
        raise RuntimeError(f"{order_number}: COD present")
    conn.commit()
    cur = conn.cursor()
    assert_fp(cur, fp, order_number)
    print(f"ok ofd-draft {order_number}")


def repair_ofd_status(conn, fp, order_number):
    cur = conn.cursor()
    cur.execute(
        """
        SELECT o.id, o.company_id, o.outbound_order_id, o.status::text AS oms, oo.status::text AS outbound,
               o.delivered_at,
               (SELECT COUNT(*) FROM carrier_shipments s WHERE s.outbound_order_id = o.outbound_order_id) AS ships,
               (SELECT COUNT(*) FROM stock_reservations sr WHERE sr.outbound_order_id = o.outbound_order_id AND sr.status='active') AS active_res,
               (SELECT COUNT(*) FROM inventory_ledger l WHERE l.reference_type='outbound_order' AND l.reference_id=o.outbound_order_id) AS ledger_n
        FROM oms_orders o
        JOIN outbound_orders oo ON oo.id = o.outbound_order_id
        WHERE o.order_number = %s
        """,
        (order_number,),
    )
    order = cur.fetchone()
    if order["oms"] == "out_for_delivery" and order["outbound"] == "waiting_for_shipping_details":
        print(f"skip {order_number}")
        conn.rollback()
        return
    if order["oms"] != "processing" or order["outbound"] != "waiting_for_shipping_details":
        raise RuntimeError(f"{order_number}: unexpected {order['oms']}/{order['outbound']}")
    if order["ledger_n"] != 0 or order["active_res"] != 1:
        raise RuntimeError(f"{order_number}: inventory/reservation unexpected {order}")
    cur.execute(
        """
        UPDATE oms_orders
           SET status = 'out_for_delivery',
               out_for_delivery_at = COALESCE(out_for_delivery_at, NOW())
         WHERE id = %s AND order_number = %s AND status = 'processing'
        """,
        (order["id"], order_number),
    )
    if cur.rowcount != 1:
        raise RuntimeError(f"{order_number}: update failed")
    cur.execute(
        """
        INSERT INTO oms_order_events (oms_order_id, outbound_order_id, company_id, event_type, payload)
        VALUES (%s, %s, %s, 'repair.out_for_delivery', %s)
        """,
        (order["id"], order["outbound_order_id"], order["company_id"], Json({"source": "repair", "commercial_only": True})),
    )
    cur.execute(
        """
        SELECT oo.status::text AS outbound,
               (SELECT COUNT(*) FROM carrier_shipments s WHERE s.outbound_order_id = o.outbound_order_id) AS ships,
               (SELECT COUNT(*) FROM stock_reservations sr WHERE sr.outbound_order_id = o.outbound_order_id AND sr.status='active') AS active_res,
               (SELECT COUNT(*) FROM inventory_ledger l WHERE l.reference_type='outbound_order' AND l.reference_id=o.outbound_order_id) AS ledger_n,
               o.delivered_at
        FROM oms_orders o
        JOIN outbound_orders oo ON oo.id = o.outbound_order_id
        WHERE o.id = %s
        """,
        (order["id"],),
    )
    after = cur.fetchone()
    if after["outbound"] != "waiting_for_shipping_details" or after["ships"] != order["ships"]:
        raise RuntimeError(f"{order_number}: outbound or shipments changed")
    if after["active_res"] != 1 or after["ledger_n"] != 0 or after["delivered_at"] is not None:
        raise RuntimeError(f"{order_number}: side effect {after}")
    conn.commit()
    cur = conn.cursor()
    assert_fp(cur, fp, order_number)
    print(f"ok ofd-status {order_number}")


def repair_00012(conn, fp):
    order_number = "OMS-2026-00012"
    cur = conn.cursor()
    cur.execute(
        """
        SELECT o.id, o.company_id, o.outbound_order_id, o.status::text AS oms, oo.status::text AS outbound,
               (SELECT COUNT(*) FROM oms_returns r WHERE r.oms_order_id=o.id) AS returns,
               (SELECT COUNT(*) FROM inventory_ledger l WHERE l.reference_type='outbound_order' AND l.reference_id=o.outbound_order_id) AS ledger_n,
               (SELECT COUNT(*) FROM cod_records c WHERE c.oms_order_id=o.id) AS cods,
               (SELECT e.created_by FROM oms_order_events e WHERE e.oms_order_id=o.id AND e.created_by IS NOT NULL ORDER BY e.created_at DESC LIMIT 1) AS actor
        FROM oms_orders o
        JOIN outbound_orders oo ON oo.id=o.outbound_order_id
        WHERE o.order_number=%s
        """,
        (order_number,),
    )
    order = cur.fetchone()
    if order["oms"] == "returned" and order["returns"] == 1:
        print("skip OMS-2026-00012")
        conn.rollback()
        return
    if order["oms"] != "shipped" or order["outbound"] != "externally_fulfilled":
        raise RuntimeError(f"00012 state {order}")
    if order["ledger_n"] != 0 or order["cods"] != 0 or order["returns"] != 0:
        raise RuntimeError(f"00012 unexpected related rows {order}")
    if not order["actor"]:
        raise RuntimeError("00012 missing actor")
    cur.execute(
        """
        INSERT INTO oms_returns (company_id, oms_order_id, status, reason, notes, created_by, completed_at, execution_mode)
        VALUES (%s, %s, 'completed', 'repair', 'Commercial return only. External fulfillment had no outbound_pick, so no inventory movement.', %s, NOW(), 'admin')
        RETURNING id
        """,
        (order["company_id"], order["id"], order["actor"]),
    )
    ret_id = cur.fetchone()["id"]
    cur.execute(
        """
        INSERT INTO oms_return_lines (oms_return_id, product_id, quantity, unit_price, line_total, lot_id, line_number)
        SELECT %s, product_id, requested_quantity, unit_price, line_total, specific_lot_id, line_number
        FROM oms_order_lines WHERE oms_order_id = %s
        """,
        (ret_id, order["id"]),
    )
    if cur.rowcount < 1:
        raise RuntimeError("00012 no lines")
    cur.execute(
        """
        UPDATE oms_orders SET status='returned', returned_at=NOW()
        WHERE id=%s AND order_number=%s AND status='shipped'
        """,
        (order["id"], order_number),
    )
    if cur.rowcount != 1:
        raise RuntimeError("00012 status")
    cur.execute(
        """
        INSERT INTO oms_order_events (oms_order_id, outbound_order_id, company_id, event_type, payload, created_by)
        VALUES (%s, %s, %s, 'oms.returned', %s, %s)
        """,
        (order["id"], order["outbound_order_id"], order["company_id"], Json({"source": "repair", "inventory": "none"}), order["actor"]),
    )
    cur.execute(
        """
        SELECT (SELECT COUNT(*) FROM inventory_ledger l WHERE l.reference_type='outbound_order' AND l.reference_id=%s) AS ledger_n,
               (SELECT warehouse_return_id FROM oms_returns WHERE id=%s) AS wh,
               (SELECT status::text FROM oms_returns WHERE id=%s) AS st,
               (SELECT COUNT(*) FROM cod_records WHERE oms_order_id=%s) AS cods
        """,
        (order["outbound_order_id"], ret_id, ret_id, order["id"]),
    )
    check = cur.fetchone()
    if check["ledger_n"] != 0 or check["wh"] is not None or check["st"] != "completed" or check["cods"] != 0:
        raise RuntimeError(f"00012 invariant {check}")
    conn.commit()
    cur = conn.cursor()
    assert_fp(cur, fp, order_number)
    print("ok returned OMS-2026-00012")


def repair_00197(conn, fp):
    order_number = "OMS-2026-00197"
    cur = conn.cursor()
    cur.execute(
        """
        SELECT o.id, o.company_id, o.outbound_order_id, o.status::text AS oms, oo.status::text AS outbound,
               o.currency,
               (SELECT COUNT(*) FROM oms_returns r WHERE r.oms_order_id=o.id) AS returns,
               (SELECT COUNT(*) FROM cod_records c WHERE c.oms_order_id=o.id) AS cods
        FROM oms_orders o
        JOIN outbound_orders oo ON oo.id=o.outbound_order_id
        WHERE o.order_number=%s
        """,
        (order_number,),
    )
    order = cur.fetchone()
    if order["oms"] == "returned":
        print("skip OMS-2026-00197")
        conn.rollback()
        return
    if order["oms"] != "processing" or order["outbound"] != "shipped" or order["returns"] or order["cods"]:
        raise RuntimeError(f"00197 state {order}")
    cur.execute(
        """
        SELECT company_id, product_id, lot_id, quantity, operator_id, from_location_id
        FROM inventory_ledger
        WHERE reference_type='outbound_order' AND reference_id=%s AND movement_type='outbound_pick'
        """,
        (order["outbound_order_id"],),
    )
    picks = cur.fetchall()
    if len(picks) != 1 or Decimal(picks[0]["quantity"]) != Decimal("1"):
        raise RuntimeError(f"00197 picks {picks}")
    pick = picks[0]
    cur.execute(
        "SELECT id, warehouse_id, name, type::text AS type, status::text AS status FROM locations WHERE id=%s",
        (RETURNS_LOCATION,),
    )
    loc = cur.fetchone()
    if not loc or loc["name"] != "Returns" or loc["type"] != "internal" or loc["status"] != "active":
        raise RuntimeError(f"Returns location {loc}")
    actor = pick["operator_id"]
    cur.execute(
        """
        INSERT INTO return_orders (
          company_id, warehouse_id, original_outbound_order_id, status, notes, created_by,
          confirmed_at, receiving_started_at, completed_at
        ) VALUES (%s, %s, %s, 'completed', 'repair return of picked quantity', %s, NOW(), NOW(), NOW())
        RETURNING id
        """,
        (order["company_id"], loc["warehouse_id"], order["outbound_order_id"], actor),
    )
    wh_id = cur.fetchone()["id"]
    cur.execute(
        """
        INSERT INTO return_order_lines (
          return_order_id, product_id, lot_id, expected_quantity, received_quantity, posted_quantity,
          line_status, disposition, target_location_id, posted_at, line_number
        ) VALUES (%s, %s, %s, %s, %s, %s, 'posted', 'restock', %s, NOW(), 1)
        RETURNING id
        """,
        (wh_id, pick["product_id"], pick["lot_id"], pick["quantity"], pick["quantity"], pick["quantity"], RETURNS_LOCATION),
    )
    line_id = cur.fetchone()["id"]
    cur.execute(
        """
        INSERT INTO oms_returns (
          company_id, oms_order_id, warehouse_return_id, status, reason, notes, created_by, completed_at, execution_mode
        ) VALUES (%s, %s, %s, 'completed', 'repair', 'Return after outbound_pick. Inventory +1 once via return_receive.', %s, NOW(), 'admin')
        RETURNING id
        """,
        (order["company_id"], order["id"], wh_id, actor),
    )
    oms_ret = cur.fetchone()["id"]
    cur.execute(
        """
        INSERT INTO oms_return_lines (oms_return_id, product_id, quantity, unit_price, line_total, lot_id, line_number)
        SELECT %s, product_id, requested_quantity, unit_price, line_total, %s, line_number
        FROM oms_order_lines WHERE oms_order_id=%s
        """,
        (oms_ret, pick["lot_id"], order["id"]),
    )
    if cur.rowcount != 1:
        raise RuntimeError("00197 line count")
    idem = f"return:{wh_id}:line:{line_id}:post"
    cur.execute("SELECT 1 FROM ledger_idempotency WHERE idempotency_key=%s", (idem,))
    if cur.fetchone():
        raise RuntimeError("00197 idempotency exists")
    lot = pick["lot_id"]
    qty = pick["quantity"]
    if lot is None:
        cur.execute(
            """
            SELECT quantity_on_hand FROM current_stock
            WHERE company_id=%s AND product_id=%s AND location_id=%s AND lot_id IS NULL AND package_id IS NULL
            FOR UPDATE
            """,
            (order["company_id"], pick["product_id"], RETURNS_LOCATION),
        )
    else:
        cur.execute(
            """
            SELECT quantity_on_hand FROM current_stock
            WHERE company_id=%s AND product_id=%s AND location_id=%s AND lot_id=%s AND package_id IS NULL
            FOR UPDATE
            """,
            (order["company_id"], pick["product_id"], RETURNS_LOCATION, lot),
        )
    existing = cur.fetchone()
    before = Decimal(existing["quantity_on_hand"]) if existing else Decimal("0")
    if lot is None:
        cur.execute(
            """
            INSERT INTO current_stock (company_id, product_id, location_id, warehouse_id, quantity_on_hand, last_movement_at, status)
            VALUES (%s, %s, %s, %s, %s, NOW(), 'available')
            ON CONFLICT (company_id, product_id, location_id) WHERE lot_id IS NULL AND package_id IS NULL
            DO UPDATE SET quantity_on_hand = current_stock.quantity_on_hand + EXCLUDED.quantity_on_hand,
                          version = current_stock.version + 1,
                          last_movement_at = NOW()
            RETURNING quantity_on_hand
            """,
            (order["company_id"], pick["product_id"], RETURNS_LOCATION, loc["warehouse_id"], qty),
        )
    else:
        cur.execute(
            """
            INSERT INTO current_stock (company_id, product_id, location_id, warehouse_id, lot_id, quantity_on_hand, last_movement_at, status)
            VALUES (%s, %s, %s, %s, %s, %s, NOW(), 'available')
            ON CONFLICT (company_id, product_id, location_id, lot_id) WHERE lot_id IS NOT NULL AND package_id IS NULL
            DO UPDATE SET quantity_on_hand = current_stock.quantity_on_hand + EXCLUDED.quantity_on_hand,
                          version = current_stock.version + 1,
                          last_movement_at = NOW()
            RETURNING quantity_on_hand
            """,
            (order["company_id"], pick["product_id"], RETURNS_LOCATION, loc["warehouse_id"], lot, qty),
        )
    after = Decimal(cur.fetchone()["quantity_on_hand"])
    if after != before + Decimal(qty):
        raise RuntimeError(f"00197 stock {before} -> {after}")
    cur.execute(
        """
        INSERT INTO inventory_ledger (
          company_id, product_id, lot_id, to_location_id, movement_type, quantity,
          quantity_before, quantity_after, reference_type, reference_id, operator_id, idempotency_key, notes
        ) VALUES (%s,%s,%s,%s,'return_receive',%s,%s,%s,'return_order',%s,%s,%s,%s)
        RETURNING id
        """,
        (order["company_id"], pick["product_id"], lot, RETURNS_LOCATION, qty, before, after, wh_id, actor, idem, "repair return_receive OMS-2026-00197"),
    )
    ledger_id = cur.fetchone()["id"]
    cur.execute("INSERT INTO ledger_idempotency (idempotency_key, ledger_id) VALUES (%s,%s)", (idem, ledger_id))
    cur.execute(
        """
        UPDATE oms_orders SET status='returned', returned_at=NOW()
        WHERE id=%s AND order_number=%s AND status='processing'
        """,
        (order["id"], order_number),
    )
    if cur.rowcount != 1:
        raise RuntimeError("00197 status")
    cur.execute(
        """
        INSERT INTO oms_order_events (oms_order_id, outbound_order_id, company_id, event_type, payload, created_by)
        VALUES (%s,%s,%s,'oms.returned',%s,%s)
        """,
        (order["id"], order["outbound_order_id"], order["company_id"], Json({"source": "repair", "inventory": "+1"}), actor),
    )
    cur.execute(
        """
        SELECT COUNT(*) AS n FROM inventory_ledger
        WHERE idempotency_key=%s AND movement_type='return_receive'
        """,
        (idem,),
    )
    if cur.fetchone()["n"] != 1:
        raise RuntimeError("00197 duplicate ledger")
    cur.execute("SELECT COUNT(*) AS n FROM cod_records WHERE oms_order_id=%s", (order["id"],))
    if cur.fetchone()["n"] != 0:
        raise RuntimeError("00197 COD")
    conn.commit()
    cur = conn.cursor()
    assert_fp(cur, fp, order_number)
    print("ok returned OMS-2026-00197 +1")


def preflight(conn):
    """Orders whose return bin cannot absorb a decrement stay at zero quantity change."""
    cur = conn.cursor()
    numbers = DELIVERED_DECREMENT + OFD_DECREMENT
    cur.execute(
        """
        SELECT l.company_id, l.product_id, l.to_location_id, l.lot_id,
               SUM(l.quantity) AS need,
               MIN(cs.quantity_on_hand) AS on_hand,
               MIN(cs.quantity_reserved) AS reserved,
               array_agg(o.order_number) AS orders
        FROM oms_orders o
        JOIN oms_returns r ON r.oms_order_id=o.id
        JOIN inventory_ledger l ON l.reference_type='return_order' AND l.reference_id=r.warehouse_return_id
             AND l.movement_type='return_receive'
        JOIN current_stock cs ON cs.company_id=l.company_id AND cs.product_id=l.product_id
             AND cs.location_id=l.to_location_id AND cs.lot_id IS NOT DISTINCT FROM l.lot_id
             AND cs.package_id IS NULL
        WHERE o.order_number = ANY(%s)
        GROUP BY l.company_id, l.product_id, l.to_location_id, l.lot_id
        """,
        (numbers,),
    )
    zero = {}
    groups = cur.fetchall()
    for row in groups:
        if str(row["to_location_id"]) != RETURNS_LOCATION:
            raise RuntimeError(f"preflight unexpected location {row}")
        avail = Decimal(row["on_hand"]) - Decimal(row["reserved"])
        if avail < Decimal(row["need"]):
            cur.execute(
                """
                SELECT COALESCE(o.order_number, sr.outbound_order_id::text) AS who, sr.quantity
                FROM stock_reservations sr
                LEFT JOIN oms_orders o ON o.outbound_order_id = sr.outbound_order_id
                WHERE sr.status = 'active'
                  AND sr.company_id = %s AND sr.product_id = %s AND sr.location_id = %s
                  AND sr.lot_id IS NOT DISTINCT FROM %s
                """,
                (row["company_id"], row["product_id"], row["to_location_id"], row["lot_id"]),
            )
            holders = [f"{h['who']}:{h['quantity']}" for h in cur.fetchall()]
            reason = "zero_net_reserved_by:" + ",".join(holders)
            for number in row["orders"]:
                zero[number] = reason
            print(f"preflight zero-qty {row['orders']} avail={avail} need={row['need']} {reason}")
        else:
            print(f"preflight decrement {row['orders']} avail={avail} need={row['need']}")
    conn.rollback()
    return zero


def main():
    conn = connect()
    fp = snapshot(conn)
    conn.rollback()
    zero = preflight(conn)
    zero["OMS-2026-04342"] = "zero_net_consumed_by_OMS-2026-07160"
    try:
        for number in DELIVERED_DECREMENT:
            repair_delivered(conn, fp, number, zero_stock=number in zero, reason=zero.get(number, "adjustment_negative"))
        for number in DELIVERED_ZERO:
            repair_delivered(conn, fp, number, zero_stock=True, reason=zero[number])
        repair_00012(conn, fp)
        repair_00197(conn, fp)
        for number in OFD_DRAFT:
            repair_ofd_draft(conn, fp, number)
        for number in OFD_DECREMENT:
            repair_ofd_decrement(conn, fp, number, zero_stock=number in zero, reason=zero.get(number, "adjustment_negative"))
        for number in OFD_STATUS:
            repair_ofd_status(conn, fp, number)
    except Exception:
        conn.rollback()
        raise
    cur = conn.cursor()
    cur.execute(
        """
        SELECT order_number, status::text FROM oms_orders
        WHERE order_number = ANY(%s) ORDER BY order_number
        """,
        (ALLOW,),
    )
    final = cur.fetchall()
    (OUT_DIR / "after-status.json").write_text(json.dumps(final, indent=2))
    print("done")
    for row in final:
        print(f"  {row['order_number']} {row['status']}")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"FAILED: {exc}", file=sys.stderr)
        sys.exit(1)
