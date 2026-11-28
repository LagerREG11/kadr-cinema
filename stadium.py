"""«Қайсар Арена» (Кызылорда, левый берег): схема секторов, матчи, места, покупка билетов (демо-оплата).

Факты: ~11 000 мест, поле 105×68 м, открыта в 2025 г., IV категория УЕФА.
Официальная схема секторов не опубликована — здесь приближённая схема: 4 трибуны, 20 секторов (~11 000 мест).
Матчи — демонстрационное расписание.
"""
from __future__ import annotations

import re
import secrets
from datetime import date, datetime, time, timedelta
from types import SimpleNamespace

from flask import Blueprint, jsonify

bp = Blueprint("stadium", __name__, url_prefix="/api/stadium")
_d = SimpleNamespace()

STADIUM = {
    "name": "Қайсар Арена",
    "city": {"kk": "Қызылорда, сол жағалау", "ru": "Кызылорда, левый берег"},
    "capacity": 11000,
    "pitch": [105, 68],
    "opened": 2025,
}

# трибуна: W — западная (центральная), E — восточная, N/S — за воротами
SECTORS = []
_PRICES = {"vip": 15000, "center": 5000, "side": 3500, "east": 3000, "end": 2000, "away": 2000}


def _add(stand, n, seats, kinds):
    for k in range(n):
        SECTORS.append({"id": f"{stand}{k + 1}", "stand": stand, "index": k, "count": n, "rows": 20, "seats": seats,
                        "kind": kinds[k], "price": _PRICES[kinds[k]]})


_add("W", 6, 30, ["side", "center", "vip", "vip", "center", "side"])
_add("E", 6, 30, ["east", "east", "center", "center", "east", "east"])
_add("N", 4, 24, ["end", "end", "end", "end"])
_add("S", 4, 24, ["end", "end", "end", "away"])
SECTORS_BY_ID = {s["id"]: s for s in SECTORS}
TOTAL_SEATS = sum(s["rows"] * s["seats"] for s in SECTORS)  # 11 040

TEAMS = ["Қайрат", "Астана", "Тобыл", "Ордабасы", "Ақтөбе", "Елімай", "Жетісу", "Атырау"]

SCHEMA = """
CREATE TABLE IF NOT EXISTS stadium_tickets (
    id INTEGER PRIMARY KEY,
    code TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    match_id TEXT NOT NULL,
    sector TEXT NOT NULL,
    seat TEXT NOT NULL,
    price INTEGER NOT NULL,
    card_last4 TEXT,
    created_at TEXT NOT NULL,
    UNIQUE (match_id, sector, seat)
);
"""


def setup(**deps):
    _d.__dict__.update(deps)


def init(conn):
    conn.executescript(SCHEMA)


def matches(today: date) -> list[dict]:
    """Демо-расписание: домашние матчи «Қайсара» по выходным."""
    out = []
    d = today + timedelta(days=(5 - today.weekday()) % 7 or 7)  # ближайшая суббота
    for k in range(6):
        day = d + timedelta(days=7 * k + (1 if k % 3 == 2 else 0))
        hh = 18 if k % 2 == 0 else 16
        out.append({
            "id": f"m{day:%Y%m%d}",
            "date": day.isoformat(),
            "time": f"{hh:02d}:00",
            "starts_at": datetime.combine(day, time(hh, 0)).isoformat(timespec="minutes"),
            "home": "Қайсар",
            "away": TEAMS[(today.toordinal() // 7 + k) % len(TEAMS)],
            "tournament": {"kk": "Премьер-лига (демо)", "ru": "Премьер-лига (демо)"},
        })
    return out


def find_match(mid: str):
    return next((m for m in matches(_d.now().date()) if m["id"] == mid), None)


@bp.get("")
def info():
    return jsonify(stadium=STADIUM, sectors=SECTORS, total=TOTAL_SEATS, matches=matches(_d.now().date()))


@bp.get("/matches/<mid>")
def match_view(mid):
    m = find_match(mid)
    if not m:
        return _d.err("not_found", 404)
    sold = {r[0]: r[1] for r in _d.db().execute(
        "SELECT sector, COUNT(*) FROM stadium_tickets WHERE match_id = ? GROUP BY sector", (mid,))}
    return jsonify(match=m, sold=sold)


@bp.get("/matches/<mid>/sectors/<sid>")
def sector_view(mid, sid):
    if not find_match(mid) or sid not in SECTORS_BY_ID:
        return _d.err("not_found", 404)
    taken = [r[0] for r in _d.db().execute("SELECT seat FROM stadium_tickets WHERE match_id = ? AND sector = ?", (mid, sid))]
    return jsonify(sector=SECTORS_BY_ID[sid], taken=taken)


SEAT_RE = re.compile(r"^(\d{1,2})-(\d{1,2})$")


@bp.post("/book")
def book():
    user = _d.current_user()
    if not user:
        return _d.err("auth_required", 401)
    d = _d.body()
    m = find_match(str(d.get("match_id", "")))
    sec = SECTORS_BY_ID.get(str(d.get("sector", "")))
    if not m or not sec:
        return _d.err("not_found", 404)
    if datetime.fromisoformat(m["starts_at"]) <= _d.now():
        return _d.err("show_started", 409)
    seats = d.get("seats") if isinstance(d.get("seats"), list) else []
    seats = list(dict.fromkeys(str(s) for s in seats))
    if not 1 <= len(seats) <= 6:
        return _d.err("bad_seats")
    for s in seats:
        mm = SEAT_RE.match(s)
        if not mm or not (1 <= int(mm.group(1)) <= sec["rows"] and 1 <= int(mm.group(2)) <= sec["seats"]):
            return _d.err("bad_seats")
    card_error, _brand, last4 = _d.check_card(d.get("card") or {})
    if card_error:
        return _d.err(card_error, 402 if card_error == "card_declined" else 400)
    code = "S" + secrets.token_hex(3).upper()
    ts = _d.now().isoformat(timespec="seconds")
    conn = _d.db()
    try:
        with conn:
            for s in seats:
                conn.execute("INSERT INTO stadium_tickets (code, user_id, match_id, sector, seat, price, card_last4, created_at) "
                             "VALUES (?, ?, ?, ?, ?, ?, ?, ?)", (code, user["id"], m["id"], sec["id"], s, sec["price"], last4, ts))
    except _d.IntegrityError:
        taken = {r[0] for r in conn.execute("SELECT seat FROM stadium_tickets WHERE match_id = ? AND sector = ?", (m["id"], sec["id"]))}
        return _d.err("seats_taken", 409, seats=sorted(set(seats) & taken))
    return jsonify(ticket={"code": code, "match": m, "sector": sec["id"], "seats": seats,
                           "total": sec["price"] * len(seats), "card_last4": last4}), 201


@bp.get("/my")
def my_tickets():
    user = _d.current_user()
    if not user:
        return _d.err("auth_required", 401)
    groups = {}
    for r in _d.db().execute("SELECT code, match_id, sector, seat, price FROM stadium_tickets WHERE user_id = ? ORDER BY id DESC", (user["id"],)):
        g = groups.setdefault(r["code"], {"code": r["code"], "match_id": r["match_id"], "sector": r["sector"], "seats": [], "total": 0})
        g["seats"].append(r["seat"])
        g["total"] += r["price"]
    for g in groups.values():
        g["match"] = find_match(g["match_id"])
    return jsonify(tickets=list(groups.values()))
