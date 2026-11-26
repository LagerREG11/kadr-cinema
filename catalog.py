"""Каталог кинотеатра: фильмы из реального проката Казахстана, залы, генерация расписания и цены.

Названия фильмов — реальные; описания написаны для этого проекта своими словами.
Официальные постеры и длительность подтягиваются с TMDB (см. posters.py), если задан ключ API.
Расписание и цены — демонстрационные.
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
PRESALE_HORIZON = 60   # фильмы с премьерой в ближайшие N дней продаются заранее
PRESALE_DAYS = 3       # сколько дней с премьеры открыто в предпродаже

HALLS = {
    1: {"name": "Зал 1", "format": "2D"},
    2: {"name": "Зал 2", "format": "3D"},
    3: {"name": "Зал 3", "format": "IMAX"},
}


def _same(text: str) -> dict:
    return {"kk": text, "ru": text}


# duration — примерная длительность для составления расписания (точная приходит с TMDB)
MOVIES = [
    {
        "id": 1, "age": 14, "duration": 150, "langs": ["RUS", "KAZ"], "release": "2027-01-07",
        "colors": ["#2f4a2a", "#070a06"], "motif": "mask",
        "title": _same("Мстители: Доктор Дум"),
        "tmdb": {"query": "Avengers: Doomsday", "year": 2026},
        "genre": {"kk": "Экшн, шытырман оқиға", "ru": "Боевик, приключения"},
        "about": {
            "kk": "Кек алушылар мен олардың жаңа одақтастары ең қауіпті жауға қарсы бірігеді — мультиғаламның тағдырын өзгертпек болған Латверия билеушісі Виктор фон Думға. Режиссерлері — Энтони және Джо Руссо.",
            "ru": "Мстители и их новые союзники объединяются против самого опасного противника — Виктора фон Дума, правителя Латверии, который готов переписать судьбу мультивселенной. Режиссёры — Энтони и Джо Руссо.",
        },
    },
    {
        "id": 2, "age": 14, "duration": 160, "langs": ["RUS", "KAZ"], "release": "2026-12-17",
        "colors": ["#e3b98a", "#5a3420"], "motif": "dune",
        "title": {"kk": "Дюна: Үшінші бөлім", "ru": "Дюна: Часть третья"},
        "tmdb": {"query": "Dune: Part Three", "year": 2026},
        "genre": {"kk": "Фантастика, драма", "ru": "Фантастика, драма"},
        "about": {
            "kk": "Жеңістен бірнеше жыл өткен соң Пол Атрейдес әлемнің императоры болды, бірақ оның билігі соғысқа, қастандықтарға және одан қашып құтыла алмайтын пайғамбарлықтарға ұласады. Дени Вильнёвтің сағасының жалғасы.",
            "ru": "Спустя годы после победы Пол Атрейдес стал императором известной вселенной, но его власть порождает войну, заговоры и пророчества, от которых не уйти. Продолжение саги Дени Вильнёва.",
        },
    },
    {
        "id": 3, "age": 16, "duration": 140, "langs": ["RUS"],
        "colors": ["#c9a227", "#2a1b0c"], "motif": "sun",
        "title": _same("Голодные игры: Рассвет Жатвы"),
        "tmdb": {"query": "The Hunger Games: Sunrise on the Reaping", "year": 2026},
        "genre": {"kk": "Экшн, шытырман оқиға", "ru": "Боевик, приключения"},
        "about": {
            "kk": "Елуінші Аштық ойындары — бұл жолы трибуттар екі есе көп. 12-ауданнан келген жас Хеймитч Эбернети оны сындыру үшін ойлап табылған аренада аман қалуға тырысады.",
            "ru": "Пятидесятые Голодные игры — и трибутов вдвое больше обычного. Юный Хеймитч Эбернети из Дистрикта 12 пытается выжить на арене, придуманной, чтобы его сломать.",
        },
    },
    {
        "id": 4, "age": 6, "duration": 95, "langs": ["RUS", "KAZ"],
        "colors": ["#e53946", "#1d3557"], "motif": "confetti",
        "title": _same("Кот в шляпе"),
        "tmdb": {"query": "The Cat in the Hat", "year": 2026},
        "genre": {"kk": "Мультфильм, фэнтези", "ru": "Мультфильм, фэнтези"},
        "about": {
            "kk": "Тентек Қалпақты мысық екі баланың жаңбырлы, іш пыстырар күнін ақылға сыймайтын шытырман оқиғаларға айналдырады. Доктор Сьюз кітабы бойынша анимация.",
            "ru": "Озорной Кот в шляпе превращает скучный дождливый день двух детей в цепочку безумных приключений. Анимационная экранизация книги Доктора Сьюза.",
        },
    },
    {
        "id": 5, "age": 18, "duration": 110, "langs": ["RUS"],
        "colors": ["#7a6a55", "#140f0c"], "motif": "city",
        "title": _same("Клэйфейс"),
        "tmdb": {"query": "Clayface", "year": 2026},
        "genre": {"kk": "Экшн, қорқынышты", "ru": "Боевик, хоррор"},
        "about": {
            "kk": "Бетін қаскөй жарақаттаған актер тәжірибелік емге келіседі — және денесі кез келген пішінге ене алатын балшыққа айналғанын байқайды. DC әлеміндегі қорқынышты фильм.",
            "ru": "Актёр, чьё лицо изуродовал бандит, соглашается на экспериментальное лечение — и обнаруживает, что его тело стало глиной, способной принять любую форму. Хоррор во вселенной DC.",
        },
    },
    {
        "id": 6, "age": 16, "duration": 115, "langs": ["RUS"],
        "colors": ["#b23a48", "#1a0f12"], "motif": "sun",
        "title": _same("Рокки – это я"),
        "tmdb": {"query": "I Play Rocky", "year": 2026},
        "genre": {"kk": "Өмірбаян, драма", "ru": "Биография, драма"},
        "about": {
            "kk": "Ешкім танымайтын Сильвестр Сталлоне «Рокки» сценарийін жазып, басты рөлді өзі ойнауға қалай қол жеткізгені туралы оқиға.",
            "ru": "История о том, как никому не известный Сильвестр Сталлоне написал сценарий «Рокки» и добился, чтобы главную роль сыграл он сам.",
        },
    },
    {
        "id": 7, "age": 18, "duration": 125, "langs": ["RUS"],
        "colors": ["#f4a261", "#2b1d14"], "motif": "rails",
        "title": _same("Новые похождения Клиффа Бута"),
        "tmdb": {"query": "The Further Adventures of Cliff Booth", "year": 2026},
        "genre": {"kk": "Экшн, драма", "ru": "Боевик, драма"},
        "about": {
            "kk": "«Бірде... Голливудта» фильміндегі каскадер Клифф Бут қайтадан іске кіріседі. Режиссері — Дэвид Финчер, сценарий — Квентин Тарантино, басты рөлде — Брэд Питт.",
            "ru": "Каскадёр Клифф Бут из «Однажды в… Голливуде» снова в деле. Режиссёр — Дэвид Финчер, сценарий — Квентин Тарантино, в главной роли — Брэд Питт.",
        },
    },
    {
        "id": 8, "age": 16, "duration": 105, "langs": ["RUS"],
        "colors": ["#1f6f8b", "#04121a"], "motif": "planet",
        "title": _same("Кит: Во тьме глубин"),
        "tmdb": {"query": "Whalefall", "year": 2026},
        "genre": {"kk": "Драма, триллер", "ru": "Драма, триллер"},
        "about": {
            "kk": "Жас сүңгуір мұхит түбінен әкесінің сүйегін іздеп жүріп, кашалоттың аузына түседі. Шығып кетуге бір сағаттық оттегі ғана қалды.",
            "ru": "Юный дайвер ищет на дне океана останки отца — и его проглатывает кашалот. Кислорода остаётся на час, чтобы выбраться.",
        },
    },
    {
        "id": 9, "age": 18, "duration": 110, "langs": ["RUS"],
        "colors": ["#3a4a6b", "#0c0f1a"], "motif": "rails",
        "title": _same("Как ограбить банк"),
        "tmdb": {"query": "How to Rob a Bank", "year": 2026},
        "genre": {"kk": "Экшн, криминал", "ru": "Боевик, криминал"},
        "about": {
            "kk": "Басынан-ақ жоспар бойынша жүрмей қалған банк тонауы туралы криминалдық экшн.",
            "ru": "Криминальный боевик об ограблении банка, которое с самого начала идёт не по плану.",
        },
    },
    {
        "id": 10, "age": 16, "duration": 124, "langs": ["RUS"],
        "colors": ["#8fa3b8", "#10161d"], "motif": "cloud",
        "title": _same("Сумерки. Сага. Затмение"),
        "tmdb": {"query": "The Twilight Saga: Eclipse", "year": 2010},
        "genre": {"kk": "Мелодрама, фэнтези", "ru": "Мелодрама, фэнтези"},
        "about": {
            "kk": "Қайта прокат. Белла вампир Эдвард пен қасқыр-адам Джейкобтың бірін таңдауы керек, ал Сиэтлде жаңа туған вампирлер әскері жиналып жатыр.",
            "ru": "Повторный прокат. Белле предстоит выбрать между вампиром Эдвардом и оборотнем Джейкобом, пока в Сиэтле собирается армия новорождённых вампиров.",
        },
    },
]
MOVIES_BY_ID = {m["id"]: m for m in MOVIES}

TICKET_TYPES = ("adult", "child", "student", "vip")


def release_of(movie: dict) -> date | None:
    return date.fromisoformat(movie["release"]) if movie.get("release") else None


def days_for(today: date) -> list[date]:
    """Ближайшие 14 дней + первые дни проката фильмов в предпродаже (например, премьера через месяц)."""
    days = [today + timedelta(days=i) for i in range(DAYS_AHEAD)]
    for m in MOVIES:
        rel = release_of(m)
        if rel and today < rel <= today + timedelta(days=PRESALE_HORIZON):
            for k in range(PRESALE_DAYS):
                d = rel + timedelta(days=k)
                if d not in days:
                    days.append(d)
    return sorted(days)


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
    playing = [m for m in MOVIES if not release_of(m) or release_of(m) <= day]
    # в первые дни проката громкой премьеры она идёт в большинстве сеансов
    premieres = [m for m in playing if release_of(m) and (day - release_of(m)).days < PRESALE_DAYS]
    shows = []
    for hall in HALLS:
        t = datetime.combine(day, time(10, 0)) + timedelta(minutes=rng.randrange(0, 45, 5))
        end_of_day = datetime.combine(day + timedelta(days=1), time(0, 30))
        last_movie = None
        while t <= end_of_day:
            choices = [m for m in playing if m["id"] != last_movie]
            if t.hour < 15 and t.date() == day:
                choices = [m for m in choices if m["age"] < 18]
            elif t.hour >= 20 or t.date() != day:
                choices = [m for m in choices if m["age"] >= 12]
            if premieres and rng.random() < 0.6:
                pick = [m for m in premieres if m["id"] != last_movie and m in choices]
                choices = pick or choices
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
