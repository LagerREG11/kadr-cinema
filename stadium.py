"""Стадионы: схема секторов, матчи, места, покупка билетов (демо-оплата).

«Қайсар Арена» (Кызылорда): ~11 000 мест, открыта в 2025 г. Официальная схема не опубликована —
приближённая схема: 4 трибуны, 20 секторов.
Центральный стадион (Алматы): ~23 800 мест, 1958 г., легкоатлетические дорожки вокруг поля.
Схема по официальной карте: 60 секторов, на Западной и Восточной трибунах — два яруса, ложи на Западной.
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
    "id": "kaisar", "shape": "rect", "city_id": "kzo", "prefix": "m", "home": "Қайсар",
    "name": {"kk": "Қайсар Арена", "ru": "Қайсар Арена"},
    "city": {"kk": "Қызылорда, сол жағалау", "ru": "Кызылорда, левый берег"},
    "facts": {"kk": "11 000 орын · алаң 105×68 м · УЕФА IV санаты", "ru": "11 000 мест · поле 105×68 м · УЕФА IV категория"},
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

# ---------- Центральный стадион, Алматы ----------
# угол a — по эллипсу вокруг поля: 0° — север (ворота 6), 90° — восток, 180° — юг, 270° (−90°) — запад
CENTRAL = {
    "id": "central", "shape": "oval", "city_id": "ala", "prefix": "c", "home": "Қайрат",
    "name": {"kk": "Орталық стадион", "ru": "Центральный стадион"},
    "city": {"kk": "Алматы, Сәтбаев көшесі, 29/3", "ru": "Алматы, ул. Сатпаева, 29/3"},
    "facts": {"kk": "~23 800 орын · 1958 жылдан · жеңіл атлетика жолдары", "ru": "~23 800 мест · с 1958 года · легкоатлетические дорожки"},
    "capacity": 23804,
    "pitch": [105, 68],
    "opened": 1958,
}
_CPRICES = {"vip": 12000, "lodge": 8000, "west": 4000, "center": 4000, "east": 3000, "end": 2000}
C_SECTORS = []


def _arc(ids, stand, tier, a0, a1, rows, seats, kind_of):
    step = (a1 - a0) / len(ids)
    for i, n in enumerate(ids):
        kind = kind_of(n)
        C_SECTORS.append({"id": str(n), "stand": stand, "tier": tier, "a0": round(a0 + i * step, 2), "a1": round(a0 + (i + 1) * step, 2),
                          "rows": rows, "seats": seats, "kind": kind, "price": _CPRICES[kind]})


_arc(range(1, 10), "W", 0, -125, -55, 22, 16, lambda n: "west")
_arc(range(10, 18), "W", 1, -120, -60, 14, 18, lambda n: "vip" if n in (13, 14) else "lodge" if n in (12, 15) else "west")
_arc(range(18, 29), "N", 0, -50, 50, 22, 24, lambda n: "end")
_arc(range(29, 38), "E", 0, 55, 125, 22, 16, lambda n: "center" if n in (33, 34, 35) else "east")
_arc(range(38, 49), "E", 1, 52, 128, 14, 20, lambda n: "center" if n in (43, 44, 45) else "east")
_arc(range(49, 61), "S", 0, 130, 230, 22, 24, lambda n: "end")
C_SECTORS_BY_ID = {s["id"]: s for s in C_SECTORS}
C_TOTAL = sum(s["rows"] * s["seats"] for s in C_SECTORS)  # 23 576

# ---------- Almaty Arena (ледовая арена) ----------
# Схема по официальной карте: нижний ярус A1–A4 (у главного входа) и B1–B10, верхний ярус C1–C13
# (разрыв над главным входом). Число мест в секторе считается по длине дуги ряда.
import math

ARENA = {
    "id": "arena", "shape": "arena", "city_id": "ala", "prefix": "h", "home": "Барыс",
    "name": {"kk": "Almaty Arena", "ru": "Almaty Arena"},
    "city": {"kk": "Алматы, Нұркент шағынауданы, 7", "ru": "Алматы, мкр. Нуркент, 7"},
    "facts": {"kk": "~12 000 орын · мұз аренасы · 2016 жылдан", "ru": "~12 000 мест · ледовая арена · с 2016 года"},
    "capacity": 12000, "opened": 2016,
    "teams": ["ЦСКА", "СКА", "Ак Барс", "Авангард", "Металлург Мг", "Салават Юлаев", "Трактор", "Локомотив"],
    "tournament": {"kk": "КХЛ (демо)", "ru": "КХЛ (демо)"},
}
# контур чаши — прямоугольник со скруглёнными углами вокруг площадки 60×30
A_HX, A_HZ, A_R = 33.0, 18.0, 11.0
A_LOW = {"off": 0.0, "d": 0.85, "rows": 15}
A_UP = {"off": 17.5, "d": 0.85, "rows": 13}
A_SEAT_W = 0.55


def arena_point(a, off):
    dx, dz = math.cos(math.radians(a)), math.sin(math.radians(a))
    hx, hz, r = A_HX + off, A_HZ + off, A_R + off
    lo, hi = 0.0, hx + hz + 10
    for _ in range(30):
        t = (lo + hi) / 2
        ex, ez = max(abs(dx * t) - (hx - r), 0), max(abs(dz * t) - (hz - r), 0)
        if ex * ex + ez * ez <= r * r:
            lo = t
        else:
            hi = t
    return dx * lo, dz * lo


def _arc_len(a0, a1, off):
    pts = [arena_point(a0 + (a1 - a0) * i / 24, off) for i in range(25)]
    return sum(math.dist(pts[i], pts[i + 1]) for i in range(24))


_APRICES = {"premium": 15000, "lower": 8000, "upper": 4000}
A_SECTORS = []


def _asec(sid, tier, a0, a1, kind):
    g = A_UP if tier else A_LOW
    mid_off = g["off"] + g["d"] * g["rows"] / 2
    seats = max(8, int(_arc_len(a0, a1, mid_off) * 0.92 / A_SEAT_W))
    A_SECTORS.append({"id": sid, "stand": sid[0], "tier": tier, "a0": a0, "a1": a1, "rows": g["rows"], "seats": seats,
                      "kind": kind, "price": _APRICES[kind]})


def _angle_table(off):
    """Таблица (угол, длина дуги от угла 0° по часовой) для контура с отступом off."""
    tab, total, prev = [(0.0, 0.0)], 0.0, arena_point(0, off)
    for i in range(1, 1441):
        a = i * 0.25
        cur = arena_point(a, off)
        total += math.dist(prev, cur)
        tab.append((a, total))
        prev = cur
    return tab, total


def _angle_at(tab, length):
    for (a0, l0), (a1, l1) in zip(tab, tab[1:]):
        if l1 >= length:
            return a0 + (a1 - a0) * ((length - l0) / max(l1 - l0, 1e-9))
    return tab[-1][0]


# нижний ярус: длины участков по контуру (м) от середины правого торца по часовой стрелке
_ltab, _lp = _angle_table(0.0)
_q = math.pi / 2 * A_R / 2  # половина углового скругления
_side = (2 * (A_HX - A_R) - 2 * 16) / 2  # кусок длинной стороны у угла
_LOWER = [("B3", _q), ("B4", _q + _side), ("B5", 16), ("B6", 16), ("B7", _side + _q), ("B8", _q), ("B9", 2 * (A_HZ - A_R)),
          ("B10", _q), ("A4", _q + _side), ("A3", 16), ("A2", 16), ("A1", _side + _q), ("B1", _q)]
_pos = (A_HZ - A_R)  # начало B3 — конец половины торцевого участка B2
_asec_raw = [("B2", _angle_at(_ltab, _lp - (A_HZ - A_R)) - 360, _angle_at(_ltab, _pos))]
for sid, ln in _LOWER:
    _asec_raw.append((sid, _angle_at(_ltab, _pos), _angle_at(_ltab, _pos + ln)))
    _pos += ln
for sid, a0, a1 in sorted(_asec_raw, key=lambda x: (x[0][0], int(x[0][1:]))):
    _asec(sid, 0, round(a0 if a0 <= 180 else a0 - 360, 2), round(a1 if a1 <= 180 or a0 <= 180 else a1 - 360, 2), "premium" if sid[0] == "A" else "lower")
# верхний ярус: 13 равных секторов, разрыв над главным входом (верх схемы, угол 270°)
_utab, _up = _angle_table(A_UP["off"] + A_UP["d"] * A_UP["rows"] / 2)
_gap = _up * 0.06
_top = next(l for a, l in _utab if a >= 270)
_start = _top + _gap / 2
for n in range(13):
    l0 = _start + n * (_up - _gap) / 13
    l1 = l0 + (_up - _gap) / 13
    a0, a1 = _angle_at(_utab, l0 % _up), _angle_at(_utab, l1 % _up)
    if a1 < a0:
        a1 += 360
    _asec(f"C{n + 1}", 1, round(a0, 2), round(a1, 2), "upper")
A_SECTORS_BY_ID = {s["id"]: s for s in A_SECTORS}
A_TOTAL = sum(s["rows"] * s["seats"] for s in A_SECTORS)

STADIUMS = {
    "kaisar": {"info": STADIUM, "sectors": SECTORS, "by_id": SECTORS_BY_ID, "total": TOTAL_SEATS},
    "central": {"info": CENTRAL, "sectors": C_SECTORS, "by_id": C_SECTORS_BY_ID, "total": C_TOTAL},
    "arena": {"info": ARENA, "sectors": A_SECTORS, "by_id": A_SECTORS_BY_ID, "total": A_TOTAL},
}

TEAMS = ["Қайрат", "Астана", "Тобыл", "Ордабасы", "Ақтөбе", "Елімай", "Жетісу", "Атырау", "Қайсар"]

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


def matches(today: date, sid: str = "kaisar") -> list[dict]:
    """Демо-расписание: домашние матчи хозяев стадиона по выходным."""
    st = STADIUMS[sid]["info"]
    teams = st.get("teams") or [t for t in TEAMS if t != st["home"]]
    out = []
    d = today + timedelta(days=(5 - today.weekday()) % 7 or 7)  # ближайшая суббота
    for k in range(6):
        if sid == "arena":  # хоккей: по средам и пятницам вечером
            day = d + timedelta(days=7 * k - (3 if k % 2 else 1))
            hh = 19
        else:
            shift = 1 if sid == "central" else 0  # «Қайрат» — по воскресеньям
            day = d + timedelta(days=7 * k + ((1 if k % 3 == 2 else 0) if not shift else (0 if k % 3 == 2 else 1)))
            hh = (18, 15, 13, 20, 16, 19)[k]  # днём, на закате и вечером
        out.append({
            "id": f"{st['prefix']}{day:%Y%m%d}", "stadium": sid,
            "date": day.isoformat(),
            "time": f"{hh:02d}:00",
            "starts_at": datetime.combine(day, time(hh, 0)).isoformat(timespec="minutes"),
            "home": st["home"],
            "away": teams[(today.toordinal() // 7 + k) % len(teams)],
            "tournament": st.get("tournament") or {"kk": "Премьер-лига (демо)", "ru": "Премьер-лига (демо)"},
        })
    return out


def find_match(mid: str):
    for sid, st in STADIUMS.items():
        if mid[:1] == st["info"]["prefix"]:
            return next((m for m in matches(_d.now().date(), sid) if m["id"] == mid), None)
    return None


def _sectors_of(m):
    return STADIUMS[m["stadium"]]["by_id"]


@bp.get("")
def info():
    from flask import request
    q = request.args
    sid = q.get("id") or next((k for k, v in STADIUMS.items() if v["info"]["city_id"] == q.get("city")), "kaisar")
    st = STADIUMS.get(sid, STADIUMS["kaisar"])
    sid = st["info"]["id"]
    return jsonify(stadium=st["info"], sectors=st["sectors"], total=st["total"], matches=matches(_d.now().date(), sid))


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
    m = find_match(mid)
    if not m or sid not in _sectors_of(m):
        return _d.err("not_found", 404)
    taken = [r[0] for r in _d.db().execute("SELECT seat FROM stadium_tickets WHERE match_id = ? AND sector = ?", (mid, sid))]
    return jsonify(sector=_sectors_of(m)[sid], taken=taken)


SEAT_RE = re.compile(r"^(\d{1,2})-(\d{1,2})$")


@bp.post("/book")
def book():
    user = _d.current_user()
    if not user:
        return _d.err("auth_required", 401)
    d = _d.body()
    m = find_match(str(d.get("match_id", "")))
    sec = _sectors_of(m).get(str(d.get("sector", ""))) if m else None
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
    code = {"kaisar": "S", "central": "C", "arena": "H"}[m["stadium"]] + secrets.token_hex(3).upper()
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
        sid = next((k for k, v in STADIUMS.items() if v["info"]["prefix"] == g["match_id"][:1]), "kaisar")
        g["stadium"] = STADIUMS[sid]["info"]["name"]
    return jsonify(tickets=list(groups.values()))
