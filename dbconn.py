"""Подключение к базе данных: PostgreSQL (если задана переменная DATABASE_URL, например Neon) или SQLite (локально).

Код сайта написан в стиле sqlite3 (плейсхолдеры «?», INSERT OR IGNORE, conn.execute, row["name"]).
Для PostgreSQL здесь тонкая обёртка, которая переводит такие запросы и отдаёт строки с тем же интерфейсом,
поэтому остальной код не зависит от того, какая база используется.
"""
from __future__ import annotations

import os
import re
import sqlite3

DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()
IS_PG = DATABASE_URL.startswith(("postgres://", "postgresql://"))

if IS_PG:
    import psycopg

    IntegrityError = (sqlite3.IntegrityError, psycopg.IntegrityError)
else:
    IntegrityError = (sqlite3.IntegrityError,)

# таблицы с автоинкрементным id (для lastrowid через RETURNING id)
SERIAL_TABLES = {"users", "bookings", "bonus_ledger", "movies"}
_INSERT_RE = re.compile(r"^\s*INSERT\s+(?:OR\s+IGNORE\s+)?INTO\s+(\w+)", re.I)
_OR_IGNORE_RE = re.compile(r"INSERT\s+OR\s+IGNORE\s+INTO", re.I)


def translate(sql: str, has_params: bool) -> str:
    """SQLite-диалект → PostgreSQL."""
    s = sql
    if has_params:
        s = s.replace("%", "%%").replace("?", "%s")
    if _OR_IGNORE_RE.search(s):
        s = _OR_IGNORE_RE.sub("INSERT INTO", s, count=1).rstrip().rstrip(";") + " ON CONFLICT DO NOTHING"
    s = re.sub(r"\bid\s+INTEGER\s+PRIMARY\s+KEY\b", "id SERIAL PRIMARY KEY", s, flags=re.I)
    return s


class Row:
    """Строка как sqlite3.Row: доступ по индексу и по имени, keys(), dict(row)."""
    __slots__ = ("_idx", "_vals")

    def __init__(self, idx: dict, vals: tuple):
        self._idx = idx
        self._vals = vals

    def __getitem__(self, k):
        return self._vals[k] if isinstance(k, int) else self._vals[self._idx[k]]

    def keys(self):
        return list(self._idx)

    def __iter__(self):
        return iter(self._vals)

    def __len__(self):
        return len(self._vals)


def _row_factory(cursor):
    names = [d.name for d in (cursor.description or [])]
    idx = {n: i for i, n in enumerate(names)}
    return lambda values: Row(idx, values)


class _Cursor:
    def __init__(self, cur=None, lastrowid=None, rows=None):
        self._c = cur
        self.lastrowid = lastrowid
        self._rows = rows  # уже прочитанные строки (после RETURNING)

    @property
    def rowcount(self):
        return self._c.rowcount if self._c is not None else 0

    def fetchone(self):
        if self._rows is not None:
            return self._rows[0] if self._rows else None
        if self._c is None or self._c.description is None:
            return None
        return self._c.fetchone()

    def fetchall(self):
        if self._rows is not None:
            return list(self._rows)
        if self._c is None or self._c.description is None:
            return []
        return self._c.fetchall()

    def __iter__(self):
        return iter(self.fetchall())


class PgConnection:
    """Соединение PostgreSQL с интерфейсом, похожим на sqlite3.Connection."""

    def __init__(self, url: str):
        # prepare_threshold=None: без серверных prepared statements — иначе ошибки за пулом соединений (Neon pooler / PgBouncer)
        self._c = psycopg.connect(url, autocommit=False, row_factory=_row_factory, connect_timeout=15, prepare_threshold=None)
        self.row_factory = None  # совместимость: присваивание игнорируется

    def execute(self, sql, params=()):
        if sql.lstrip().upper().startswith("PRAGMA"):
            return _Cursor()
        params = tuple(params or ())
        q = translate(sql, bool(params))
        m = _INSERT_RE.match(sql)
        want_id = bool(m and m.group(1).lower() in SERIAL_TABLES and "RETURNING" not in q.upper())
        if want_id:
            q = q.rstrip().rstrip(";") + " RETURNING id"
        cur = self._c.cursor()
        cur.execute(q, params or None)
        if want_id:
            rows = cur.fetchall()
            return _Cursor(cur, lastrowid=rows[0][0] if rows else None, rows=[])
        return _Cursor(cur)

    def executemany(self, sql, seq):
        cur = self._c.cursor()
        cur.executemany(translate(sql, True), [tuple(x) for x in seq])
        return _Cursor(cur)

    def executescript(self, script: str):
        for stmt in script.split(";"):
            if stmt.strip():
                self.execute(stmt)
        self.commit()

    def commit(self):
        self._c.commit()

    def rollback(self):
        self._c.rollback()

    def close(self):
        try:
            self._c.rollback()
        finally:
            self._c.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        if exc_type is None:
            self._c.commit()
        else:
            self._c.rollback()
        return False


def connect(sqlite_path: str):
    if IS_PG:
        return PgConnection(DATABASE_URL)
    conn = sqlite3.connect(sqlite_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn
