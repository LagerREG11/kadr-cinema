"""Театр им. Н. Бекежанова (Кызылорда): зал, демо-репертуар, места, покупка билетов (демо-оплата).

Зал воссоздан по панорамам официального 3D-тура театра: впереди партер с центральным проходом,
за ним крутой амфитеатр из трёх секций с двумя лестничными проходами, балкона нет.
Официальная схема зала не опубликована — число мест и цены приблизительные. Спектакли — демонстрационные.
"""
from __future__ import annotations

import re
import secrets
from datetime import date, datetime, time, timedelta
from types import SimpleNamespace

from flask import Blueprint, jsonify

bp = Blueprint("theatre", __name__, url_prefix="/api/theatre")
_d = SimpleNamespace()

THEATRE = {
    "name": {"kk": "Н. Бекежанов атындағы драма театры", "ru": "Драмтеатр им. Н. Бекежанова"},
    "full": {"kk": "Н. Бекежанов атындағы Қызылорда облыстық қазақ академиялық музыкалық драма театры",
             "ru": "Кызылординский областной казахский академический музыкально-драматический театр им. Н. Бекежанова"},
    "address": {"kk": "Қызылорда, Желтоқсан к-сі, 1", "ru": "Кызылорда, ул. Желтоксан, 1"},
    "founded": 1955,
}

# ряд → блоки мест слева направо (между блоками — проходы)
ZONES = {
    "front": {"rows": range(1, 6), "price": 4000},
    "parter": {"rows": range(6, 11), "price": 3500},
    "amfi": {"rows": range(11, 17), "price": 3000},
    "amfi_back": {"rows": range(17, 23), "price": 2500},
}
ROWS = []
for _r in range(1, 23):
    _zone = next(z for z, v in ZONES.items() if _r in v["rows"])
    _blocks = [16, 16] if _r <= 10 else [9, 16, 9]
    ROWS.append({"row": _r, "zone": _zone, "blocks": _blocks, "seats": sum(_blocks), "price": ZONES[_zone]["price"]})
ROWS_BY_N = {r["row"]: r for r in ROWS}
TOTAL_SEATS = sum(r["seats"] for r in ROWS)  # 728

# демо-репертуар: классика казахской драматургии
PLAYS = [
    {"id": "kyz-zhibek", "title": {"kk": "Қыз Жібек", "ru": "Кыз Жибек"}, "author": {"kk": "Ғ. Мүсірепов", "ru": "Г. Мусрепов"},
     "genre": {"kk": "музыкалық драма", "ru": "музыкальная драма"}, "minutes": 150, "age": "12+", "hue": 345},
    {"id": "akan-seri", "title": {"kk": "Ақан сері – Ақтоқты", "ru": "Акан сери – Актокты"}, "author": {"kk": "Ғ. Мүсірепов", "ru": "Г. Мусрепов"},
     "genre": {"kk": "трагедия", "ru": "трагедия"}, "minutes": 140, "age": "12+", "hue": 210},
    {"id": "enlik-kebek", "title": {"kk": "Еңлік – Кебек", "ru": "Енлик – Кебек"}, "author": {"kk": "М. Әуезов", "ru": "М. Ауэзов"},
     "genre": {"kk": "трагедия", "ru": "трагедия"}, "minutes": 130, "age": "14+", "hue": 20},
    {"id": "aiman-sholpan", "title": {"kk": "Айман – Шолпан", "ru": "Айман – Шолпан"}, "author": {"kk": "М. Әуезов", "ru": "М. Ауэзов"},
     "genre": {"kk": "музыкалық комедия", "ru": "музыкальная комедия"}, "minutes": 120, "age": "6+", "hue": 45},
    {"id": "kozy-korpesh", "title": {"kk": "Қозы Көрпеш – Баян сұлу", "ru": "Козы Корпеш – Баян сулу"}, "author": {"kk": "Ғ. Мүсірепов", "ru": "Г. Мусрепов"},
     "genre": {"kk": "лиро-эпикалық драма", "ru": "лиро-эпическая драма"}, "minutes": 140, "age": "12+", "hue": 160},
]
PLAYS_BY_ID = {p["id"]: p for p in PLAYS}

