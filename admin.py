"""API админ-панели: фильмы, сеансы, цены, продажи и выручка.

Доступ только у пользователей, чей email указан в переменной окружения ADMIN_EMAILS.
"""
from __future__ import annotations

import json
import re
from datetime import date, datetime, timedelta
from functools import wraps
from types import SimpleNamespace

from flask import Blueprint, jsonify, request

import catalog as C
import store

bp = Blueprint("admin", __name__, url_prefix="/api/admin")

# функции сервера (db, current_user, …) передаются через setup(), чтобы не было циклического импорта
_d = SimpleNamespace()


def setup(**deps):
    _d.__dict__.update(deps)


def db():
    return _d.db()


def now():
    return _d.now()


def err(*a, **kw):
    return _d.err(*a, **kw)


def _body():
    return _d.body()

HEX_RE = re.compile(r"^#[0-9a-fA-F]{6}$")
YT_RE = re.compile(r"(?:youtube\.com/(?:watch\?(?:.*&)?v=|embed/|shorts/)|youtu\.be/)([A-Za-z0-9_-]{11})")
YT_ID_RE = re.compile(r"^[A-Za-z0-9_-]{11}$")


def admin_required(fn):
    @wraps(fn)
    def wrapper(*a, **kw):
        user = _d.current_user()
        if not user:
            return err("auth_required", 401)
        if not _d.is_admin(user):
            return err("forbidden", 403)
        return fn(*a, **kw)
    return wrapper


# ---------- Обзор: продажи и выручка ----------
@bp.get("/stats")
@admin_required
def stats():
    conn = db()
    since = (now() - timedelta(days=30)).isoformat(timespec="seconds")
    titles = {m["id"]: m["title"] for m in store.movies(conn, include_inactive=True)}

    total = conn.execute("SELECT COALESCE(SUM(total),0), COUNT(*) FROM bookings").fetchone()
    tickets = conn.execute("SELECT COUNT(*) FROM booking_seats").fetchone()[0]
    today = now().date().isoformat()
    today_row = conn.execute("SELECT COALESCE(SUM(total),0), COUNT(*) FROM bookings WHERE substr(created_at,1,10) = ?", (today,)).fetchone()

    by_movie = {}
    for r in conn.execute(
        "SELECT s.movie_id AS mid, COUNT(bs.seat) AS tickets, COALESCE(SUM(bs.price),0) AS revenue "
        "FROM booking_seats bs JOIN showtimes s ON s.id = bs.showtime_id GROUP BY s.movie_id ORDER BY revenue DESC"
    ):
        by_movie[r["mid"]] = {"movie_id": r["mid"], "title": titles.get(r["mid"]), "tickets": r["tickets"], "revenue": r["revenue"]}

    by_day = [
        {"day": r["d"], "revenue": r["revenue"], "bookings": r["n"]}
        for r in conn.execute(
            "SELECT substr(created_at,1,10) AS d, SUM(total) AS revenue, COUNT(*) AS n FROM bookings "
            "WHERE created_at >= ? GROUP BY d ORDER BY d", (since,)
        )
    ]

    recent = []
    for r in conn.execute(
        "SELECT b.id, b.code, b.total, b.created_at, b.showtime_id, u.name, u.email FROM bookings b "
        "JOIN users u ON u.id = b.user_id ORDER BY b.id DESC LIMIT 30"
    ):
        show = store.find_show(conn, r["showtime_id"], include_cancelled=True)
        seats = [x[0] for x in conn.execute("SELECT seat FROM booking_seats WHERE booking_id = ? ORDER BY seat", (r["id"],))]
        recent.append({
            "code": r["code"], "total": r["total"], "created_at": r["created_at"],
            "customer": r["name"], "email": r["email"], "seats": seats,
            "show": show, "title": titles.get(show["movie_id"]) if show else None,
        })

    return jsonify(
        revenue=total[0], bookings=total[1], tickets=tickets,
        today_revenue=today_row[0], today_bookings=today_row[1],
        by_movie=list(by_movie.values()), by_day=by_day, recent=recent,
    )


# ---------- Фильмы ----------
def _text(d, key, lo=1, hi=120):
    v = d.get(key) or {}
    kk, ru = str(v.get("kk", "")).strip(), str(v.get("ru", "")).strip()
    if not (lo <= len(ru) <= hi):
        raise ValueError(f"bad_{key}")
    return {"kk": kk[:hi] or ru, "ru": ru}


