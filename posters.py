"""Официальные постеры и длительность фильмов с TMDB (themoviedb.org).

Ключ задаётся переменной окружения TMDB_API_KEY (ключ API v3 или токен чтения v4) и в браузер не попадает.
Без ключа функция возвращает пустой результат — сайт показывает нарисованные обложки.

TMDB разрешает такое использование с указанием источника:
"This product uses the TMDB API but is not endorsed or certified by TMDB."
"""
from __future__ import annotations

import json
import os
import threading
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor

API = "https://api.themoviedb.org/3"
IMG = "https://image.tmdb.org/t/p/w500"
TTL_OK = 12 * 3600      # удачный результат кешируется на 12 часов
TTL_FAIL = 10 * 60      # ошибка — на 10 минут

_cache: dict[int, tuple[float, dict]] = {}
_lock = threading.Lock()


def _key() -> str:
    return os.environ.get("TMDB_API_KEY", "").strip()


def enabled() -> bool:
    return bool(_key())


def _get(path: str, params: dict) -> dict:
    key = _key()
    headers = {"Accept": "application/json", "User-Agent": "kadr-cinema/1.0"}
    if key.startswith("eyJ"):            # токен чтения v4
        headers["Authorization"] = f"Bearer {key}"
    else:                                 # ключ API v3
        params = {**params, "api_key": key}
    url = f"{API}{path}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=6) as resp:
        return json.load(resp)


def _lookup(movie: dict) -> dict:
    q = movie["tmdb"]
    res = _get("/search/movie", {"query": q["query"], "year": q["year"], "language": "ru-RU", "include_adult": "false"})
    results = res.get("results") or []
    if not results:  # иногда год в базе другой — ищем без года
        results = _get("/search/movie", {"query": q["query"], "language": "ru-RU"}).get("results") or []
    if not results:
        return {}
    hit = results[0]
    info = {"tmdb_id": hit["id"]}
    poster = hit.get("poster_path")
    if not poster:  # нет русского постера — берём оригинальный
        en = _get(f"/movie/{hit['id']}", {"language": "en-US"})
        poster = en.get("poster_path")
    if poster:
        info["poster"] = IMG + poster
    try:
        details = _get(f"/movie/{hit['id']}", {"language": "ru-RU"})
        if details.get("runtime"):
            info["runtime"] = details["runtime"]
    except Exception:
        pass
    return info


def _one(movie: dict) -> tuple[int, dict]:
    mid = movie["id"]
    now = time.time()
    with _lock:
        hit = _cache.get(mid)
        if hit and hit[0] > now:
            return mid, hit[1]
    try:
        info = _lookup(movie)
        ttl = TTL_OK
    except Exception:
        info, ttl = {}, TTL_FAIL
    with _lock:
        _cache[mid] = (now + ttl, info)
    return mid, info


def for_movies(movies: list[dict]) -> dict[int, dict]:
    if not enabled():
        return {}
    with ThreadPoolExecutor(max_workers=6) as pool:
        return {mid: info for mid, info in pool.map(_one, movies) if info}
