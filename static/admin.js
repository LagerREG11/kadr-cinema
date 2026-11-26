/* Админ-панель KADR Cinema: продажи и выручка, фильмы, сеансы, цены. Доступна только администраторам. */
(() => {
  'use strict';
  const K = () => window.KADR;

  const TX = {
    kk: {
      title: 'Админ-панель', city: 'Қала', tab_stats: 'Шолу', tab_movies: 'Фильмдер', tab_shows: 'Сеанстар', tab_prices: 'Бағалар',
      revenue: 'Барлық түсім', today: 'Бүгінгі түсім', tickets: 'Сатылған билет', bookings: 'Тапсырыстар',
      by_movie: 'Фильмдер бойынша', by_day: 'Күндер бойынша (30 күн)', recent: 'Соңғы сатылымдар', nothing: 'Әзірге сатылым жоқ',
      movie: 'Фильм', revenue_s: 'Түсім', day: 'Күн', code: 'Код', customer: 'Сатып алушы', show: 'Сеанс', seats: 'Орындар', sum: 'Сома', when: 'Уақыты',
      new_movie: '+ Жаңа фильм', edit: 'Өзгерту', hidden: 'Жасырылған', visible: 'Көрінеді', save: 'Сақтау', cancel_btn: 'Болдырмау',
      f_title: 'Атауы', f_genre: 'Жанры', f_about: 'Сипаттамасы', f_age: 'Жас шегі', f_duration: 'Ұзақтығы (мин)', f_langs: 'Тілдері',
      f_release: 'Премьера күні (алдын ала сату үшін, бос қалдыруға болады)', f_trailer: 'Трейлер (YouTube сілтемесі)', f_poster: 'Постер сілтемесі (https://…, міндетті емес)',
      f_tmdb: 'TMDB іздеу (түпнұсқа атауы)', f_year: 'Жылы', f_colors: 'Обложка түстері', f_motif: 'Обложка суреті', f_active: 'Сайтта көрсету',
      poster_note: 'Постерді тек рұқсаты барын қойыңыз (дистрибьютордан немесе TMDB арқылы).',
      saved: 'Сақталды', date: 'Күні', hall: 'Зал', all_halls: 'Барлық зал', time: 'Уақыт', lang: 'Тіл', prices: 'Бағалар', sold: 'Сатылды', status: 'Күйі',
      st_active: 'Белсенді', st_cancelled: 'Болдырылмады', st_past: 'Өтті', src_admin: 'қолмен', do_cancel: 'Болдырмау', do_restore: 'Қайтару',
      add_show: 'Сеанс қосу', auto_prices: 'Бағалар — бағалар кестесі бойынша автоматты', add: 'Қосу', clear_hall: 'Залды босату',
      clear_confirm: '{h} залындағы осы күнгі билеті сатылмаған барлық сеанс болдырылмайды. Жалғастыру керек пе?',
      cleared: 'Болдырылмады: {n} сеанс', show_added: 'Сеанс қосылды', edit_prices: 'Баға', no_shows: 'Сеанс жоқ',
      p_morning: 'Таңғы (12:00 дейін)', p_day: 'Күндізгі (12:00–17:00)', p_evening: 'Кешкі (17:00–21:00)', p_night: 'Түнгі (21:00 кейін)',
      p_imax_extra: 'IMAX үстемесі', p_child_discount: 'Балалар жеңілдігі', p_student_discount: 'Студенттік жеңілдік', p_vip_day: 'VIP күндіз', p_vip_evening: 'VIP кешке',
      apply_future: 'Болашақ сеанстардың бағаларын да қайта есептеу (сатылған билеттер өзгермейді)', prices_saved: 'Бағалар сақталды, жаңартылды: {n} сеанс',
      adult: 'Ересек', child: 'Бала', student: 'Студ.', vip: 'VIP',
      e_overlap: 'Бұл уақытта залда басқа сеанс бар ({t}). Алдымен оны болдырмаңыз немесе «Залды босату» басыңыз.',
      e_has_tickets: 'Билет сатылған сеансты болдыруға болмайды', e_bad_time: 'Уақыт қате (5 минутқа бөлінуі керек, болашақта)',
      e_bad_title: 'Атауын жазыңыз (орысша міндетті)', e_bad_genre: 'Жанрын жазыңыз', e_bad_about: 'Сипаттамасын жазыңыз', e_bad_trailer: 'YouTube сілтемесі қате',
      e_bad_poster_url: 'Постер сілтемесі https:// басталуы керек', e_bad_langs: 'Кемінде бір тіл таңдаңыз', e_bad_duration: 'Ұзақтығы 30–300 минут', e_bad_price: 'Баға қате',
      db_note: 'Ескерту: тегін хостингте дерекқор қайта іске қосқанда тазаланады — өзгерістер уақытша. Тұрақты дерекқор қосу керек.',
    },
    ru: {
      title: 'Админ-панель', city: 'Город', tab_stats: 'Обзор', tab_movies: 'Фильмы', tab_shows: 'Сеансы', tab_prices: 'Цены',
      revenue: 'Выручка всего', today: 'Выручка сегодня', tickets: 'Продано билетов', bookings: 'Заказов',
      by_movie: 'По фильмам', by_day: 'По дням (30 дней)', recent: 'Последние продажи', nothing: 'Продаж пока нет',
      movie: 'Фильм', revenue_s: 'Выручка', day: 'День', code: 'Код', customer: 'Покупатель', show: 'Сеанс', seats: 'Места', sum: 'Сумма', when: 'Когда',
      new_movie: '+ Новый фильм', edit: 'Изменить', hidden: 'Скрыт', visible: 'На сайте', save: 'Сохранить', cancel_btn: 'Отмена',
      f_title: 'Название', f_genre: 'Жанр', f_about: 'Описание', f_age: 'Возраст', f_duration: 'Длительность (мин)', f_langs: 'Языки',
      f_release: 'Дата премьеры (для предпродажи, можно оставить пустой)', f_trailer: 'Трейлер (ссылка YouTube)', f_poster: 'Ссылка на постер (https://…, необязательно)',
      f_tmdb: 'Поиск TMDB (оригинальное название)', f_year: 'Год', f_colors: 'Цвета обложки', f_motif: 'Рисунок обложки', f_active: 'Показывать на сайте',
      poster_note: 'Ставьте только постеры, на которые есть право (от дистрибьютора или через TMDB).',
      saved: 'Сохранено', date: 'Дата', hall: 'Зал', all_halls: 'Все залы', time: 'Время', lang: 'Язык', prices: 'Цены', sold: 'Продано', status: 'Статус',
      st_active: 'Активен', st_cancelled: 'Отменён', st_past: 'Прошёл', src_admin: 'вручную', do_cancel: 'Отменить', do_restore: 'Вернуть',
      add_show: 'Добавить сеанс', auto_prices: 'Цены — автоматически по таблице цен', add: 'Добавить', clear_hall: 'Освободить зал',
      clear_confirm: 'Будут отменены все сеансы зала «{h}» на этот день, на которые не продано ни одного билета. Продолжить?',
      cleared: 'Отменено сеансов: {n}', show_added: 'Сеанс добавлен', edit_prices: 'Цена', no_shows: 'Сеансов нет',
      p_morning: 'Утро (до 12:00)', p_day: 'День (12:00–17:00)', p_evening: 'Вечер (17:00–21:00)', p_night: 'Ночь (после 21:00)',
      p_imax_extra: 'Наценка IMAX', p_child_discount: 'Скидка детский', p_student_discount: 'Скидка студенческий', p_vip_day: 'VIP днём', p_vip_evening: 'VIP вечером',
      apply_future: 'Пересчитать цены и у будущих сеансов (купленные билеты не меняются)', prices_saved: 'Цены сохранены, обновлено сеансов: {n}',
      adult: 'Взр.', child: 'Дет.', student: 'Студ.', vip: 'VIP',
      e_overlap: 'В это время в зале уже идёт сеанс ({t}). Сначала отмените его или нажмите «Освободить зал».',
      e_has_tickets: 'Нельзя отменить сеанс, на который проданы билеты', e_bad_time: 'Неверное время (кратно 5 минутам и в будущем)',
      e_bad_title: 'Укажите название (на русском обязательно)', e_bad_genre: 'Укажите жанр', e_bad_about: 'Укажите описание', e_bad_trailer: 'Неверная ссылка YouTube',
      e_bad_poster_url: 'Ссылка на постер должна начинаться с https://', e_bad_langs: 'Выберите хотя бы один язык', e_bad_duration: 'Длительность 30–300 минут', e_bad_price: 'Неверная цена',
      db_note: 'Внимание: на бесплатном хостинге база очищается при перезапуске — изменения временные. Нужна постоянная база данных.',
    },
  };
  const a = (key, vars = {}) => {
    const lang = K().S.lang;
    const s = (TX[lang] && TX[lang][key]) || TX.ru[key] || key;
    return s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
  };
  const aerr = (e) => {
    const k = 'e_' + (e.code || '');
    if (e.code === 'overlap' && e.data && e.data.show) return a('e_overlap', { t: e.data.show.time });
    return TX.ru[k] ? a(k) : K().errMsg(e);
  };

  let tab = 'stats';
  let showDate = null;
  let showHall = '';
  let showCity = null;

  window.AdminPage = async function AdminPage(page) {
    const { esc } = K();
    page.className = 'wide admin';
    page.innerHTML = `
      <h1>${a('title')}</h1>
      <p class="note admin-note">${a('db_note')}</p>
      <div class="tabs" role="tablist">
        ${['stats', 'movies', 'shows', 'prices'].map((k) => `<button role="tab" data-atab="${k}" aria-selected="${k === tab}">${esc(a('tab_' + k))}</button>`).join('')}
      </div>
      <div id="aBody"><div class="skeleton"></div></div>`;
    page.querySelectorAll('[data-atab]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.atab; AdminPage(page); }));
    const body = page.querySelector('#aBody');
    const ok = K().fresh();
    try {
      if (tab === 'stats') await renderStats(body, ok);
      else if (tab === 'movies') await renderMovies(body, ok);
      else if (tab === 'shows') await renderShows(body, ok);
      else await renderPrices(body, ok);
    } catch (e) {
      if (ok()) body.innerHTML = `<p class="empty">${esc(aerr(e))}</p>`;
    }
  };

  // ---------- Обзор ----------
  async function renderStats(body, ok) {
    const { api, money, esc, L, fmtDay, S } = K();
    const cityLabel = (id) => L((S.cat.cities.find((c) => c.id === id) || {}).name) || id || '';
    const s = await api('/admin/stats');
    if (!ok()) return;
    const tile = (label, val) => `<div class="kpi"><span>${esc(label)}</span><b>${val}</b></div>`;
    body.innerHTML = `
      <div class="kpis">
        ${tile(a('revenue'), money(s.revenue))}${tile(a('today'), money(s.today_revenue))}
        ${tile(a('tickets'), s.tickets)}${tile(a('bookings'), s.bookings)}
      </div>
      <div class="a-grid">
        <section class="card"><h3>${a('by_movie')}</h3>${s.by_movie.length ? `<table class="atable"><thead><tr><th>${a('movie')}</th><th class="num">${a('tickets')}</th><th class="num">${a('revenue_s')}</th></tr></thead><tbody>
          ${s.by_movie.map((r) => `<tr><td>${esc(L(r.title) || '#' + r.movie_id)}</td><td class="num">${r.tickets}</td><td class="num">${money(r.revenue)}</td></tr>`).join('')}</tbody></table>` : `<p class="muted">${a('nothing')}</p>`}</section>
        <section class="card"><h3>${a('by_day')}</h3>${s.by_day.length ? `<table class="atable"><thead><tr><th>${a('day')}</th><th class="num">${a('bookings')}</th><th class="num">${a('revenue_s')}</th></tr></thead><tbody>
          ${s.by_day.slice().reverse().map((r) => `<tr><td>${fmtDay(r.day)}</td><td class="num">${r.bookings}</td><td class="num">${money(r.revenue)}</td></tr>`).join('')}</tbody></table>` : `<p class="muted">${a('nothing')}</p>`}</section>
      </div>
      <section class="card"><h3>${a('recent')}</h3>${s.recent.length ? `<div class="tscroll"><table class="atable"><thead><tr>
          <th>${a('code')}</th><th>${a('when')}</th><th>${a('customer')}</th><th>${a('movie')}</th><th>${a('show')}</th><th>${a('seats')}</th><th class="num">${a('sum')}</th></tr></thead><tbody>
        ${s.recent.map((r) => `<tr><td><code>${esc(r.code)}</code></td><td>${esc(r.created_at.slice(5, 16).replace('T', ' '))}</td>
          <td>${esc(r.customer)}<br><small class="muted">${esc(r.email)}</small></td><td>${esc(L(r.title) || '—')}</td>
          <td>${r.show ? `${esc(cityLabel(r.show.city))} · ${fmtDay(r.show.date)}, ${r.show.time} · ${r.show.hall}` : '—'}</td><td>${r.seats.map(esc).join(', ')}</td><td class="num">${money(r.total)}</td></tr>`).join('')}
      </tbody></table></div>` : `<p class="muted">${a('nothing')}</p>`}</section>`;
  }

  // ---------- Фильмы ----------
  async function renderMovies(body, ok) {
    const { api, esc, L, poster } = K();
    const { movies } = await api('/admin/movies');
    if (!ok()) return;
    body.innerHTML = `
      <button class="btn btn-green" id="newMovie">${a('new_movie')}</button>
      <div id="movieForm"></div>
      <div class="amovies">${movies.map((m) => `
        <div class="amovie${m.active ? '' : ' off'}">
          ${poster(m, 'xs')}
          <div class="am-info"><b>${esc(L(m.title))}</b><small class="muted">${esc(L(m.genre))} · ${m.age}+ · ${m.duration} мин${m.release ? ' · ' + m.release : ''}</small>
            <span class="pill ${m.active ? 'pill-on' : ''}">${m.active ? a('visible') : a('hidden')}</span></div>
          <button class="btn btn-ghost-b btn-sm" data-edit="${m.id}">${a('edit')}</button>
        </div>`).join('')}</div>`;
    body.querySelector('#newMovie').addEventListener('click', () => movieForm(body, null));
    body.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => movieForm(body, movies.find((m) => m.id === Number(b.dataset.edit)))));
  }

  function movieForm(body, m) {
    const { api, esc, toast, reloadCatalog } = K();
    const v = m || { title: { kk: '', ru: '' }, genre: { kk: '', ru: '' }, about: { kk: '', ru: '' }, age: 12, duration: 120, langs: ['RUS'], colors: ['#3a4a6b', '#0c0f1a'], motif: 'sun', active: true };
    const box = body.querySelector('#movieForm');
    const two = (key, label, area) => `<div class="f2"><span class="flabel">${label}</span>
      ${['ru', 'kk'].map((l) => area
        ? `<label class="field"><span>${l === 'ru' ? 'Русский' : 'Қазақша'}</span><textarea name="${key}_${l}" rows="3" maxlength="1200">${esc((v[key] || {})[l] || '')}</textarea></label>`
        : `<label class="field"><span>${l === 'ru' ? 'Русский' : 'Қазақша'}</span><input name="${key}_${l}" maxlength="120" value="${esc((v[key] || {})[l] || '')}"></label>`).join('')}</div>`;
    box.innerHTML = `<form class="card aform" novalidate>
      <h3>${m ? esc(m.title.ru) : a('new_movie').replace('+ ', '')}</h3>
      ${two('title', a('f_title'))}${two('genre', a('f_genre'))}${two('about', a('f_about'), true)}
      <div class="frow">
        <label class="field"><span>${a('f_age')}</span><select name="age">${[0, 6, 12, 14, 16, 18, 21].map((x) => `<option ${x === v.age ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
        <label class="field"><span>${a('f_duration')}</span><input name="duration" type="number" min="30" max="300" value="${v.duration}"></label>
        <label class="field"><span>${a('f_release')}</span><input name="release" type="date" value="${esc(v.release || '')}"></label>
      </div>
      <div class="field"><span>${a('f_langs')}</span><div class="checks">${['KAZ', 'RUS', 'ENG'].map((l) => `<label><input type="checkbox" name="langs" value="${l}" ${v.langs.includes(l) ? 'checked' : ''}> ${l}</label>`).join('')}</div></div>
      <label class="field"><span>${a('f_trailer')}</span><input name="trailer" placeholder="https://www.youtube.com/watch?v=…" value="${v.trailer ? 'https://www.youtube.com/watch?v=' + esc(v.trailer) : ''}"></label>
      <div class="frow">
        <label class="field"><span>${a('f_tmdb')}</span><input name="tmdb_q" placeholder="Avengers: Doomsday" value="${esc((v.tmdb || {}).query || '')}"></label>
        <label class="field"><span>${a('f_year')}</span><input name="tmdb_y" type="number" min="1900" max="2100" value="${esc((v.tmdb || {}).year || '')}"></label>
      </div>
      <label class="field"><span>${a('f_poster')}</span><input name="poster_url" placeholder="https://…" value="${esc(v.poster_url || '')}"></label>
      <p class="hint">${a('poster_note')}</p>
      <div class="frow">
        <div class="field"><span>${a('f_colors')}</span><div class="checks"><input type="color" name="c1" value="${v.colors[0]}"><input type="color" name="c2" value="${v.colors[1]}"></div></div>
        <label class="field"><span>${a('f_motif')}</span><select name="motif">${['sun', 'rails', 'planet', 'dune', 'confetti', 'city', 'cloud', 'mask'].map((x) => `<option ${x === v.motif ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
        <label class="checks act"><input type="checkbox" name="active" ${v.active ? 'checked' : ''}> ${a('f_active')}</label>
      </div>
      <p class="form-err" role="alert"></p>
      <div class="actions-row"><button class="btn btn-green" type="submit">${a('save')}</button><button class="btn btn-ghost-b" type="button" data-x>${a('cancel_btn')}</button></div>
    </form>`;
    const form = box.querySelector('form');
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    form.querySelector('[data-x]').addEventListener('click', () => { box.innerHTML = ''; });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = form.elements;
      const payload = {
        title: { ru: f.title_ru.value, kk: f.title_kk.value },
        genre: { ru: f.genre_ru.value, kk: f.genre_kk.value },
        about: { ru: f.about_ru.value, kk: f.about_kk.value },
        age: Number(f.age.value), duration: Number(f.duration.value), release: f.release.value || null,
        langs: [...form.querySelectorAll('[name=langs]:checked')].map((x) => x.value),
        trailer: f.trailer.value, poster_url: f.poster_url.value,
        tmdb: { query: f.tmdb_q.value, year: f.tmdb_y.value },
        colors: [f.c1.value, f.c2.value], motif: f.motif.value, active: f.active.checked,
      };
      const btn = form.querySelector('[type=submit]');
      btn.disabled = true;
      try {
        await api(m ? `/admin/movies/${m.id}` : '/admin/movies', { method: m ? 'PUT' : 'POST', body: payload });
        toast(a('saved'));
        await reloadCatalog();
        window.AdminPage(document.getElementById('page'));
      } catch (err) {
        form.querySelector('.form-err').textContent = aerr(err);
        btn.disabled = false;
      }
    });
  }

  // ---------- Сеансы ----------
  async function renderShows(body, ok) {
    const { api, esc, L, money, S, langLabel, toast } = K();
    if (!showDate) showDate = S.cat.days[0];
    if (!showCity) showCity = S.city || S.cat.default_city;
    const [{ shows }, { movies }] = await Promise.all([api(`/admin/shows?date=${showDate}&city=${showCity}`), api('/admin/movies')]);
    if (!ok()) return;
    const byId = Object.fromEntries(movies.map((m) => [m.id, m]));
    const halls = S.cat.halls;
    const list = shows.filter((s) => !showHall || String(s.hall) === showHall);
    const active = movies.filter((m) => m.active);
    body.innerHTML = `
      <div class="frow toolbar">
        <label class="field"><span>${a('city')}</span><select id="sCity">${S.cat.cities.map((c) => `<option value="${c.id}" ${c.id === showCity ? 'selected' : ''}>${esc(L(c.name))}</option>`).join('')}</select></label>
        <label class="field"><span>${a('date')}</span><input type="date" id="sDate" value="${showDate}"></label>
        <label class="field"><span>${a('hall')}</span><select id="sHall"><option value="">${a('all_halls')}</option>${Object.entries(halls).map(([k, h]) => `<option value="${k}" ${k === showHall ? 'selected' : ''}>${esc(h.name)} · ${h.format}</option>`).join('')}</select></label>
        ${showHall ? `<button class="btn btn-ghost-b btn-sm" id="clearHall">${a('clear_hall')}</button>` : ''}
      </div>
      <form class="card aform addshow" novalidate>
        <h3>${a('add_show')}</h3>
        <div class="frow">
          <label class="field"><span>${a('time')}</span><input name="time" type="time" step="300" required value="12:00"></label>
          <label class="field"><span>${a('hall')}</span><select name="hall">${Object.entries(halls).map(([k, h]) => `<option value="${k}" ${k === showHall ? 'selected' : ''}>${esc(h.name)} · ${h.format}</option>`).join('')}</select></label>
          <label class="field grow"><span>${a('movie')}</span><select name="movie">${active.map((m) => `<option value="${m.id}">${esc(L(m.title))}</option>`).join('')}</select></label>
          <label class="field"><span>${a('lang')}</span><select name="lang"></select></label>
          <button class="btn btn-green" type="submit">${a('add')}</button>
        </div>
        <p class="hint">${a('auto_prices')}</p>
        <p class="form-err" role="alert"></p>
      </form>
      ${list.length ? `<div class="tscroll"><table class="atable shows-t"><thead><tr><th>${a('time')}</th><th>${a('hall')}</th><th>${a('movie')}</th><th>${a('lang')}</th><th>${a('prices')}</th><th class="num">${a('sold')}</th><th>${a('status')}</th><th></th></tr></thead><tbody>
        ${list.map((s) => {
          const m = byId[s.movie_id];
          const st = s.cancelled ? a('st_cancelled') : s.past ? a('st_past') : a('st_active');
          return `<tr class="${s.cancelled ? 'off' : ''}">
            <td><b>${s.time}</b>${s.source === 'admin' ? ` <small class="muted">${a('src_admin')}</small>` : ''}</td>
            <td>${esc(halls[s.hall].name)}</td><td>${esc(m ? L(m.title) : '#' + s.movie_id)}</td><td>${langLabel(s.lang)}</td>
            <td class="pr"><small>${a('adult')} ${money(s.prices.adult)} · ${a('child')} ${money(s.prices.child)} · ${a('student')} ${money(s.prices.student)} · VIP ${money(s.prices.vip)}</small></td>
            <td class="num">${s.sold}</td><td><span class="pill ${s.cancelled ? '' : 'pill-on'}">${st}</span></td>
            <td class="acts">${s.past ? '' : `<button class="btn btn-ghost-b btn-sm" data-price="${s.id}">${a('edit_prices')}</button>
              <button class="btn btn-ghost-b btn-sm" data-toggle="${s.id}" data-c="${s.cancelled ? 0 : 1}">${s.cancelled ? a('do_restore') : a('do_cancel')}</button>`}</td></tr>`;
        }).join('')}</tbody></table></div>` : `<p class="empty">${a('no_shows')}</p>`}`;

    const rerender = () => window.AdminPage(document.getElementById('page'));
    body.querySelector('#sCity').addEventListener('change', (e) => { showCity = e.target.value; rerender(); });
    body.querySelector('#sDate').addEventListener('change', (e) => { if (e.target.value) { showDate = e.target.value; rerender(); } });
    body.querySelector('#sHall').addEventListener('change', (e) => { showHall = e.target.value; rerender(); });
    const ch = body.querySelector('#clearHall');
    if (ch) ch.addEventListener('click', async () => {
      if (!confirm(a('clear_confirm', { h: halls[showHall].name }))) return;
      try { const r = await api('/admin/shows/clear', { method: 'POST', body: { date: showDate, hall: Number(showHall), city: showCity } }); toast(a('cleared', { n: r.cancelled })); K().S.sched = {}; rerender(); } catch (e) { toast(aerr(e)); }
    });

    const form = body.querySelector('.addshow');
    const fillLangs = () => {
      const m = byId[Number(form.elements.movie.value)];
      form.elements.lang.innerHTML = (m ? m.langs : []).map((l) => `<option value="${l}">${langLabel(l)}</option>`).join('');
    };
    form.elements.movie.addEventListener('change', fillLangs);
    fillLangs();
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = form.elements;
      try {
        await api('/admin/shows', { method: 'POST', body: { city: showCity, date: showDate, time: f.time.value, hall: Number(f.hall.value), movie_id: Number(f.movie.value), lang: f.lang.value } });
        toast(a('show_added'));
        K().S.sched = {};
        rerender();
      } catch (err) { form.querySelector('.form-err').textContent = aerr(err); }
    });

    body.querySelectorAll('[data-toggle]').forEach((b) => b.addEventListener('click', async () => {
      try { await api(`/admin/shows/${b.dataset.toggle}`, { method: 'PATCH', body: { cancelled: b.dataset.c === '1' } }); K().S.sched = {}; rerender(); } catch (e) { toast(aerr(e)); }
    }));
    body.querySelectorAll('[data-price]').forEach((b) => b.addEventListener('click', () => {
      const s = shows.find((x) => x.id === b.dataset.price);
      const cell = b.closest('tr').querySelector('.pr');
      cell.innerHTML = `<form class="pform">${['adult', 'child', 'student', 'vip'].map((k) => `<label>${a(k)}<input type="number" min="0" step="50" name="${k}" value="${s.prices[k] ?? ''}" ${k === 'child' ? 'placeholder="—"' : ''}></label>`).join('')}
        <button class="btn btn-green btn-sm">${a('save')}</button></form>`;
      cell.querySelector('form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const f = e.target.elements;
        try {
          await api(`/admin/shows/${s.id}`, { method: 'PATCH', body: { prices: { adult: f.adult.value, child: f.child.value, student: f.student.value, vip: f.vip.value } } });
          K().S.sched = {}; toast(a('saved')); rerender();
        } catch (err) { toast(aerr(err)); }
      });
    }));
  }

  // ---------- Цены ----------
  async function renderPrices(body, ok) {
    const { api, toast } = K();
    const { prices, labels } = await api('/admin/prices');
    if (!ok()) return;
    body.innerHTML = `<form class="card aform" novalidate>
      <div class="pgrid">${labels.map((k) => `<label class="field"><span>${a('p_' + k)}</span><input type="number" min="0" step="50" name="${k}" value="${prices[k]}"></label>`).join('')}</div>
      <label class="checks"><input type="checkbox" name="apply" checked> ${a('apply_future')}</label>
      <p class="form-err" role="alert"></p>
      <button class="btn btn-green" type="submit">${a('save')}</button>
    </form>`;
    const form = body.querySelector('form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const cfg = Object.fromEntries(labels.map((k) => [k, Number(form.elements[k].value)]));
      try {
        const r = await api('/admin/prices', { method: 'PUT', body: { prices: cfg, apply_future: form.elements.apply.checked } });
        K().S.sched = {};
        toast(a('prices_saved', { n: r.updated }));
      } catch (err) { form.querySelector('.form-err').textContent = aerr(err); }
    });
  }
})();