SCHEMA = """
CREATE TABLE IF NOT EXISTS theatre_tickets (
    id INTEGER PRIMARY KEY,
    code TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    show_id TEXT NOT NULL,
    seat TEXT NOT NULL,
    price INTEGER NOT NULL,
    card_last4 TEXT,
    created_at TEXT NOT NULL,
    UNIQUE (show_id, seat)
);
"""

SEAT_RE = re.compile(r"^(\d{1,2})-(\d{1,2})$")


def setup(**deps):
    _d.__dict__.update(deps)


def init(conn):
    conn.executescript(SCHEMA)


def shows(today: date) -> list[dict]:
    """Демо-афиша на 3 недели: чт–пт 19:00, сб 18:30, вс 12:00."""
    out = []
    for i in range(1, 22):
        day = today + timedelta(days=i)
        wd = day.weekday()
        if wd < 3:
            continue
        hh, mm = (12, 0) if wd == 6 else (18, 30) if wd == 5 else (19, 0)
        play = PLAYS[(day.toordinal() + wd) % len(PLAYS)]
        out.append({
            "id": f"t{day:%Y%m%d}-{hh:02d}{mm:02d}", "play": play, "date": day.isoformat(),
            "time": f"{hh:02d}:{mm:02d}", "starts_at": datetime.combine(day, time(hh, mm)).isoformat(timespec="minutes"),
        })
    return out


def find_show(sid: str):
    return next((s for s in shows(_d.now().date()) if s["id"] == sid), None)


@bp.get("")
def info():
    return jsonify(theatre=THEATRE, rows=ROWS, total=TOTAL_SEATS, shows=shows(_d.now().date()))


@bp.get("/shows/<sid>")
def show_view(sid):
    s = find_show(sid)
    if not s:
        return _d.err("not_found", 404)
    taken = [r[0] for r in _d.db().execute("SELECT seat FROM theatre_tickets WHERE show_id = ?", (sid,))]
    return jsonify(show=s, taken=taken)


@bp.post("/book")
def book():
    user = _d.current_user()
    if not user:
        return _d.err("auth_required", 401)
    d = _d.body()
    s = find_show(str(d.get("show_id", "")))
    if not s:
        return _d.err("not_found", 404)
    if datetime.fromisoformat(s["starts_at"]) <= _d.now():
        return _d.err("show_started", 409)
    seats = d.get("seats") if isinstance(d.get("seats"), list) else []
    seats = list(dict.fromkeys(str(x) for x in seats))
    if not 1 <= len(seats) <= 6:
        return _d.err("bad_seats")
    total = 0
    for x in seats:
        m = SEAT_RE.match(x)
        row = ROWS_BY_N.get(int(m.group(1))) if m else None
        if not row or not 1 <= int(m.group(2)) <= row["seats"]:
            return _d.err("bad_seats")
        total += row["price"]
    card_error, _brand, last4 = _d.check_card(d.get("card") or {})
    if card_error:
        return _d.err(card_error, 402 if card_error == "card_declined" else 400)
    code = "T" + secrets.token_hex(3).upper()
    ts = _d.now().isoformat(timespec="seconds")
    conn = _d.db()
    try:
        with conn:
            for x in seats:
                price = ROWS_BY_N[int(x.split("-")[0])]["price"]
                conn.execute("INSERT INTO theatre_tickets (code, user_id, show_id, seat, price, card_last4, created_at) "
                             "VALUES (?, ?, ?, ?, ?, ?, ?)", (code, user["id"], s["id"], x, price, last4, ts))
    except _d.IntegrityError:
        taken = {r[0] for r in conn.execute("SELECT seat FROM theatre_tickets WHERE show_id = ?", (s["id"],))}
        return _d.err("seats_taken", 409, seats=sorted(set(seats) & taken))
    return jsonify(ticket={"code": code, "show": s, "seats": seats, "total": total, "card_last4": last4}), 201


@bp.get("/my")
def my_tickets():
    user = _d.current_user()
    if not user:
        return _d.err("auth_required", 401)
    groups = {}
    for r in _d.db().execute("SELECT code, show_id, seat, price FROM theatre_tickets WHERE user_id = ? ORDER BY id DESC", (user["id"],)):
        g = groups.setdefault(r["code"], {"code": r["code"], "show_id": r["show_id"], "seats": [], "total": 0})
        g["seats"].append(r["seat"])
        g["total"] += r["price"]
    for g in groups.values():
        g["show"] = find_show(g["show_id"])
    return jsonify(tickets=list(groups.values()))
