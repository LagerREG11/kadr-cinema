"""Каталог демо-кинотеатра: фильмы (вымышленные), залы, генерация расписания и цены.

Все фильмы, описания и название кинотеатра придуманы для учебного проекта.
"""
from __future__ import annotations

import random
from datetime import date, datetime, time, timedelta

CINEMA = {
    "name": "KADR Cinema",
    "city": {"kk": "Қызылорда", "ru": "Кызылорда"},
    "address": {"kk": "Проект №1", "ru": "Проект №1"},
    "phone": "+7 700 000 00 00",
    "hours": "10:00 – 02:00",
}

# Схема зала: 9 рядов × 14 мест, ряды H и I — VIP-кресла (реклайнеры)
ROWS = "ABCDEFGHI"
SEATS_PER_ROW = 14
VIP_ROWS = {"H", "I"}
MAX_SEATS_PER_ORDER = 6
DAYS_AHEAD = 14

HALLS = {
    1: {"name": "Зал 1", "format": "2D"},
    2: {"name": "Зал 2", "format": "3D"},
    3: {"name": "Зал 3", "format": "IMAX"},
}

MOVIES = [
    {
        "id": 1, "age": 16, "duration": 118, "langs": ["KAZ"], "year": 2026,
        "colors": ["#e0a96d", "#5b2a1a"], "motif": "sun",
        "title": {"kk": "Дала жұлдызы", "ru": "Звезда степи"},
        "genre": {"kk": "Драма", "ru": "Драма"},
        "about": {
            "kk": "Жас бапкер ауылдағы жүйрік атты үлкен бәйгеге дайындайды. Отбасы, намыс және арман туралы жылы хикая.",
            "ru": "Молодой тренер готовит аульного скакуна к большим скачкам. Тёплая история о семье, чести и мечте.",
        },
    },
    {
        "id": 2, "age": 18, "duration": 104, "langs": ["RUS"], "year": 2026,
        "colors": ["#3a4a6b", "#0c0f1a"], "motif": "rails",
        "title": {"kk": "Соңғы пойыз", "ru": "Последний поезд"},
        "genre": {"kk": "Триллер", "ru": "Триллер"},
        "about": {
            "kk": "Түнгі пойызда жолаушылардың бірі жоғалып кетеді. Таңға дейін жұмбақты шешу керек.",
            "ru": "В ночном поезде бесследно исчезает пассажир. До рассвета нужно понять, кто из попутчиков лжёт.",
        },
    },
    {
        "id": 3, "age": 6, "duration": 92, "langs": ["KAZ", "RUS"], "year": 2026,
        "colors": ["#7b6cf0", "#1d1846"], "motif": "planet",
        "title": {"kk": "Ғарыштағы мысық", "ru": "Кот в космосе"},
        "genre": {"kk": "Анимация", "ru": "Анимация"},
        "about": {
            "kk": "Қызығушылығы мол мысық кездейсоқ ракетаға мініп, жаңа планеталарды ашады.",
            "ru": "Любопытный кот случайно попадает в ракету и открывает целую галактику новых друзей.",
        },
    },
    {
        "id": 4, "age": 12, "duration": 131, "langs": ["KAZ", "RUS"], "year": 2026,
        "colors": ["#e9cdb0", "#8c5a3a"], "motif": "dune",
        "title": {"kk": "Құм сағаты", "ru": "Песочные часы"},
        "genre": {"kk": "Фантастика", "ru": "Фантастика"},
        "about": {
            "kk": "Шөл даланың ортасында уақытты тоқтата алатын ежелгі құрылғы табылады.",
            "ru": "Посреди пустыни находят древний механизм, способный останавливать время. За ним начинается охота.",
        },
    },
    {
        "id": 5, "age": 12, "duration": 99, "langs": ["KAZ"], "year": 2026,
        "colors": ["#f2c14e", "#b23a48"], "motif": "confetti",
        "title": {"kk": "Ауылдағы той", "ru": "Свадьба в ауле"},
        "genre": {"kk": "Комедия", "ru": "Комедия"},
        "about": {
            "kk": "Қаладан келген күйеу бала ауылдағы тойдың барлық дәстүрінен өтуі керек.",
            "ru": "Городскому жениху предстоит пройти все испытания настоящей аульной свадьбы.",
        },
    },
    {
        "id": 6, "age": 16, "duration": 110, "langs": ["RUS"], "year": 2026,
        "colors": ["#ff4d6d", "#18122b"], "motif": "city",
        "title": {"kk": "Түнгі қала", "ru": "Ночной город"},
        "genre": {"kk": "Экшн", "ru": "Боевик"},
        "about": {
            "kk": "Такси жүргізушісі бір түнде қаланың ең қауіпті құпиясына куә болады.",
            "ru": "Таксист за одну ночь становится свидетелем самой опасной тайны мегаполиса.",
        },
    },
    {
        "id": 7, "age": 0, "duration": 85, "langs": ["KAZ"], "year": 2026,
        "colors": ["#8fd3fe", "#2f6690"], "motif": "cloud",
        "title": {"kk": "Ақ бұлт", "ru": "Белое облако"},
        "genre": {"kk": "Отбасылық", "ru": "Семейный"},
        "about": {
            "kk": "Кішкентай қыз бен сөйлейтін бұлттың достығы туралы мейірімді ертегі.",
            "ru": "Добрая сказка о дружбе маленькой девочки и говорящего облака.",
        },
    },
]
MOVIES_BY_ID = {m["id"]: m for m in MOVIES}

