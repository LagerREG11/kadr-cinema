"""KADR Cinema — учебный сайт кинотеатра (Flask + SQLite).

Афиша и расписание, выбор мест, регистрация/вход, демо-оплата и билеты.
Оплата ДЕМОНСТРАЦИОННАЯ: карта проверяется только по формату, деньги не списываются,
полный номер карты и CVC нигде не сохраняются (только платёжная система и последние 4 цифры).

Запуск:  .venv\\Scripts\\python.exe server.py   →  http://127.0.0.1:5173
"""
from __future__ import annotations

import mimetypes
import os
import re
import secrets
import sqlite3
import sys
import time
from collections import defaultdict, deque
from datetime import date, datetime, timedelta, timezone

from flask import Flask, g, jsonify, request, send_from_directory, session
from werkzeug.middleware.proxy_fix import ProxyFix
from werkzeug.security import check_password_hash, generate_password_hash

import catalog as C
import posters

mimetypes.add_type("application/manifest+json", ".webmanifest")
BASE = os.path.dirname(os.path.abspath(__file__))
INSTANCE = os.path.join(BASE, "instance")
os.makedirs(INSTANCE, exist_ok=True)
DB_PATH = os.environ.get("CINEMA_DB", os.path.join(INSTANCE, "cinema.db"))


CINEMA_TZ = timezone(timedelta(hours=int(os.environ.get("CINEMA_UTC_OFFSET", "5"))))
# на хостинге (HTTPS) cookie сессии отправляется только по защищённому соединению
ON_HOSTING = bool(os.environ.get("RENDER") or os.environ.get("COOKIE_SECURE"))


def _secret_key() -> str:
    if os.environ.get("SECRET_KEY"):
        return os.environ["SECRET_KEY"]
    path = os.path.join(INSTANCE, "secret_key")
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            return f.read().strip()
    key = secrets.token_hex(32)
    with open(path, "w", encoding="utf-8") as f:
        f.write(key)
    return key


