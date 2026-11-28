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
import dbconn
import extras
import stadium
import theatre
import posters
import store

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


def db():
    if "db" not in g:
        g.db = dbconn.connect(DB_PATH)
    return g.db


@app.teardown_appcontext
def _close_db(_exc):
    conn = g.pop("db", None)
    if conn is not None:
        conn.close()


def init_db() -> None:
    conn = dbconn.connect(DB_PATH)
    conn.executescript(SCHEMA)
    conn.execute("PRAGMA journal_mode = WAL")
    store.init(conn)
    extras.init(conn)
    stadium.init(conn)
    theatre.init(conn)
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


def _reset_session() -> None:
    """Очистить сессию при входе/выходе, но сохранить ключ удержания мест (иначе свои места станут «чужими»)."""
    hk = session.get("hk")
    session.clear()
    if hk:
        session["hk"] = hk


def admin_emails() -> set[str]:
    """Администраторы задаются переменной окружения ADMIN_EMAILS (через запятую)."""
    return {e.strip().lower() for e in os.environ.get("ADMIN_EMAILS", "").split(",") if e.strip()}


def is_admin(row) -> bool:
    return bool(row) and row["email"].lower() in admin_emails()


def user_json(row) -> dict | None:
    if not row:
        return None
    u = dict(row)
    u["is_admin"] = is_admin(row)
    return u


# ---------- Авторизация ----------
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
PHONE_RE = re.compile(r"^\+?[0-9 ()-]{10,18}$")


def _body() -> dict:
    data = request.get_json(silent=True)
    return data if isinstance(data, dict) else {}


@app.get("/api/health")
def health():
    """Служебная проверка: какая база подключена (без адресов и паролей)."""
    configured = bool(os.environ.get("DATABASE_URL", "").strip())
    return jsonify(ok=True, db=dbconn.DB_KIND, database_url_set=configured)


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
    except dbconn.IntegrityError:
        return err("email_taken", 409)
    _reset_session()
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
    _reset_session()
    session.permanent = True
    session["uid"] = row["id"]
    return jsonify(user=user_json(current_user()))


@app.post("/api/logout")
def logout():
    _reset_session()
    return jsonify(ok=True)


# ---------- Каталог и расписание ----------
def _day_range() -> list[date]:
    return store.days(db(), now().date())


@app.get("/api/posters")
def posters_view():
    """Официальные постеры, длительность и трейлеры с TMDB (пусто, если ключ не задан)."""
    data = posters.for_movies([m for m in store.movies(db()) if m.get("tmdb") and m["tmdb"].get("query")])
    resp = jsonify(
        enabled=posters.enabled(),
        movies={str(mid): {k: v for k, v in info.items() if k in ("poster", "runtime", "trailer")} for mid, info in data.items()},
    )
    resp.headers["Cache-Control"] = "public, max-age=600"
    return resp


def _with_state(show: dict) -> dict:
    s = dict(show)
    s["past"] = datetime.fromisoformat(show["starts_at"]) <= now()
    return s


