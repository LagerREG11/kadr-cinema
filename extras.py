"""Дополнительные функции: места «вживую» (удержание), KADR-бонусы и значки,
подарочные сертификаты, рейтинги и отзывы.

Функции сервера (db, now, current_user, …) передаются через setup(), как в admin.py.
"""
from __future__ import annotations

import re
import secrets
import sqlite3
from datetime import datetime, timedelta
from types import SimpleNamespace

from flask import Blueprint, jsonify, session

import catalog as C
import dbconn
import store

bp = Blueprint("extras", __name__, url_prefix="/api")
_d = SimpleNamespace()

HOLD_MINUTES = 10
TOTAL_SEATS = len(C.ROWS) * C.SEATS_PER_ROW
BONUS_EARN = 0.05        # 5% от оплаченной картой суммы
BONUS_MAX_SHARE = 0.5    # бонусами можно оплатить до 50% заказа

SCHEMA = """
CREATE TABLE IF NOT EXISTS seat_holds (
    showtime_id TEXT NOT NULL,
    seat TEXT NOT NULL,
    holder TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    PRIMARY KEY (showtime_id, seat)
);
CREATE TABLE IF NOT EXISTS bonus_ledger (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    delta INTEGER NOT NULL,
    reason TEXT NOT NULL,
    booking_id INTEGER,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_bonus_user ON bonus_ledger(user_id);
CREATE TABLE IF NOT EXISTS gift_cards (
    code TEXT PRIMARY KEY,
    amount INTEGER NOT NULL,
    balance INTEGER NOT NULL,
    from_name TEXT,
    to_name TEXT,
    message TEXT,
    buyer_id INTEGER,
    card_last4 TEXT,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS reviews (
    user_id INTEGER NOT NULL,
    movie_id INTEGER NOT NULL,
    stars INTEGER NOT NULL,
    text TEXT,
    created_at TEXT NOT NULL,
    PRIMARY KEY (user_id, movie_id)
);
"""

BOOKING_COLUMNS = {"bonus_used": "INTEGER NOT NULL DEFAULT 0", "bonus_earned": "INTEGER NOT NULL DEFAULT 0",
                   "gift_used": "INTEGER NOT NULL DEFAULT 0", "gift_code": "TEXT", "paid": "INTEGER"}


def setup(**deps):
    _d.__dict__.update(deps)


def init(conn) -> None:
    conn.executescript(SCHEMA)
    if dbconn.IS_PG:
        for name, typ in BOOKING_COLUMNS.items():
            conn.execute(f"ALTER TABLE bookings ADD COLUMN IF NOT EXISTS {name} {typ}")
    else:
        cols = {r[1] for r in conn.execute("PRAGMA table_info(bookings)")}
        for name, typ in BOOKING_COLUMNS.items():
            if name not in cols:
                conn.execute(f"ALTER TABLE bookings ADD COLUMN {name} {typ}")
    conn.commit()


def db():
    return _d.db()


def now() -> datetime:
    return _d.now()


def err(*a, **kw):
    return _d.err(*a, **kw)


def _ts(dt: datetime) -> str:
    return dt.isoformat(timespec="seconds")


# ---------- Места «вживую»: удержание на 10 минут ----------
def holder_key() -> str:
    """Ключ удержания — свой у каждого браузера (работает и без входа)."""
    if not session.get("hk"):
        session["hk"] = secrets.token_hex(8)
    return session["hk"]


def _purge(conn) -> None:
    conn.execute("DELETE FROM seat_holds WHERE expires_at <= ?", (_ts(now()),))


def held_by_others(conn, show_id: str, holder: str | None) -> list[str]:
    _purge(conn)
    rows = conn.execute("SELECT seat FROM seat_holds WHERE showtime_id = ? AND holder != ?", (show_id, holder or "")).fetchall()
    return [r[0] for r in rows]


def release(conn, show_id: str, holder: str) -> None:
    conn.execute("DELETE FROM seat_holds WHERE showtime_id = ? AND holder = ?", (show_id, holder))


def occupancy(conn, show_ids: list[str]) -> dict[str, int]:
    """Сколько мест занято (продано + удерживается) у каждого сеанса."""
    if not show_ids:
        return {}
    _purge(conn)
    marks = ",".join("?" * len(show_ids))
    out = {sid: 0 for sid in show_ids}
    for r in conn.execute(f"SELECT showtime_id, COUNT(*) FROM booking_seats WHERE showtime_id IN ({marks}) GROUP BY showtime_id", show_ids):
        out[r[0]] += r[1]
    for r in conn.execute(f"SELECT showtime_id, COUNT(*) FROM seat_holds WHERE showtime_id IN ({marks}) GROUP BY showtime_id", show_ids):
        out[r[0]] += r[1]
    return out