app = Flask(__name__, static_folder="static", static_url_path="")
app.config.update(
    SECRET_KEY=_secret_key(),
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=ON_HOSTING,
    PERMANENT_SESSION_LIFETIME=timedelta(days=14),
    MAX_CONTENT_LENGTH=64 * 1024,
)
app.json.ensure_ascii = False
if ON_HOSTING:
    # хостинг стоит за прокси: берём реальный IP клиента и https из заголовков прокси
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1)

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    showtime_id TEXT NOT NULL,
    total INTEGER NOT NULL,
    card_brand TEXT,
    card_last4 TEXT,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS booking_seats (
    booking_id INTEGER NOT NULL REFERENCES bookings(id),
    showtime_id TEXT NOT NULL,
    seat TEXT NOT NULL,
    ticket_type TEXT NOT NULL,
    price INTEGER NOT NULL,
    UNIQUE (showtime_id, seat)
);
CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id);
"""


def db() -> sqlite3.Connection:
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA foreign_keys = ON")
    return g.db


@app.teardown_appcontext
def _close_db(_exc):
    conn = g.pop("db", None)
    if conn is not None:
        conn.close()


def init_db() -> None:
    conn = sqlite3.connect(DB_PATH)
    conn.executescript(SCHEMA)
    conn.execute("PRAGMA journal_mode = WAL")
    conn.close()


def err(code: str, status: int = 400, **extra):
    return jsonify(error=code, **extra), status


def now() -> datetime:
    """Местное время кинотеатра (Казахстан, UTC+5), независимо от часового пояса сервера/хостинга."""
    return datetime.now(CINEMA_TZ).replace(tzinfo=None)


# ---------- Защита запросов ----------
@app.before_request
def _csrf_guard():
    """Изменяющие запросы к API — только JSON с собственным заголовком (браузер не даст подделать с чужого сайта)."""
    if request.path.startswith("/api/") and request.method not in ("GET", "HEAD", "OPTIONS"):
        if request.headers.get("X-Requested-With") != "fetch" or not request.is_json:
            return err("bad_request", 400)


@app.after_request
def _security_headers(resp):
    resp.headers.setdefault("X-Content-Type-Options", "nosniff")
    resp.headers.setdefault("X-Frame-Options", "DENY")
    resp.headers.setdefault("Referrer-Policy", "same-origin")
    if request.path.startswith("/api/"):
        resp.headers.setdefault("Cache-Control", "no-store")
    return resp


_login_fails: dict[str, deque] = defaultdict(deque)


def _too_many_fails(key: str) -> bool:
    q = _login_fails[key]
    cutoff = time.time() - 600
    while q and q[0] < cutoff:
        q.popleft()
    return len(q) >= 8


def current_user():
    uid = session.get("uid")
    if not uid:
        return None
    return db().execute("SELECT id, name, email, phone, created_at FROM users WHERE id = ?", (uid,)).fetchone()


def user_json(row) -> dict | None:
    return dict(row) if row else None


# ---------- Авторизация ----------
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
PHONE_RE = re.compile(r"^\+?[0-9 ()-]{10,18}$")


def _body() -> dict:
    data = request.get_json(silent=True)
    return data if isinstance(data, dict) else {}


@app.get("/api/me")
def me():
    return jsonify(user=user_json(current_user()))


@app.post("/api/register")
def register():
    d = _body()
    name = str(d.get("name", "")).strip()
    email = str(d.get("email", "")).strip().lower()
    phone = str(d.get("phone", "")).strip()
    password = str(d.get("password", ""))
    if not 2 <= len(name) <= 60:
        return err("bad_name")
    if not EMAIL_RE.match(email) or len(email) > 120:
        return err("bad_email")
    if phone and not PHONE_RE.match(phone):
        return err("bad_phone")
    if len(password) < 8 or not re.search(r"[A-Za-zА-Яа-яЁёӘәҒғҚқҢңӨөҰұҮүҺһІі]", password) or not re.search(r"\d", password):
        return err("weak_password")
    try:
        cur = db().execute(
            "INSERT INTO users (name, email, phone, password_hash, created_at) VALUES (?, ?, ?, ?, ?)",
            (name, email, phone or None, generate_password_hash(password), now().isoformat(timespec="seconds")),
        )
        db().commit()
    except sqlite3.IntegrityError:
        return err("email_taken", 409)
    session.clear()
    session.permanent = True
    session["uid"] = cur.lastrowid
    return jsonify(user=user_json(current_user())), 201


@app.post("/api/login")
def login():
    d = _body()
    email = str(d.get("email", "")).strip().lower()
    password = str(d.get("password", ""))
    key = f"{request.remote_addr}|{email}"
    if _too_many_fails(key):
        return err("too_many_attempts", 429)
    row = db().execute("SELECT id, password_hash FROM users WHERE email = ?", (email,)).fetchone()
    if not row or not check_password_hash(row["password_hash"], password):
        _login_fails[key].append(time.time())
        return err("bad_credentials", 401)
    _login_fails.pop(key, None)
    session.clear()
    session.permanent = True
    session["uid"] = row["id"]
    return jsonify(user=user_json(current_user()))


@app.post("/api/logout")
def logout():
    session.clear()
    return jsonify(ok=True)


# ---------- Каталог и расписание ----------
def _day_range() -> list[date]:
    return C.days_for(now().date())


@app.get("/api/posters")
def posters_view():
    """Официальные постеры и длительность с TMDB (пусто, если ключ не задан)."""
    data = posters.for_movies(C.MOVIES)
    resp = jsonify(
        enabled=posters.enabled(),
        movies={str(mid): {k: v for k, v in info.items() if k in ("poster", "runtime")} for mid, info in data.items()},
    )
    resp.headers["Cache-Control"] = "public, max-age=3600"
    return resp


def _with_state(show: dict) -> dict:
    s = dict(show)
    s["past"] = datetime.fromisoformat(show["starts_at"]) <= now()
    return s


@app.get("/api/catalog")
def catalog_view():
    return jsonify(
        cinema=C.CINEMA,
        halls=C.HALLS,
        movies=C.MOVIES,
        days=[d.isoformat() for d in _day_range()],
        layout={"rows": C.ROWS, "seats": C.SEATS_PER_ROW, "vip_rows": sorted(C.VIP_ROWS), "max_seats": C.MAX_SEATS_PER_ORDER},
    )


@app.get("/api/schedule")
def schedule():
    try:
        day = date.fromisoformat(request.args.get("date", ""))
    except ValueError:
        day = now().date()
    if day not in _day_range():
        return err("bad_date")
    return jsonify(date=day.isoformat(), shows=[_with_state(s) for s in C.schedule_for(day)])


def _taken(showtime_id: str) -> list[str]:
    rows = db().execute("SELECT seat FROM booking_seats WHERE showtime_id = ?", (showtime_id,)).fetchall()
    return [r["seat"] for r in rows]


@app.get("/api/showtimes/<showtime_id>")
def showtime(showtime_id):
    show = C.find_showtime(showtime_id)
    if not show:
        return err("not_found", 404)
    return jsonify(show=_with_state(show), movie=C.MOVIES_BY_ID[show["movie_id"]], taken=_taken(showtime_id))


# ---------- Демо-оплата и бронирование ----------
def luhn_ok(number: str) -> bool:
    total = 0
    for i, ch in enumerate(reversed(number)):
        n = int(ch)
        if i % 2 == 1:
            n *= 2
            if n > 9:
                n -= 9
        total += n
    return total % 10 == 0


def card_brand(number: str) -> str:
    if number.startswith("4"):
        return "Visa"
    if re.match(r"^(5[1-5]|2[2-7])", number):
        return "Mastercard"
    if number.startswith("9"):
        return "Local"
    return "Card"


def check_card(card: dict) -> tuple[str | None, str, str]:
    """Возвращает (ошибка, бренд, последние 4 цифры). Карта не сохраняется."""
    number = re.sub(r"\D", "", str(card.get("number", "")))
    exp = str(card.get("exp", "")).strip()
    cvc = str(card.get("cvc", "")).strip()
    holder = str(card.get("holder", "")).strip()
    if not 13 <= len(number) <= 19 or not luhn_ok(number):
        return "bad_card_number", "", ""
    m = re.match(r"^(\d{2})\s*/\s*(\d{2})$", exp)
    if not m or not 1 <= int(m.group(1)) <= 12:
        return "bad_card_exp", "", ""
    month, year = int(m.group(1)), 2000 + int(m.group(2))
    if (year, month) < (now().year, now().month):
        return "card_expired", "", ""
    if not re.match(r"^\d{3,4}$", cvc):
        return "bad_card_cvc", "", ""
    if len(holder) < 2:
        return "bad_card_holder", "", ""
    # тестовая карта для проверки отказа банка
    if number.endswith("0002"):
        return "card_declined", "", ""
    return None, card_brand(number), number[-4:]


def booking_json(row) -> dict:
    seats = db().execute(
        "SELECT seat, ticket_type, price FROM booking_seats WHERE booking_id = ? ORDER BY seat", (row["id"],)
    ).fetchall()
    show = C.find_showtime(row["showtime_id"])
    return {
        "code": row["code"],
        "total": row["total"],
        "card_brand": row["card_brand"],
        "card_last4": row["card_last4"],
        "created_at": row["created_at"],
        "seats": [dict(s) for s in seats],
        "show": _with_state(show) if show else None,
        "movie": C.MOVIES_BY_ID.get(show["movie_id"]) if show else None,
    }


@app.post("/api/bookings")
def create_booking():
    user = current_user()
    if not user:
        return err("auth_required", 401)
    d = _body()
    show = C.find_showtime(str(d.get("showtime_id", "")))
    if not show:
        return err("not_found", 404)
    if datetime.fromisoformat(show["starts_at"]) <= now():
        return err("show_started", 409)

    items = d.get("seats")
    if not isinstance(items, list) or not 1 <= len(items) <= C.MAX_SEATS_PER_ORDER:
        return err("bad_seats")
    lines, seen = [], set()
    for it in items:
        if not isinstance(it, dict):
            return err("bad_seats")
        seat, ttype = str(it.get("seat", "")), str(it.get("type", ""))
        if not C.valid_seat(seat) or seat in seen:
            return err("bad_seats")
        seen.add(seat)
        if C.is_vip(seat):
            ttype = "vip"
        elif ttype not in ("adult", "child", "student"):
            return err("bad_ticket_type")
        price = show["prices"].get(ttype)
        if price is None:
            return err("ticket_type_unavailable")
        lines.append((seat, ttype, price))

    total = sum(p for _, _, p in lines)
    if d.get("expected_total") is not None and d.get("expected_total") != total:
        return err("price_changed", 409, total=total)

    card_error, brand, last4 = check_card(d.get("card") or {})
    if card_error:
        return err(card_error, 402 if card_error == "card_declined" else 400)

    conn = db()
    code = "K" + secrets.token_hex(3).upper()
    try:
        with conn:
            cur = conn.execute(
                "INSERT INTO bookings (code, user_id, showtime_id, total, card_brand, card_last4, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (code, user["id"], show["id"], total, brand, last4, now().isoformat(timespec="seconds")),
            )
            conn.executemany(
                "INSERT INTO booking_seats (booking_id, showtime_id, seat, ticket_type, price) VALUES (?, ?, ?, ?, ?)",
                [(cur.lastrowid, show["id"], s, t, p) for s, t, p in lines],
            )
    except sqlite3.IntegrityError:
        taken = set(_taken(show["id"]))
        return err("seats_taken", 409, seats=sorted(seen & taken))
    row = conn.execute("SELECT * FROM bookings WHERE code = ?", (code,)).fetchone()
    return jsonify(booking=booking_json(row)), 201


@app.get("/api/bookings")
def my_bookings():
    user = current_user()
    if not user:
        return err("auth_required", 401)
    rows = db().execute("SELECT * FROM bookings WHERE user_id = ? ORDER BY id DESC", (user["id"],)).fetchall()
    return jsonify(bookings=[booking_json(r) for r in rows])


@app.get("/api/bookings/<code>")
def one_booking(code):
    user = current_user()
    if not user:
        return err("auth_required", 401)
    row = db().execute("SELECT * FROM bookings WHERE code = ? AND user_id = ?", (code, user["id"])).fetchone()
    if not row:
        return err("not_found", 404)
    return jsonify(booking=booking_json(row))


@app.errorhandler(404)
def _not_found(_e):
    if request.path.startswith("/api/"):
        return err("not_found", 404)
    return send_from_directory(app.static_folder, "index.html")


@app.get("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


init_db()

if __name__ == "__main__":
    host = "0.0.0.0" if "--lan" in sys.argv else "127.0.0.1"
    port = int(os.environ.get("PORT", 5173))
    print(f"KADR Cinema: http://127.0.0.1:{port}")
    app.run(host=host, port=port, debug=False)