def _clean_movie(d: dict) -> dict:
    title = _text(d, "title")
    genre = _text(d, "genre", 1, 60)
    about = _text(d, "about", 1, 1200)
    age = int(d.get("age", 0))
    if age not in C.AGES:
        raise ValueError("bad_age")
    duration = int(d.get("duration", 0))
    if not 30 <= duration <= 300:
        raise ValueError("bad_duration")
    langs = [l for l in (d.get("langs") or []) if l in C.LANGS]
    if not langs:
        raise ValueError("bad_langs")
    release = d.get("release") or None
    if release:
        date.fromisoformat(release)  # ValueError, если неверно
    colors = d.get("colors") or ["#3a4a6b", "#0c0f1a"]
    if len(colors) != 2 or not all(HEX_RE.match(str(c)) for c in colors):
        raise ValueError("bad_colors")
    motif = d.get("motif") if d.get("motif") in C.MOTIFS else "sun"

    trailer = str(d.get("trailer") or "").strip()
    if trailer:
        m = YT_RE.search(trailer)
        trailer = m.group(1) if m else trailer
        if not YT_ID_RE.match(trailer):
            raise ValueError("bad_trailer")
    poster_url = str(d.get("poster_url") or "").strip()
    if poster_url and (not poster_url.startswith("https://") or len(poster_url) > 500):
        raise ValueError("bad_poster_url")
    tmdb = d.get("tmdb") or {}
    tmdb_q = str(tmdb.get("query", "")).strip()[:120]
    tmdb_y = tmdb.get("year")
    tmdb_y = int(tmdb_y) if str(tmdb_y or "").isdigit() else None

    return {
        "title": title, "genre": genre, "about": about, "age": age, "duration": duration, "langs": langs,
        "release": release, "colors": colors, "motif": motif, "trailer": trailer or None,
        "poster_url": poster_url or None, "tmdb": {"query": tmdb_q, "year": tmdb_y} if tmdb_q else None,
    }


@bp.get("/movies")
@admin_required
def list_movies():
    return jsonify(movies=store.movies(db(), include_inactive=True))


@bp.post("/movies")
@admin_required
def create_movie():
    try:
        data = _clean_movie(_body())
    except (ValueError, TypeError) as e:
        return err(str(e) if str(e).startswith("bad_") else "bad_movie")
    mid = store.save_movie(db(), data)
    return jsonify(movie=store.movie(db(), mid)), 201


@bp.put("/movies/<int:movie_id>")
@admin_required
def update_movie(movie_id):
    old = store.movie(db(), movie_id)
    if not old:
        return err("not_found", 404)
    body = _body()
    try:
        data = _clean_movie(body)
    except (ValueError, TypeError) as e:
        return err(str(e) if str(e).startswith("bad_") else "bad_movie")
    active = bool(body.get("active", old["active"]))
    store.save_movie(db(), data, movie_id, active)
    return jsonify(movie=store.movie(db(), movie_id))


# ---------- Сеансы ----------
def _admin_day(value) -> date:
    day = date.fromisoformat(str(value))
    today = now().date()
    if not today - timedelta(days=30) <= day <= today + timedelta(days=C.PRESALE_HORIZON):
        raise ValueError("bad_date")
    return day


def _clean_prices(p: dict) -> dict:
    out = {}
    for k in ("adult", "child", "student", "vip"):
        v = p.get(k)
        if v in (None, "") and k == "child":
            out[k] = None
            continue
        v = int(v)
        if not 0 <= v <= 100000:
            raise ValueError("bad_price")
        out[k] = v
    return out


@bp.get("/shows")
@admin_required
def list_shows():
    try:
        day = _admin_day(request.args.get("date", now().date().isoformat()))
    except ValueError:
        return err("bad_date")
    conn = db()
    shows = store.shows_for_day(conn, day, include_cancelled=True)
    for s in shows:
        s["sold"] = store.sold_count(conn, s["id"])
        s["past"] = datetime.fromisoformat(s["starts_at"]) <= now()
    return jsonify(date=day.isoformat(), shows=shows)