@bp.post("/holds")
def hold_seats():
    """Заменить удержания этого браузера на сеансе указанными местами. Чужие и проданные места не удерживаются."""
    d = _d.body()
    conn = db()
    show = store.find_show(conn, str(d.get("showtime_id", "")))
    if not show:
        return err("not_found", 404)
    seats = d.get("seats") if isinstance(d.get("seats"), list) else []
    seats = [s for s in dict.fromkeys(str(x) for x in seats) if C.valid_seat(s)][: C.MAX_SEATS_PER_ORDER]
    key = holder_key()
    expires = _ts(now() + timedelta(minutes=HOLD_MINUTES))
    held, conflicts = [], []
    with conn:
        _purge(conn)
        release(conn, show["id"], key)
        sold = {r[0] for r in conn.execute("SELECT seat FROM booking_seats WHERE showtime_id = ?", (show["id"],))}
        for s in seats:
            if s in sold:
                conflicts.append(s)
                continue
            cur = conn.execute("INSERT OR IGNORE INTO seat_holds (showtime_id, seat, holder, expires_at) VALUES (?, ?, ?, ?)",
                               (show["id"], s, key, expires))
            (held if cur.rowcount else conflicts).append(s)
    return jsonify(held=held, conflicts=conflicts, expires_in=HOLD_MINUTES * 60)


# ---------- KADR-бонусы и значки ----------
def bonus_balance(conn, user_id: int) -> int:
    return conn.execute("SELECT COALESCE(SUM(delta), 0) FROM bonus_ledger WHERE user_id = ?", (user_id,)).fetchone()[0]


BADGES = ("first", "premiere", "night", "family", "vip", "five", "ten", "critic")


def badges(conn, user_id: int) -> list[str]:
    got = set()
    rows = conn.execute("SELECT id, showtime_id FROM bookings WHERE user_id = ?", (user_id,)).fetchall()
    if rows:
        got.add("first")
    if len(rows) >= 5:
        got.add("five")
    if len(rows) >= 10:
        got.add("ten")
    for r in rows:
        show = store.find_show(conn, r["showtime_id"], include_cancelled=True)
        if not show:
            continue
        start = datetime.fromisoformat(show["starts_at"])
        if start.hour >= 22 or start.hour < 4:
            got.add("night")
        m = store.movie(conn, show["movie_id"])
        if m and m.get("release"):
            rel = datetime.fromisoformat(m["release"]).date()
            if 0 <= (start.date() - rel).days < C.PRESALE_DAYS:
                got.add("premiere")
        for s in conn.execute("SELECT ticket_type FROM booking_seats WHERE booking_id = ?", (r["id"],)):
            if s["ticket_type"] == "child":
                got.add("family")
            if s["ticket_type"] == "vip":
                got.add("vip")
    if conn.execute("SELECT COUNT(*) FROM reviews WHERE user_id = ?", (user_id,)).fetchone()[0] >= 3:
        got.add("critic")
    return [b for b in BADGES if b in got]


@bp.get("/me/bonus")
def my_bonus():
    user = _d.current_user()
    if not user:
        return err("auth_required", 401)
    conn = db()
    history = [dict(r) for r in conn.execute(
        "SELECT delta, reason, created_at FROM bonus_ledger WHERE user_id = ? ORDER BY id DESC LIMIT 20", (user["id"],))]
    return jsonify(balance=bonus_balance(conn, user["id"]), badges=badges(conn, user["id"]), all_badges=list(BADGES),
                   history=history, earn_percent=int(BONUS_EARN * 100), max_share=int(BONUS_MAX_SHARE * 100))


# ---------- Подарочные сертификаты ----------
CODE_RE = re.compile(r"^KADR-[A-Z0-9]{4}-[A-Z0-9]{4}$")
_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def new_gift_code() -> str:
    part = lambda: "".join(secrets.choice(_ALPHABET) for _ in range(4))  # noqa: E731
    return f"KADR-{part()}-{part()}"


def gift_row(conn, code: str):
    code = str(code or "").strip().upper()
    if not CODE_RE.match(code):
        return None
    return conn.execute("SELECT * FROM gift_cards WHERE code = ?", (code,)).fetchone()


@bp.get("/gift/<code>")
def gift_view(code):
    r = gift_row(db(), code)
    if not r:
        return err("gift_not_found", 404)
    return jsonify(gift={"code": r["code"], "amount": r["amount"], "balance": r["balance"], "from": r["from_name"],
                         "to": r["to_name"], "message": r["message"], "created_at": r["created_at"]})