TICKET_TYPES = ("adult", "child", "student", "vip")


def prices_for(start: time, hall: int, movie: dict) -> dict:
    """Цены зависят от времени сеанса и зала; детский билет — только для фильмов до 16+ и до 21:00."""
    h = start.hour
    if h < 2:          # ночные сеансы после полуночи
        adult = 2200
    elif h < 12:
        adult = 1400
    elif h < 17:
        adult = 1600
    elif h < 21:
        adult = 1800
    else:
        adult = 2200
    if HALLS[hall]["format"] == "IMAX":
        adult += 400
    child = adult - 700 if movie["age"] < 16 and 2 <= h < 21 else None
    student = adult - 300
    vip = 2800 if 2 <= h < 17 else 3500
    return {"adult": adult, "child": child, "student": student, "vip": vip}


def schedule_for(day: date) -> list[dict]:
    """Детерминированное расписание на день: одинаковое при каждом запросе."""
    rng = random.Random(day.toordinal() * 7919)
    shows = []
    for hall in HALLS:
        t = datetime.combine(day, time(10, 0)) + timedelta(minutes=rng.randrange(0, 45, 5))
        end_of_day = datetime.combine(day + timedelta(days=1), time(0, 30))
        last_movie = None
        while t <= end_of_day:
            choices = [m for m in MOVIES if m["id"] != last_movie]
            # детские фильмы — днём, 18+ — вечером
            if t.hour < 15 and t.date() == day:
                choices = [m for m in choices if m["age"] < 18]
            elif t.hour >= 20 or t.date() != day:
                choices = [m for m in choices if m["age"] >= 12]
            movie = rng.choice(choices)
            last_movie = movie["id"]
            start = t.replace(minute=t.minute - t.minute % 5, second=0)
            lang = rng.choice(movie["langs"])
            shows.append({
                "id": f"{day:%Y%m%d}-{hall}-{start:%H%M}",
                "movie_id": movie["id"],
                "hall": hall,
                "date": day.isoformat(),
                "starts_at": start.isoformat(timespec="minutes"),
                "time": f"{start:%H:%M}",
                "lang": lang,
                "format": HALLS[hall]["format"],
                "prices": prices_for(start.time(), hall, movie),
            })
            t = start + timedelta(minutes=movie["duration"] + rng.choice((15, 20, 25)))
    shows.sort(key=lambda s: (s["starts_at"], s["hall"]))
    return shows


def find_showtime(showtime_id: str) -> dict | None:
    try:
        day_s, _hall, _hhmm = showtime_id.split("-")
        day = datetime.strptime(day_s, "%Y%m%d").date()
    except ValueError:
        return None
    return next((s for s in schedule_for(day) if s["id"] == showtime_id), None)


def valid_seat(seat: str) -> bool:
    try:
        row, num = seat.split("-")
        return len(row) == 1 and row in ROWS and 1 <= int(num) <= SEATS_PER_ROW
    except ValueError:
        return False


def is_vip(seat: str) -> bool:
    return seat.split("-")[0] in VIP_ROWS
