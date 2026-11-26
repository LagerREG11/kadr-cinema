"""Хранение фильмов, сеансов и цен в базе (SQLite).

Фильмы и цены редактируются в админ-панели. Расписание дня создаётся автоматически при первом
обращении к этому дню (catalog.generate_day) и сохраняется — после этого правки фильмов не сдвигают
уже существующие сеансы и проданные билеты. Админ может добавлять свои сеансы, отменять сеансы
без проданных билетов и менять цены отдельного сеанса.
"""
from __future__ import annotations

import json
import sqlite3
from datetime import date, datetime, timedelta

import catalog as C

SCHEMA = """
CREATE TABLE IF NOT EXISTS movies (
    id INTEGER PRIMARY KEY,
    data TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT
);
CREATE TABLE IF NOT EXISTS showtimes (
    id TEXT PRIMARY KEY,
    day TEXT NOT NULL,
    movie_id INTEGER NOT NULL,
    hall INTEGER NOT NULL,
    starts_at TEXT NOT NULL,
    lang TEXT NOT NULL,
    prices TEXT NOT NULL,
    cancelled INTEGER NOT NULL DEFAULT 0,
    source TEXT NOT NULL DEFAULT 'auto'
);
CREATE INDEX IF NOT EXISTS idx_showtimes_day ON showtimes(day);
CREATE TABLE IF NOT EXISTS filled_days (day TEXT PRIMARY KEY);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS favorites (
    user_id INTEGER NOT NULL,
    movie_id INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (user_id, movie_id)
);
CREATE TABLE IF NOT EXISTS reminders (
    user_id INTEGER NOT NULL,
    movie_id INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    notified TEXT,
    PRIMARY KEY (user_id, movie_id)
);
"""

# поля фильма, которые хранятся в JSON
MOVIE_FIELDS = ("age", "duration", "langs", "release", "colors", "motif", "title", "genre", "about",
                "tmdb", "trailer", "poster_url")


def init(conn: sqlite3.Connection) -> None:
    conn.executescript(SCHEMA)
    if not conn.execute("SELECT 1 FROM movies LIMIT 1").fetchone():
        for m in C.SEED_MOVIES:
            data = {k: m.get(k) for k in MOVIE_FIELDS}
            conn.execute("INSERT INTO movies (id, data, active, updated_at) VALUES (?, ?, 1, ?)",
                         (m["id"], json.dumps(data, ensure_ascii=False), datetime.now().isoformat(timespec="seconds")))
    conn.commit()


# ---------- Фильмы ----------
def _movie_row(r) -> dict:
    m = json.loads(r["data"])
    m["id"] = r["id"]
    m["active"] = bool(r["active"])
    m.setdefault("trailer", None)
    m.setdefault("poster_url", None)
    return m


def movies(conn, include_inactive: bool = False) -> list[dict]:
    sql = "SELECT * FROM movies" + ("" if include_inactive else " WHERE active = 1") + " ORDER BY id"
    return [_movie_row(r) for r in conn.execute(sql)]


def movie(conn, movie_id: int) -> dict | None:
    r = conn.execute("SELECT * FROM movies WHERE id = ?", (movie_id,)).fetchone()
    return _movie_row(r) if r else None


def save_movie(conn, data: dict, movie_id: int | None = None, active: bool = True) -> int:
    payload = json.dumps({k: data.get(k) for k in MOVIE_FIELDS}, ensure_ascii=False)
    ts = datetime.now().isoformat(timespec="seconds")
    if movie_id is None:
        cur = conn.execute("INSERT INTO movies (data, active, updated_at) VALUES (?, ?, ?)", (payload, int(active), ts))
        movie_id = cur.lastrowid
    else:
        conn.execute("UPDATE movies SET data = ?, active = ?, updated_at = ? WHERE id = ?", (payload, int(active), ts, movie_id))
    conn.commit()
    return movie_id


# ---------- Цены ----------
def price_cfg(conn) -> dict:
    r = conn.execute("SELECT value FROM settings WHERE key = 'prices'").fetchone()
    cfg = dict(C.DEFAULT_PRICES)
    if r:
        cfg.update({k: v for k, v in json.loads(r["value"]).items() if k in cfg})
    return cfg