@bp.post("/gift")
def gift_buy():
    user = _d.current_user()
    if not user:
        return err("auth_required", 401)
    d = _d.body()
    try:
        amount = int(d.get("amount", 0))
    except (TypeError, ValueError):
        return err("bad_amount")
    if not 1000 <= amount <= 100000 or amount % 500:
        return err("bad_amount")
    to_name = str(d.get("to_name", "")).strip()[:40]
    from_name = str(d.get("from_name", "")).strip()[:40] or user["name"][:40]
    message = str(d.get("message", "")).strip()[:300]
    if not to_name:
        return err("bad_to_name")
    card_error, _brand, last4 = _d.check_card(d.get("card") or {})
    if card_error:
        return err(card_error, 402 if card_error == "card_declined" else 400)
    conn = db()
    code = None
    for _ in range(5):
        candidate = new_gift_code()
        try:
            with conn:
                conn.execute("INSERT INTO gift_cards (code, amount, balance, from_name, to_name, message, buyer_id, card_last4, created_at) "
                             "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                             (candidate, amount, amount, from_name, to_name, message, user["id"], last4, _ts(now())))
            code = candidate
            break
        except dbconn.IntegrityError:  # совпал код — пробуем другой
            continue
    if not code:
        return err("generic", 500)
    return jsonify(code=code), 201


# ---------- Рейтинги и отзывы ----------
def ratings(conn) -> dict[int, dict]:
    return {r[0]: {"avg": round(float(r[1]), 1), "count": int(r[2])}
            for r in conn.execute("SELECT movie_id, AVG(stars), COUNT(*) FROM reviews GROUP BY movie_id")}


def can_review(conn, user_id: int, movie_id: int) -> bool:
    """Отзыв может оставить только тот, кто купил билет на уже начавшийся сеанс этого фильма."""
    for r in conn.execute("SELECT showtime_id FROM bookings WHERE user_id = ?", (user_id,)).fetchall():
        show = store.find_show(conn, r[0], include_cancelled=True)
        if show and show["movie_id"] == movie_id and datetime.fromisoformat(show["starts_at"]) <= now():
            return True
    return False


@bp.get("/movies/<int:movie_id>/reviews")
def movie_reviews(movie_id):
    conn = db()
    if not store.movie(conn, movie_id):
        return err("not_found", 404)
    user = _d.current_user()
    items = []
    for r in conn.execute(
        "SELECT r.user_id, r.stars, r.text, r.created_at, u.name FROM reviews r JOIN users u ON u.id = r.user_id "
        "WHERE r.movie_id = ? ORDER BY r.created_at DESC LIMIT 30", (movie_id,)
    ):
        items.append({"user_id": r["user_id"], "stars": r["stars"], "text": r["text"], "created_at": r["created_at"],
                      "name": (r["name"] or "").split(" ")[0], "mine": bool(user and user["id"] == r["user_id"])})
    summary = ratings(conn).get(movie_id, {"avg": None, "count": 0})
    return jsonify(summary=summary, items=items,
                   can_review=bool(user and can_review(conn, user["id"], movie_id)),
                   is_admin=bool(user and _d.is_admin(user)))


@bp.post("/movies/<int:movie_id>/reviews")
def post_review(movie_id):
    user = _d.current_user()
    if not user:
        return err("auth_required", 401)
    conn = db()
    if not store.movie(conn, movie_id):
        return err("not_found", 404)
    if not can_review(conn, user["id"], movie_id):
        return err("review_not_allowed", 403)
    d = _d.body()
    try:
        stars = int(d.get("stars", 0))
    except (TypeError, ValueError):
        stars = 0
    if not 1 <= stars <= 5:
        return err("bad_stars")
    text = str(d.get("text", "")).strip()[:500]
    with conn:
        conn.execute("INSERT INTO reviews (user_id, movie_id, stars, text, created_at) VALUES (?, ?, ?, ?, ?) "
                     "ON CONFLICT(user_id, movie_id) DO UPDATE SET stars = excluded.stars, text = excluded.text, created_at = excluded.created_at",
                     (user["id"], movie_id, stars, text, _ts(now())))
    return jsonify(ok=True, summary=ratings(conn).get(movie_id))


@bp.delete("/admin/reviews/<int:movie_id>/<int:user_id>")
def delete_review(movie_id, user_id):
    user = _d.current_user()
    if not user or not _d.is_admin(user):
        return err("forbidden", 403)
    conn = db()
    with conn:
        conn.execute("DELETE FROM reviews WHERE movie_id = ? AND user_id = ?", (movie_id, user_id))
    return jsonify(ok=True)