@bp.post("/shows")
@admin_required
def create_show():
    d = _body()
    conn = db()
    try:
        day = _admin_day(d.get("date"))
        hh, mm = map(int, str(d.get("time", "")).split(":"))
        start = datetime.combine(day, datetime.min.time()).replace(hour=hh, minute=mm)
        if mm % 5:
            raise ValueError("bad_time")
        hall = int(d.get("hall"))
        if hall not in C.HALLS:
            raise ValueError("bad_hall")
        movie = store.movie(conn, int(d.get("movie_id")))
        if not movie or not movie["active"]:
            raise ValueError("bad_movie")
        lang = d.get("lang") if d.get("lang") in movie["langs"] else movie["langs"][0]
    except (ValueError, TypeError) as e:
        return err(str(e) if str(e).startswith("bad_") else "bad_show")
    if start <= now():
        return err("bad_time")
    clash = store.overlaps(conn, day, hall, start, movie["duration"])
    if clash:
        return err("overlap", 409, show=clash)
    try:
        prices = _clean_prices(d["prices"]) if d.get("prices") else C.prices_for(start.time(), hall, movie, store.price_cfg(conn))
    except (ValueError, TypeError):
        return err("bad_price")
    show_id = store.add_show(conn, day, start, hall, movie["id"], lang, prices)
    return jsonify(show=store.find_show(conn, show_id)), 201


@bp.patch("/shows/<show_id>")
@admin_required
def update_show(show_id):
    conn = db()
    show = store.find_show(conn, show_id, include_cancelled=True)
    if not show:
        return err("not_found", 404)
    d = _body()
    with conn:
        if "cancelled" in d:
            cancel = bool(d["cancelled"])
            if cancel and store.sold_count(conn, show_id):
                return err("has_tickets", 409)
            if not cancel:
                m = store.movie(conn, show["movie_id"])
                clash = store.overlaps(conn, date.fromisoformat(show["date"]), show["hall"],
                                       datetime.fromisoformat(show["starts_at"]), m["duration"] if m else 120, ignore_id=show_id)
                if clash:
                    return err("overlap", 409, show=clash)
            conn.execute("UPDATE showtimes SET cancelled = ? WHERE id = ?", (int(cancel), show_id))
        if "prices" in d:
            try:
                prices = _clean_prices(d["prices"] or {})
            except (ValueError, TypeError):
                return err("bad_price")
            conn.execute("UPDATE showtimes SET prices = ? WHERE id = ?", (json.dumps(prices), show_id))
    return jsonify(show=store.find_show(conn, show_id, include_cancelled=True))


@bp.post("/shows/clear")
@admin_required
def clear_hall():
    """Отменить все будущие сеансы зала за день, на которые не продано ни одного билета."""
    d = _body()
    try:
        day = _admin_day(d.get("date"))
        hall = int(d.get("hall"))
        if hall not in C.HALLS:
            raise ValueError
    except (ValueError, TypeError):
        return err("bad_date")
    conn = db()
    n = 0
    with conn:
        for s in store.shows_for_day(conn, day):
            if s["hall"] == hall and datetime.fromisoformat(s["starts_at"]) > now() and not store.sold_count(conn, s["id"]):
                conn.execute("UPDATE showtimes SET cancelled = 1 WHERE id = ?", (s["id"],))
                n += 1
    return jsonify(cancelled=n)


# ---------- Цены ----------
@bp.get("/prices")
@admin_required
def get_prices():
    return jsonify(prices=store.price_cfg(db()), labels=list(C.DEFAULT_PRICES))


@bp.put("/prices")
@admin_required
def put_prices():
    d = _body()
    try:
        cfg = {k: int(d["prices"][k]) for k in C.DEFAULT_PRICES}
        if any(not 0 <= v <= 100000 for v in cfg.values()):
            raise ValueError
    except (KeyError, ValueError, TypeError):
        return err("bad_price")
    conn = db()
    store.save_price_cfg(conn, cfg)
    updated = 0
    if d.get("apply_future"):
        # пересчитать цены у будущих сеансов (уже купленные билеты не меняются)
        movies = {m["id"]: m for m in store.movies(conn, include_inactive=True)}
        with conn:
            for r in conn.execute("SELECT id, movie_id, hall, starts_at FROM showtimes WHERE starts_at > ? AND cancelled = 0",
                                  (now().isoformat(timespec="minutes"),)).fetchall():
                m = movies.get(r["movie_id"])
                if not m:
                    continue
                p = C.prices_for(datetime.fromisoformat(r["starts_at"]).time(), r["hall"], m, cfg)
                conn.execute("UPDATE showtimes SET prices = ? WHERE id = ?", (json.dumps(p), r["id"]))
                updated += 1
    return jsonify(prices=cfg, updated=updated)