@app.get("/api/catalog")
def catalog_view():
    return jsonify(
        cinema=C.CINEMA,
        cities=C.CITIES,
        default_city=C.DEFAULT_CITY,
        halls=C.HALLS,
        movies=store.movies(db()),
        ratings={str(k): v for k, v in extras.ratings(db()).items()},
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
    city = request.args.get("city", C.DEFAULT_CITY)
    if city not in C.CITY_IDS:
        return err("bad_city")
    shows = [_with_state(s) for s in store.shows_for_day(db(), day, city)]
    occ = extras.occupancy(db(), [s["id"] for s in shows])
    for s in shows:
        s["free"] = extras.TOTAL_SEATS - occ.get(s["id"], 0)
    return jsonify(date=day.isoformat(), city=city, shows=shows)


def _taken(showtime_id: str) -> list[str]:
    rows = db().execute("SELECT seat FROM booking_seats WHERE showtime_id = ?", (showtime_id,)).fetchall()
    return [r["seat"] for r in rows]


@app.get("/api/showtimes/<showtime_id>")
def showtime(showtime_id):
    show = store.find_show(db(), showtime_id)
    if not show:
        return err("not_found", 404)
    held = extras.held_by_others(db(), showtime_id, extras.holder_key())
    db().commit()
    return jsonify(show=_with_state(show), movie=store.movie(db(), show["movie_id"]), taken=_taken(showtime_id), held=held)


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
    show = store.find_show(db(), row["showtime_id"], include_cancelled=True)
    return {
        "code": row["code"],
        "total": row["total"],
        "card_brand": row["card_brand"],
        "card_last4": row["card_last4"],
        "bonus_used": row["bonus_used"] if "bonus_used" in row.keys() else 0,
        "bonus_earned": row["bonus_earned"] if "bonus_earned" in row.keys() else 0,
        "gift_used": row["gift_used"] if "gift_used" in row.keys() else 0,
        "paid": row["paid"] if "paid" in row.keys() and row["paid"] is not None else row["total"],
        "created_at": row["created_at"],
        "seats": [dict(s) for s in seats],
        "show": _with_state(show) if show else None,
        "movie": store.movie(db(), show["movie_id"]) if show else None,
    }


@app.post("/api/bookings")
def create_booking():
    user = current_user()
    if not user:
        return err("auth_required", 401)
    d = _body()
    conn = db()
    show = store.find_show(conn, str(d.get("showtime_id", "")))
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

    # места, которые сейчас выбирает другой покупатель
    holder = extras.holder_key()
    busy = set(extras.held_by_others(conn, show["id"], holder)) & seen
    if busy:
        return err("seats_taken", 409, seats=sorted(busy))

    # KADR-бонусы: не больше баланса и не больше половины заказа
    try:
        bonus_used = max(0, int(d.get("use_bonus") or 0))
    except (TypeError, ValueError):
        return err("bad_bonus")
    balance = extras.bonus_balance(conn, user["id"])
    if bonus_used > balance or bonus_used > int(total * extras.BONUS_MAX_SHARE):
        return err("bad_bonus", 400, balance=balance, max=min(balance, int(total * extras.BONUS_MAX_SHARE)))

    # подарочный сертификат
    gift_used, gift_code = 0, None
    if d.get("gift_code"):
        g = extras.gift_row(conn, d["gift_code"])
        if not g:
            return err("gift_not_found", 404)
        if g["balance"] <= 0:
            return err("gift_empty")
        gift_code = g["code"]
        gift_used = min(g["balance"], total - bonus_used)

    paid = total - bonus_used - gift_used
    brand, last4 = "", ""
    if paid > 0:
        card_error, brand, last4 = check_card(d.get("card") or {})
        if card_error:
            return err(card_error, 402 if card_error == "card_declined" else 400)
    bonus_earned = int(paid * extras.BONUS_EARN)

    code = "K" + secrets.token_hex(3).upper()
    ts = now().isoformat(timespec="seconds")
    try:
        with conn:
            cur = conn.execute(
                "INSERT INTO bookings (code, user_id, showtime_id, total, card_brand, card_last4, created_at, bonus_used, bonus_earned, gift_used, gift_code, paid) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (code, user["id"], show["id"], total, brand or ("Gift" if gift_used else "Bonus"), last4, ts,
                 bonus_used, bonus_earned, gift_used, gift_code, paid),
            )
            bid = cur.lastrowid
            conn.executemany(
                "INSERT INTO booking_seats (booking_id, showtime_id, seat, ticket_type, price) VALUES (?, ?, ?, ?, ?)",
                [(bid, show["id"], s, t, p) for s, t, p in lines],
            )
            if gift_used:
                upd = conn.execute("UPDATE gift_cards SET balance = balance - ? WHERE code = ? AND balance >= ?", (gift_used, gift_code, gift_used))
                if not upd.rowcount:
                    raise sqlite3.IntegrityError("gift")
            if bonus_used:
                conn.execute("INSERT INTO bonus_ledger (user_id, delta, reason, booking_id, created_at) VALUES (?, ?, 'spent', ?, ?)",
                             (user["id"], -bonus_used, bid, ts))
            if bonus_earned:
                conn.execute("INSERT INTO bonus_ledger (user_id, delta, reason, booking_id, created_at) VALUES (?, ?, 'earned', ?, ?)",
                             (user["id"], bonus_earned, bid, ts))
            extras.release(conn, show["id"], holder)
    except dbconn.IntegrityError as e:
        if "gift" in str(e):
            return err("gift_empty", 409)
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


# ---------- Избранное и напоминания о премьере ----------
@app.get("/api/me/lists")
def my_lists():
    user = current_user()
    if not user:
        return err("auth_required", 401)
    return jsonify(store.user_lists(db(), user["id"]))


def _toggle(table: str):
    user = current_user()
    if not user:
        return err("auth_required", 401)
    d = _body()
    try:
        movie_id = int(d.get("movie_id"))
    except (TypeError, ValueError):
        return err("not_found", 404)
    if not store.movie(db(), movie_id):
        return err("not_found", 404)
    store.toggle(db(), table, user["id"], movie_id, bool(d.get("on")))
    return jsonify(store.user_lists(db(), user["id"]))


@app.post("/api/favorites")
def toggle_favorite():
    return _toggle("favorites")


@app.post("/api/reminders")
def toggle_reminder():
    return _toggle("reminders")


@app.get("/api/notifications")
def notifications():
    user = current_user()
    if not user:
        return jsonify(items=[])
    return jsonify(items=store.due_reminders(db(), user["id"], now().date()))


@app.post("/api/notifications/seen")
def notifications_seen():
    user = current_user()
    if not user:
        return err("auth_required", 401)
    items = _body().get("items")
    if isinstance(items, list):
        store.mark_notified(db(), user["id"], [i for i in items[:50] if isinstance(i, dict)])
    return jsonify(ok=True)


import admin  # noqa: E402

admin.setup(db=db, now=now, err=err, body=_body, current_user=current_user, is_admin=is_admin)
app.register_blueprint(admin.bp)
extras.setup(db=db, now=now, err=err, body=_body, current_user=current_user, is_admin=is_admin, check_card=check_card)
app.register_blueprint(extras.bp)
stadium.setup(db=db, now=now, err=err, body=_body, current_user=current_user, check_card=check_card, IntegrityError=dbconn.IntegrityError)
app.register_blueprint(stadium.bp)
theatre.setup(db=db, now=now, err=err, body=_body, current_user=current_user, check_card=check_card, IntegrityError=dbconn.IntegrityError)
app.register_blueprint(theatre.bp)


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