def save_price_cfg(conn, cfg: dict) -> None:
    conn.execute("INSERT INTO settings (key, value) VALUES ('prices', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                 (json.dumps(cfg),))
    conn.commit()


# ---------- Расписание ----------
def days(conn, today: date) -> list[date]:
    return C.days_for(today, movies(conn))


def _show_row(r) -> dict:
    start = datetime.fromisoformat(r["starts_at"])
    return {
        "id": r["id"],
        "movie_id": r["movie_id"],
        "hall": r["hall"],
        "date": r["day"],
        "starts_at": r["starts_at"],
        "time": f"{start:%H:%M}",
        "lang": r["lang"],
        "format": C.HALLS[r["hall"]]["format"],
        "prices": json.loads(r["prices"]),
        "cancelled": bool(r["cancelled"]),
        "source": r["source"],
    }


def ensure_day(conn, day: date) -> None:
    """Если день ещё не заполнен — создать расписание и сохранить его."""
    key = day.isoformat()
    if conn.execute("SELECT 1 FROM filled_days WHERE day = ?", (key,)).fetchone():
        return
    rows = C.generate_day(day, movies(conn), price_cfg(conn))
    with conn:
        conn.executemany(
            "INSERT OR IGNORE INTO showtimes (id, day, movie_id, hall, starts_at, lang, prices, cancelled, source) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'auto')",
            [(s["id"], key, s["movie_id"], s["hall"], s["starts_at"], s["lang"], json.dumps(s["prices"])) for s in rows],
        )
        conn.execute("INSERT OR IGNORE INTO filled_days (day) VALUES (?)", (key,))


def shows_for_day(conn, day: date, include_cancelled: bool = False) -> list[dict]:
    ensure_day(conn, day)
    sql = "SELECT * FROM showtimes WHERE day = ?" + ("" if include_cancelled else " AND cancelled = 0") + " ORDER BY starts_at, hall"
    return [_show_row(r) for r in conn.execute(sql, (day.isoformat(),))]


def find_show(conn, show_id: str, include_cancelled: bool = False) -> dict | None:
    r = conn.execute("SELECT * FROM showtimes WHERE id = ?", (show_id,)).fetchone()
    if not r:
        # день ещё не заполнен — заполнить и поискать снова
        try:
            day = datetime.strptime(show_id.split("-")[0], "%Y%m%d").date()
        except ValueError:
            return None
        ensure_day(conn, day)
        r = conn.execute("SELECT * FROM showtimes WHERE id = ?", (show_id,)).fetchone()
    if not r or (r["cancelled"] and not include_cancelled):
        return None
    return _show_row(r)


def overlaps(conn, day: date, hall: int, start: datetime, duration: int, ignore_id: str | None = None) -> dict | None:
    """Есть ли в зале сеанс, пересекающийся с новым (с учётом 15 минут на уборку)."""
    end = start + timedelta(minutes=duration + 15)
    for s in shows_for_day(conn, day) + shows_for_day(conn, day - timedelta(days=1)):
        if s["hall"] != hall or s["id"] == ignore_id:
            continue
        m = movie(conn, s["movie_id"])
        s_start = datetime.fromisoformat(s["starts_at"])
        s_end = s_start + timedelta(minutes=(m["duration"] if m else 120) + 15)
        if start < s_end and s_start < end:
            return s
    return None


def add_show(conn, day: date, start: datetime, hall: int, movie_id: int, lang: str, prices: dict) -> str:
    show_id = f"{day:%Y%m%d}-{hall}-{start:%H%M}"
    with conn:
        conn.execute(
            "INSERT INTO showtimes (id, day, movie_id, hall, starts_at, lang, prices, cancelled, source) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'admin') "
            "ON CONFLICT(id) DO UPDATE SET movie_id = excluded.movie_id, lang = excluded.lang, prices = excluded.prices, cancelled = 0, source = 'admin'",
            (show_id, day.isoformat(), movie_id, hall, start.isoformat(timespec="minutes"), lang, json.dumps(prices)),
        )
    return show_id


def sold_count(conn, show_id: str) -> int:
    return conn.execute("SELECT COUNT(*) FROM booking_seats WHERE showtime_id = ?", (show_id,)).fetchone()[0]


# ---------- Избранное и напоминания ----------
def user_lists(conn, user_id: int) -> dict:
    fav = [r[0] for r in conn.execute("SELECT movie_id FROM favorites WHERE user_id = ? ORDER BY created_at DESC", (user_id,))]
    rem = [r[0] for r in conn.execute("SELECT movie_id FROM reminders WHERE user_id = ? ORDER BY created_at DESC", (user_id,))]
    return {"favorites": fav, "reminders": rem}


def toggle(conn, table: str, user_id: int, movie_id: int, on: bool) -> None:
    if table not in ("favorites", "reminders"):
        raise ValueError(table)
    with conn:
        if on:
            conn.execute(f"INSERT OR IGNORE INTO {table} (user_id, movie_id, created_at) VALUES (?, ?, ?)",
                         (user_id, movie_id, datetime.now().isoformat(timespec="seconds")))
        else:
            conn.execute(f"DELETE FROM {table} WHERE user_id = ? AND movie_id = ?", (user_id, movie_id))


def due_reminders(conn, user_id: int, today: date) -> list[dict]:
    """Напоминания, которые пора показать: премьера завтра, сегодня или уже прошла (ещё не показанные для этого этапа)."""
    out = []
    for r in conn.execute("SELECT movie_id, notified FROM reminders WHERE user_id = ?", (user_id,)):
        m = movie(conn, r["movie_id"])
        if not m or not m.get("release"):
            continue
        rel = date.fromisoformat(m["release"])
        delta = (rel - today).days
        stage = "tomorrow" if delta == 1 else "today" if delta == 0 else "started" if delta < 0 else None
        if stage and r["notified"] != stage and not (r["notified"] == "today" and stage == "started"):
            out.append({"movie_id": m["id"], "stage": stage, "release": m["release"]})
    return out


def mark_notified(conn, user_id: int, items: list[dict]) -> None:
    with conn:
        for it in items:
            stage = str(it.get("stage", ""))
            if stage not in ("tomorrow", "today", "started"):
                continue
            conn.execute("UPDATE reminders SET notified = ? WHERE user_id = ? AND movie_id = ?",
                         (stage, user_id, int(it.get("movie_id", 0))))
