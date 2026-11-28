/* KADR Cinema — одностраничное приложение: афиша → сеанс → места → оплата → билет. */
(() => {
  'use strict';

  // ---------- Утилиты ----------
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const store = {
    get(k, def = null, area = localStorage) {
      try { const v = area.getItem('kadr-' + k); return v == null ? def : JSON.parse(v); } catch { return def; }
    },
    set(k, v, area = localStorage) {
      try { v == null ? area.removeItem('kadr-' + k) : area.setItem('kadr-' + k, JSON.stringify(v)); } catch { /* приватный режим */ }
    },
  };
  const ss = (() => { try { return window.sessionStorage; } catch { return null; } })();

  const S = {
    lang: store.get('lang', 'kk'),
    mode: store.get('mode', 'movies'),
    city: store.get('city', null),
    kids: store.get('kids', false),
    sortFree: false,
    tab: 'schedule',
    user: null,
    cat: null,
    date: null,
    sched: {},
    order: ss ? store.get('order', null, ss) : null, // {showId, seats:[{r,i}], types:{}, holdUntil}
  };
  const saveOrder = () => ss && store.set('order', S.order, ss);

  const t = (key, vars = {}) => {
    let s = (I18N[S.lang] && I18N[S.lang][key]) ?? I18N.ru[key] ?? key;
    if (typeof s === 'string') s = s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
    return s;
  };
  const L = (obj) => (obj ? obj[S.lang] || obj.ru : '');
  const money = (n) => (n == null ? '–' : n.toLocaleString('ru-RU').replace(/[  ]/g, ' ') + ' ₸');
  const langLabel = (l) => ({ KAZ: S.lang === 'kk' ? 'ҚАЗ' : 'КАЗ', RUS: 'РУС' }[l] || l);
  const parseDay = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
  const fmtDay = (iso) => { const d = parseDay(iso); return `${d.getDate()} ${t('months')[d.getMonth()]}`; };
  const wd = (iso) => t('wd')[(parseDay(iso).getDay() + 6) % 7];
  const seatName = (r, i) => `${S.cat.layout.rows[r]}-${i + 1}`;
  const seatParse = (name) => { const [row, n] = name.split('-'); return { r: S.cat.layout.rows.indexOf(row), i: Number(n) - 1 }; };
  const isVip = (r) => S.cat.layout.vip_rows.includes(S.cat.layout.rows[r]);
  const movieById = (id) => S.cat.movies.find((m) => m.id === id);

  let toastTimer;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
  }

  async function api(path, { method = 'GET', body } = {}) {
    let res;
    try {
      res = await fetch('/api' + path, {
        method,
        credentials: 'same-origin',
        headers: body ? { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' } : { 'X-Requested-With': 'fetch' },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw Object.assign(new Error('network'), { code: 'network', data: {} });
    }
    let data = {};
    try { data = await res.json(); } catch { /* пустой ответ */ }
    if (!res.ok) throw Object.assign(new Error(data.error || 'generic'), { code: data.error || 'generic', status: res.status, data });
    return data;
  }
  const errMsg = (e) => {
    const key = 'err_' + (e.code || 'generic');
    const msg = t(key, { s: (e.data && e.data.seats || []).join(', ') });
    return msg === key ? t('err_generic') : msg;
  };

  // ---------- Постер (рисуется кодом) ----------
  function motif(m) {
    const [a] = m.colors;
    switch (m.motif) {
      case 'sun': return `<circle cx="100" cy="120" r="46" fill="#ffd9a0" opacity=".85"/><path d="M0 210 Q60 170 120 190 T200 175 V300 H0Z" fill="#00000055"/>`;
      case 'rails': return `<path d="M70 300 L98 120 M130 300 L102 120" stroke="#cfd8ff" stroke-width="3" opacity=".6"/>${[0, 1, 2, 3, 4, 5].map((k) => `<path d="M${74 + k * 3} ${280 - k * 30} H${126 - k * 3}" stroke="#cfd8ff" stroke-width="2" opacity=".35"/>`).join('')}<circle cx="100" cy="112" r="6" fill="#ffe08a"/>`;
      case 'planet': return `<circle cx="100" cy="120" r="44" fill="#ffb4d0" opacity=".9"/><ellipse cx="100" cy="120" rx="78" ry="16" fill="none" stroke="#fff" stroke-width="3" opacity=".7" transform="rotate(-18 100 120)"/>${[[30, 40], [160, 60], [50, 200], [170, 190], [120, 30]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2" fill="#fff"/>`).join('')}`;
      case 'dune': return `<circle cx="140" cy="80" r="28" fill="#fff6e8" opacity=".6"/><path d="M0 200 Q70 140 140 170 T200 150 V300 H0Z" fill="#c98f62"/><path d="M0 240 Q90 190 200 230 V300 H0Z" fill="#a8704a"/><rect x="98" y="158" width="2" height="8" fill="#2a1a12"/>`;
      case 'confetti': return [...Array(26)].map((_, k) => `<rect x="${(k * 53) % 190}" y="${(k * 37) % 230 + 10}" width="6" height="10" rx="2" fill="${['#fff', '#ffe08a', '#7ee0b0', '#ff8fa3'][k % 4]}" opacity=".8" transform="rotate(${k * 29} ${(k * 53) % 190} ${(k * 37) % 230 + 10})"/>`).join('');
      case 'city': return [[10, 140, 26], [40, 110, 30], [74, 150, 22], [100, 90, 34], [138, 130, 26], [168, 105, 28]].map(([x, y, w]) => `<rect x="${x}" y="${y}" width="${w}" height="${300 - y}" fill="#0a0812" opacity=".85"/>`).join('') + `<circle cx="150" cy="60" r="14" fill="${a}" opacity=".9"/>`;
      case 'cloud': return `<g fill="#fff" opacity=".9"><ellipse cx="80" cy="120" rx="40" ry="26"/><ellipse cx="118" cy="110" rx="34" ry="30"/><ellipse cx="140" cy="128" rx="30" ry="20"/></g><circle cx="92" cy="114" r="3" fill="#2f6690"/><circle cx="116" cy="112" r="3" fill="#2f6690"/>`;
      // металлическая маска под капюшоном
      case 'mask': return `<path d="M100 40 C40 40 30 120 36 200 L60 300 H140 L164 200 C170 120 160 40 100 40Z" fill="#0f1a0d"/><path d="M100 78 C70 78 64 110 66 150 C68 182 84 206 100 210 C116 206 132 182 134 150 C136 110 130 78 100 78Z" fill="#9aa59a"/><path d="M76 132 H94 M106 132 H124" stroke="#0b0f0a" stroke-width="7" stroke-linecap="round"/><path d="M86 172 H114" stroke="#0b0f0a" stroke-width="4"/><path d="M100 84 V204" stroke="#6f7a6f" stroke-width="1.5"/>`;
      default: return '';
    }
  }
  // официальный постер TMDB (если сервер его отдал), иначе — нарисованная обложка
  const tmdb = (m) => (S.posters && S.posters[m.id]) || {};
  const runtime = (m) => tmdb(m).runtime || null;
  const durText = (m) => (runtime(m) ? t('min', { n: runtime(m) }) : '');
  const posterSrc = (m) => m.poster_url || tmdb(m).poster || '';
  const posterImg = (m) => (posterSrc(m) ? `<img src="${esc(posterSrc(m))}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.remove()">` : '');
  function poster(m, cls = '') {
    const id = `pg${m.id}`;
    return `<div class="poster ${cls}" data-mid="${m.id}" aria-hidden="true">
      <svg viewBox="0 0 200 300" preserveAspectRatio="xMidYMid slice">
        <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${m.colors[0]}"/><stop offset="1" stop-color="${m.colors[1]}"/></linearGradient></defs>
        <rect width="200" height="300" fill="url(#${id})"/>${motif(m)}
        <rect y="190" width="200" height="110" fill="url(#shade)"/>
      </svg>
      <span class="poster-title">${esc(L(m.title))}</span>
      ${posterImg(m)}
      <span class="age-badge">${m.age}+</span>
    </div>`;
  }
  // постеры пришли после отрисовки страницы — вставить их в уже показанные обложки
  function hydratePosters() {
    $$('.poster[data-mid]').forEach((el) => {
      const m = movieById(Number(el.dataset.mid));
      if (m && posterSrc(m) && !el.querySelector('img')) el.querySelector('.age-badge').insertAdjacentHTML('beforebegin', posterImg(m));
    });
    $$('[data-dur]').forEach((el) => {
      const m = movieById(Number(el.dataset.dur));
      if (m && runtime(m)) el.textContent = ` · ${durText(m)}`;
    });
    $$('[data-dur-plain]').forEach((el) => {
      const m = movieById(Number(el.dataset.durPlain));
      if (m && runtime(m)) el.textContent = durText(m);
    });
    $$('[data-trailer]').forEach((el) => {
      const m = movieById(Number(el.dataset.trailer));
      el.hidden = !(m && trailerOf(m));
    });
    const foot = $('.foot');
    if (S.tmdbOn && foot && !foot.textContent) foot.innerHTML = `<p>${t('tmdb_note')} <a href="https://www.themoviedb.org/" target="_blank" rel="noopener">TMDB</a>. This product uses the TMDB API but is not endorsed or certified by TMDB.</p>`;
  }
  const todayIso = () => S.cat.days[0];
  // время окончания сеанса: начало + длительность фильма
  const endTime = (show) => {
    const m = movieById(show.movie_id);
    const mins = (m && (runtime(m) || m.duration)) || 120;
    const [hh, mm] = show.starts_at.slice(11, 16).split(':').map(Number);
    const tot = (hh * 60 + mm + mins) % (24 * 60);
    return `${String(Math.floor(tot / 60)).padStart(2, '0')}:${String(tot % 60).padStart(2, '0')}`;
  };
  // загруженность зала по числу свободных мест
  const occBadge = (s) => {
    if (s.past || s.free == null) return '';
    if (s.free <= 0) return `<span class="occ occ-full">${t('occ_full')}</span>`;
    if (s.free <= 5) return `<span class="occ occ-last">${t('occ_last', { n: s.free })}</span>`;
    if (s.free <= 25) return `<span class="occ occ-few">${t('occ_few')}</span>`;
    // «почти пусто» показываем только при сортировке по свободным местам, чтобы не было шума
    if (S.sortFree && s.free >= 110) return `<span class="occ occ-free">${t('occ_free')}</span>`;
    return '';
  };
  const ratingOf = (m) => (S.cat.ratings && S.cat.ratings[m.id]) || null;
  const starsTxt = (m) => { const r = ratingOf(m); return r ? `<span class="rating">★ ${r.avg.toFixed(1)} <small>(${r.count})</small></span>` : ''; };
  const kidsOk = (m) => !S.kids || m.age <= 6;
  const cityName = (id) => L(((S.cat && S.cat.cities) || []).find((c) => c.id === id)?.name) || '';

  // ---------- Выбор города ----------
  function openCityPicker(first) {
    if ($('.city-modal')) return;
    const box = document.createElement('div');
    box.className = 'modal city-modal';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', t('choose_city'));
    const def = S.cat.default_city;
    const list = S.cat.cities.slice().sort((a, b) => (a.id === def ? -1 : b.id === def ? 1 : L(a.name).localeCompare(L(b.name), S.lang)));
    box.innerHTML = `<div class="card city-card">
        <div class="city-head"><h2>${t('choose_city')}</h2>${first ? '' : `<button class="icon-btn modal-x" aria-label="${t('close')}"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>`}</div>
        <label class="field city-search"><input type="search" placeholder="${t('search_city')}" aria-label="${t('search_city')}"></label>
        <div class="city-list">${list.map((c) => `<button class="city-opt${c.id === (S.city || def) ? ' on' : ''}" data-city="${c.id}">${esc(L(c.name))}</button>`).join('')}</div>
      </div>`;
    const close = () => { box.parentNode && box.parentNode.removeChild(box); document.body.classList.remove('no-scroll'); };
    box.addEventListener('click', (e) => {
      const opt = e.target.closest('[data-city]');
      if (opt) {
        const changed = opt.dataset.city !== S.city;
        S.city = opt.dataset.city;
        store.set('city', S.city);
        close();
        updateChrome();
        if (changed) {
          S.sched = {};
          if (S.order && !S.order.showId.startsWith(S.city + '-')) { S.order = null; saveOrder(); }
          route();
        }
        return;
      }
      if (!first && (e.target === box || e.target.closest('.modal-x'))) close();
    });
    const input = $('input', box);
    input.addEventListener('input', () => {
      const q = input.value.trim().toLowerCase();
      $$('.city-opt', box).forEach((b) => { b.hidden = !!q && !b.textContent.toLowerCase().includes(q); });
    });
    document.body.append(box);
    document.body.classList.add('no-scroll');
    if (!first) input.focus();
  }
  const isPresale = (m) => !!(m.release && m.release > todayIso());

  // ---------- Трейлер ----------
  const trailerOf = (m) => m.trailer || tmdb(m).trailer || null;
  function openTrailer(id) {
    const m = movieById(Number(id));
    const key = m && trailerOf(m);
    if (!key || !/^[\w-]{11}$/.test(key)) return;
    const box = document.createElement('div');
    box.className = 'modal';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', t('watch_trailer'));
    box.innerHTML = `<div class="modal-in">
        <button class="icon-btn modal-x" aria-label="${t('close')}"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
        <div class="video"><iframe src="https://www.youtube-nocookie.com/embed/${key}?autoplay=1&rel=0" title="${esc(L(m.title))}"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>
        <p class="muted small">${esc(L(m.title))} · YouTube</p>
      </div>`;
    const close = () => { box.remove(); document.body.classList.remove('no-scroll'); document.removeEventListener('keydown', onKey); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    box.addEventListener('click', (e) => { if (e.target === box || e.target.closest('.modal-x')) close(); });
    document.addEventListener('keydown', onKey);
    document.body.append(box);
    document.body.classList.add('no-scroll');
    $('.modal-x', box).focus();
  }

  // ---------- Избранное и напоминания ----------
  S.lists = { favorites: [], reminders: [] };
  const inList = (kind, id) => S.lists[kind].includes(Number(id));
  const HEART = '<svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.6-9 9-9 9z"/></svg>';
  const BELL = '<svg viewBox="0 0 24 24"><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0"/></svg>';
  const favBtn = (m, big) => `<button class="fav-btn${big ? ' big' : ''}${inList('favorites', m.id) ? ' on' : ''}" data-fav="${m.id}"
      aria-pressed="${inList('favorites', m.id)}" aria-label="${t('favorite')}" title="${t('favorite')}">${HEART}${big ? `<span>${t('favorite')}</span>` : ''}</button>`;
  const remindBtn = (m) => `<button class="remind-btn${inList('reminders', m.id) ? ' on' : ''}" data-remind="${m.id}" aria-pressed="${inList('reminders', m.id)}">
      ${BELL}<span>${inList('reminders', m.id) ? t('remind_on') : t('remind')}</span></button>`;

  async function loadLists() {
    if (!S.user) { S.lists = { favorites: [], reminders: [] }; return; }
    try { S.lists = await api('/me/lists'); } catch { /* не критично */ }
  }
  function syncListButtons() {
    $$('[data-fav]').forEach((b) => { const on = inList('favorites', b.dataset.fav); b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
    $$('[data-remind]').forEach((b) => {
      const on = inList('reminders', b.dataset.remind);
      b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on));
      const sp = $('span', b); if (sp) sp.textContent = on ? t('remind_on') : t('remind');
    });
  }
  async function toggleList(kind, id) {
    if (!S.user) {
      toast(t('login_for_lists'));
      location.hash = `#/login?next=movie-${id}`;
      return;
    }
    const on = !inList(kind, id);
    try {
      S.lists = await api(kind === 'favorites' ? '/favorites' : '/reminders', { method: 'POST', body: { movie_id: Number(id), on } });
    } catch (e) { toast(errMsg(e)); return; }
    syncListButtons();
    if (kind === 'reminders' && on) {
      toast(t('remind_set'));
      // системные уведомления браузера (если пользователь разрешит)
      if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {});
    } else if (kind === 'favorites') {
      toast(on ? t('fav_added') : t('fav_removed'));
    }
  }
  const listBlock = (kind, title, empty) => {
    const items = S.lists[kind].map(movieById).filter(Boolean);
    return `<section class="card list-card"><h3>${title}</h3>${items.length
      ? `<div class="mini-list">${items.map((m) => `<a class="mini-movie" href="#/movie/${m.id}">${poster(m, 'xs')}
          <span><b>${esc(L(m.title))}</b><small>${m.release && isPresale(m) ? `${t('premiere')}: ${fmtDay(m.release)}` : esc(L(m.genre))}</small></span></a>`).join('')}</div>`
      : `<p class="muted small">${empty}</p>`}</section>`;
  };

  // напоминания о премьере: проверяются при входе и каждые 15 минут, пока сайт открыт
  async function checkNotifications() {
    if (!S.user) return;
    let items;
    try { ({ items } = await api('/notifications')); } catch { return; }
    if (!items || !items.length) return;
    items.forEach((it) => {
      const m = movieById(it.movie_id);
      if (!m) return;
      const msg = t('notif_' + it.stage, { m: L(m.title) });
      showBanner(msg, m);
      if ('Notification' in window && Notification.permission === 'granted') {
        try { new Notification('KADR Cinema', { body: msg, icon: '/icon.svg', tag: `rem-${m.id}-${it.stage}` }); } catch { /* мобильные браузеры */ }
      }
    });
    api('/notifications/seen', { method: 'POST', body: { items } }).catch(() => {});
  }
  function showBanner(msg, m) {
    const b = document.createElement('div');
    b.className = 'banner';
    b.setAttribute('role', 'status');
    b.innerHTML = `${BELL}<span>${esc(msg)}</span><a class="btn btn-green btn-sm" href="#/movie/${m.id}">${t('buy_ticket')}</a>
      <button class="icon-btn" aria-label="${t('close')}"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>`;
    b.addEventListener('click', (e) => { if (e.target.closest('button, a')) b.remove(); });
    document.body.append(b);
  }

  // клики по кнопкам избранного, напоминаний и трейлера — на любой странице
  document.addEventListener('click', (e) => {
    const f = e.target.closest('[data-fav]'); if (f) { e.preventDefault(); toggleList('favorites', f.dataset.fav); return; }
    const r = e.target.closest('[data-remind]'); if (r) { e.preventDefault(); toggleList('reminders', r.dataset.remind); return; }
    const tr = e.target.closest('[data-trailer]'); if (tr) { e.preventDefault(); openTrailer(tr.dataset.trailer); }
  });

  async function reloadCatalog() {
    S.cat = await api('/catalog');
    S.sched = {};
    catLoadedAt = Date.now();
  }

  // ---------- Шапка и навигация ----------
  function updateChrome() {
    document.documentElement.lang = S.lang;
    $$('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    $$('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === S.lang)));
    const hash = location.hash || '#/';
    const section = hash.startsWith('#/stadium') ? 'stadium' : hash.startsWith('#/theatre') ? 'theatre' : (hash === '#/' || hash === '#') ? 'hub' : hash.startsWith('#/admin') ? 'admin'
      : hash.startsWith('#/tickets') || hash.startsWith('#/ticket/') ? 'tickets'
      : hash.startsWith('#/profile') || hash.startsWith('#/login') || hash.startsWith('#/register') ? 'profile' : 'home';
    $$('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === section));
    const cb = $('#cityBtn');
    if (cb && S.cat) cb.querySelector('span').textContent = cityName(S.city || S.cat.default_city);
    // название города в логотипе; разделы, которые есть только в одном городе, скрываются в других
    const curCity = S.city || (S.cat && S.cat.default_city) || 'kzo';
    const lc = $('#logoCity'); if (lc && S.cat) lc.textContent = cityName(curCity);
    $$('[data-local]').forEach((a) => { a.hidden = a.dataset.local !== curCity; });
    document.body.classList.toggle('kids', !!S.kids);
    const an = $('#adminNav');
    if (an) an.hidden = !(S.user && S.user.is_admin);
    const ub = $('#userBtn');
    if (S.user) {
      ub.href = '#/profile';
      ub.innerHTML = `<span class="avatar">${esc(S.user.name.trim()[0] || '?').toUpperCase()}</span><span class="ub-name">${esc(S.user.name.split(' ')[0])}</span>`;
    } else {
      ub.href = '#/login';
      ub.textContent = t('login');
    }
  }

  // ---------- Данные ----------
  async function loadSchedule(day) {
    const key = `${S.city}|${day}`;
    if (!S.sched[key]) S.sched[key] = (await api(`/schedule?date=${day}&city=${encodeURIComponent(S.city)}`)).shows;
    return S.sched[key];
  }

  function dateStrip(onPick) {
    const wrap = document.createElement('div');
    wrap.className = 'dates';
    let lastMonth = -1;
    S.cat.days.forEach((iso, idx) => {
      const d = parseDay(iso);
      if (d.getMonth() !== lastMonth) {
        lastMonth = d.getMonth();
        const ml = document.createElement('span');
        ml.className = 'month';
        ml.textContent = t('months')[d.getMonth()];
        wrap.append(ml);
      }
      const b = document.createElement('button');
      b.className = 'day';
      b.setAttribute('aria-pressed', String(iso === S.date));
      b.innerHTML = `<small>${idx === 0 ? t('today') : idx === 1 ? t('tomorrow') : wd(iso)}</small><b>${d.getDate()}</b>`;
      b.addEventListener('click', () => { S.date = iso; onPick(); });
      wrap.append(b);
    });
    requestAnimationFrame(() => { const cur = $('.day[aria-pressed="true"]', wrap); cur && cur.scrollIntoView({ inline: 'center', block: 'nearest' }); });
    return wrap;
  }

  // ---------- Страница: кинотеатр / афиша ----------
  async function pageHome(page) {
    page.className = 'wide';
    const c = S.cat.cinema;
    page.innerHTML = `
      <section class="hero">
        <div class="hero-art" aria-hidden="true"><div class="hero-screen"></div>${[...Array(5)].map(() => '<i></i>').join('')}</div>
        <div class="hero-in">
          <h1>${esc(c.name)}</h1>
          <p class="muted"><svg class="ico" viewBox="0 0 24 24"><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>${esc(cityName(S.city))}, ${esc(L(c.address))}</p>
          <div class="chips">${Object.values(S.cat.halls).map((hl) => `<span class="chip">${esc(hl.name)} · ${esc(hl.format)}</span>`).join('')}</div>
        </div>
      </section>
      <div class="tabs" role="tablist">
        <button role="tab" data-tab="schedule">${t('tab_schedule')}</button>
        <button role="tab" data-tab="about">${t('tab_about')}</button>
      </div>
      <div id="tabBody"></div>`;
    $$('[data-tab]', page).forEach((b) => {
      b.setAttribute('aria-selected', String(b.dataset.tab === S.tab));
      b.addEventListener('click', () => { S.tab = b.dataset.tab; pageHome(page); });
    });
    const body = $('#tabBody', page);
    if (S.tab === 'about') return renderAbout(body);

    // «Скоро в кино»: фильмы в предпродаже
    const soon = S.cat.movies.filter(isPresale).filter(kidsOk).sort((a, b) => a.release.localeCompare(b.release));
    if (soon.length) {
      const strip = document.createElement('section');
      strip.className = 'soon';
      strip.innerHTML = `<h3>${t('soon')}</h3><div class="soon-row">${soon.map((m) => `
        <a class="soon-card" href="#/movie/${m.id}">${poster(m)}
          <b>${esc(L(m.title))}</b><span class="presale">${t('presale')}</span><small>${t('premiere')}: ${fmtDay(m.release)}</small>
        </a>`).join('')}</div>`;
      body.append(strip);
    }
    const kidsBar = document.createElement('div');
    kidsBar.className = 'kids-bar';
    kidsBar.innerHTML = `<button class="chip-btn${S.kids ? ' on' : ''}" id="kidsBtn" aria-pressed="${S.kids}">🧸 ${t('kids_mode')}</button>
      <button class="chip-btn${S.sortFree ? ' on' : ''}" id="sortBtn" aria-pressed="${S.sortFree}">${t('sort_free')}</button>
      <a class="chip-btn" href="#/gift">🎁 ${t('gift_title')}</a>`;
    body.append(kidsBar);
    $('#kidsBtn', kidsBar).addEventListener('click', () => { S.kids = !S.kids; store.set('kids', S.kids); updateChrome(); toast(S.kids ? t('kids_on') : t('kids_off')); pageHome(page); });
    $('#sortBtn', kidsBar).addEventListener('click', () => { S.sortFree = !S.sortFree; pageHome(page); });
    body.append(dateStrip(() => pageHome(page)));
    const toggle = document.createElement('div');
    toggle.className = 'seg';
    toggle.innerHTML = `<button data-mode="movies">${t('by_movies')}</button><button data-mode="halls">${t('by_halls')}</button>`;
    $$('button', toggle).forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.mode === S.mode));
      b.addEventListener('click', () => { S.mode = b.dataset.mode; store.set('mode', S.mode); pageHome(page); });
    });
    body.append(toggle);

    const list = document.createElement('div');
    list.className = 'list';
    list.innerHTML = '<div class="skeleton"></div><div class="skeleton"></div>';
    body.append(list);
    const day = S.date;
    const ok = fresh();
    let shows;
    try { shows = await loadSchedule(day); } catch (e) { if (ok()) list.innerHTML = `<p class="empty">${esc(errMsg(e))}</p>`; return; }
    if (day !== S.date || !ok()) return;
    shows = shows.filter((x) => kidsOk(movieById(x.movie_id) || {}));
    if (!shows.length) { list.innerHTML = `<p class="empty">${S.kids ? t('kids_empty') : t('no_shows')}</p>`; return; }
    list.innerHTML = S.mode === 'movies' ? byMovies(shows) : byHalls(shows);
  }

  const priceCells = (p) => `<span class="pc">${money(p.adult)}</span><span class="pc">${money(p.child)}</span><span class="pc">${money(p.student)}</span><span class="pc vip">${money(p.vip)}</span>`;
  const sessHead = (second) => `<div class="srow shead"><span>${t('col_time')}</span><span>${second}</span><span>${t('col_lang')}</span><span class="pc">${t('col_adult')}</span><span class="pc">${t('col_child')}</span><span class="pc">${t('col_student')}</span><span class="pc">${t('col_vip')}</span></div>`;
  function sessRow(s, second) {
    const tag = s.past ? 'div' : 'a';
    return `<${tag} class="srow${s.past ? ' past' : ''}" ${s.past ? '' : `href="#/session/${s.id}"`}>
      <b class="stime">${s.time}</b><span class="shall">${second}<small class="send">${t('till', { t: endTime(s) })}</small>${occBadge(s)}</span><span class="slang">${langLabel(s.lang)}</span>
      ${priceCells(s.prices)}<span class="sfrom">${s.past ? t('past') : t('from', { p: money(Math.min(s.prices.adult, s.prices.student)) })}</span>
    </${tag}>`;
  }

  function byMovies(shows) {
    const groups = new Map();
    shows.forEach((s) => { if (!groups.has(s.movie_id)) groups.set(s.movie_id, []); groups.get(s.movie_id).push(s); });
    if (S.sortFree) groups.forEach((ss) => ss.sort((a, b) => (a.past - b.past) || ((b.free ?? 0) - (a.free ?? 0))));
    return [...groups].map(([mid, ss]) => {
      const m = movieById(mid);
      return `<article class="mcard">
        <a href="#/movie/${m.id}" class="mposter">${poster(m, 'sm')}</a>
        <div class="mbody">
          <div class="mtitle-row"><a href="#/movie/${m.id}" class="mtitle"><h3>${esc(L(m.title))}</h3><span class="age">${m.age}+</span></a>${favBtn(m)}</div>
          <p class="meta">${starsTxt(m)}${isPresale(m) ? `<span class="presale">${t('presale')}</span> ` : ''}${esc(L(m.genre))}<span data-dur="${m.id}">${runtime(m) ? ` · ${durText(m)}` : ''}</span></p>
          <div class="stable">${sessHead(t('col_hall'))}${ss.map((s) => sessRow(s, `${S.cat.halls[s.hall].name} · ${s.format}`)).join('')}</div>
        </div>
      </article>`;
    }).join('');
  }

  function byHalls(shows) {
    return Object.entries(S.cat.halls).map(([hid, hl]) => {
      const ss = shows.filter((s) => String(s.hall) === hid);
      if (S.sortFree) ss.sort((a, b) => (a.past - b.past) || ((b.free ?? 0) - (a.free ?? 0)));
      if (!ss.length) return '';
      return `<article class="hcard"><h3>${esc(hl.name)} <span class="chip">${esc(hl.format)}</span></h3>
        <div class="stable">${sessHead(S.lang === 'kk' ? 'Фильм' : 'Фильм')}${ss.map((s) => {
          const m = movieById(s.movie_id);
          return sessRow(s, `${esc(L(m.title))} <span class="age">${m.age}+</span>`);
        }).join('')}</div></article>`;
    }).join('');
  }

  function renderAbout(body) {
    const c = S.cat.cinema;
    body.innerHTML = `<div class="about">
      <p>${t('about_text')}</p>
      <div class="about-grid">
        <div class="info-card"><h4>${t('halls_title')}</h4>${Object.values(S.cat.halls).map((hl) => `<p>${esc(hl.name)} — ${esc(hl.format)}, 126 + VIP</p>`).join('')}</div>
        <div class="info-card"><h4>${t('address')}</h4><p>${esc(cityName(S.city))}, ${esc(L(c.address))}</p><h4>${t('hours')}</h4><p>${esc(c.hours)}</p></div>
        <div class="info-card"><h4>${t('contacts')}</h4><p>${esc(c.phone)}</p></div>
      </div>
    </div>`;
  }

  // ---------- Страница: фильм ----------
  async function pageMovie(page, id) {
    const m = movieById(Number(id));
    // фильм в предпродаже: сразу открыть день премьеры
    if (m && m.release && S.date < m.release && S.cat.days.includes(m.release)) S.date = m.release;
    if (!m) return notFound(page);
    page.className = 'wide';
    page.innerHTML = `
      <a class="back" href="#/cinema">‹ ${t('back')}</a>
      <section class="movie">
        ${poster(m, 'lg')}
        <div class="movie-info">
          <h1>${esc(L(m.title))} <span class="age">${m.age}+</span></h1>
          <p class="m-rating" id="mRating">${starsTxt(m)}</p>
          <div class="m-actions">
            <button class="btn btn-white btn-sm" data-trailer="${m.id}" ${trailerOf(m) ? '' : 'hidden'}><svg class="ico" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" fill="currentColor" stroke="none"/></svg>${t('watch_trailer')}</button>
            ${favBtn(m, true)}
            ${isPresale(m) ? remindBtn(m) : ''}
          </div>
          <dl class="facts">
            <div><dt>${t('genre')}</dt><dd>${esc(L(m.genre))}</dd></div>
            ${m.release && isPresale(m) ? `<div><dt>${t('premiere')}</dt><dd>${fmtDay(m.release)}</dd></div>` : ''}
            <div><dt>${t('duration')}</dt><dd data-dur-plain="${m.id}">${runtime(m) ? durText(m) : '—'}</dd></div>
            <div><dt>${t('langs')}</dt><dd>${m.langs.map(langLabel).join(', ')}</dd></div>
          </dl>
          <h3>${t('about_movie')}</h3>
          <p class="muted">${esc(L(m.about))}</p>
          <h3>${t('sessions_for')}</h3>
          <div id="mDates"></div>
          <div class="chipsess" id="mSess"></div>
          <h3>${t('reviews')}</h3>
          <div id="reviews" class="reviews"><div class="skeleton small"></div></div>
        </div>
      </section>`;
    loadReviews(m);
    const draw = async () => {
      $('#mDates', page).replaceChildren(dateStrip(draw));
      const box = $('#mSess', page);
      const day = S.date;
      const ok = fresh();
      const shows = (await loadSchedule(day)).filter((s) => s.movie_id === m.id);
      if (day !== S.date || !ok()) return;
      box.innerHTML = shows.length ? shows.map((s) => {
        const inner = `<b>${s.time} <em class="send">→ ${endTime(s)}</em></b><span>${S.cat.halls[s.hall].name} · ${s.format} · ${langLabel(s.lang)}</span><small>${s.past ? t('past') : t('from', { p: money(Math.min(s.prices.adult, s.prices.student)) })}</small>${occBadge(s)}`;
        return s.past ? `<div class="sbtn past">${inner}</div>` : `<a class="sbtn" href="#/session/${s.id}">${inner}</a>`;
      }).join('') : `<p class="empty">${t('no_shows')}</p>`;
    };
    await draw();
  }

  // ---------- Страница: выбор мест ----------
  const showLine = (show) => `${show.city ? cityName(show.city) + ' · ' : ''}${fmtDay(show.date)}, ${show.time} · ${S.cat.halls[show.hall].name} · ${show.format} · ${langLabel(show.lang)}`;
  const AISLES = [3, 11];

  async function pageSession(page, id) {
    let data;
    const ok = fresh();
    try { data = await api(`/showtimes/${id}`); } catch (e) { return ok() && notFound(page, errMsg(e)); }
    if (!ok()) return;
    const { show, movie } = data;
    let taken = new Set(data.taken);
    let held = new Set(data.held || []);
    if (!S.order || S.order.showId !== id) S.order = { showId: id, seats: [], types: {} };
    S.order.seats = S.order.seats.filter(({ r, i }) => !taken.has(seatName(r, i)) && !held.has(seatName(r, i)));
    saveOrder();
    const { rows, seats: perRow, max_seats: maxSeats } = S.cat.layout;
    const priceFor = (r, i) => {
      if (isVip(r)) return show.prices.vip;
      const tp = S.order.types[seatName(r, i)] || 'adult';
      return show.prices[tp] ?? show.prices.adult;
    };

    const d = parseDay(show.date);
    const dateShort = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getFullYear()).slice(2)}`;
    page.className = 'narrow seatpage';
    page.innerHTML = `
      <div class="sp-top">
        <a class="icon-btn" href="#/movie/${movie.id}" aria-label="${t('back')}"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></a>
        <h1>${t('choose_seats')}</h1>
      </div>
      <div class="sp-head">
        ${poster(movie, 'xs')}
        <div class="sp-info">
          <h2>${esc(L(movie.title))}</h2>
          <p class="sp-meta">${dateShort} • ${show.time}–${endTime(show)} • ${show.format} <span class="badge">${langLabel(show.lang)}</span> <span class="badge badge-age">${movie.age}+</span></p>
          <p class="sp-place">${esc(S.cat.cinema.name)} ${esc(cityName(show.city))} • ${esc(S.cat.halls[show.hall].name)}</p>
        </div>
      </div>
      ${show.past ? `<p class="warn">${t('show_started')}</p>` : ''}
      <div class="map">
        <div class="zoom">
          <button class="zbtn" id="zIn" aria-label="${t('zoom_in')}"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></button>
          <button class="zbtn" id="zOut" aria-label="${t('zoom_out')}"><svg viewBox="0 0 24 24"><path d="M5 12h14"/></svg></button>
        </div>
        <div class="hall-scroll" id="hallScroll"><div class="hall-inner" id="hallInner">
          <div class="screen2" aria-hidden="true">
            <svg viewBox="0 0 400 64" preserveAspectRatio="none">
              <defs><linearGradient id="scrFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e9e6ec" stop-opacity=".55"/><stop offset="1" stop-color="#e9e6ec" stop-opacity=".04"/></linearGradient></defs>
              <path d="M2 10 Q200 -8 398 10 L378 60 Q200 44 22 60 Z" fill="url(#scrFill)"/>
              <path d="M2 10 Q200 -8 398 10" fill="none" stroke="#f4f2f5" stroke-opacity=".8" stroke-width="2.5"/>
            </svg>
            <span>${t('screen')}</span>
          </div>
          <div class="grid" id="grid" role="grid"></div>
        </div></div>
      </div>
      <ul class="legend">
        <li><i class="dot available"></i>${t('available')}</li>
        <li><i class="dot taken"></i>${t('taken')}</li>
        <li><i class="dot held"></i>${t('held')}</li>
        <li><i class="dot vipd"></i>${t('vip')} · ${money(show.prices.vip)}</li>
        <li><i class="dot selected"></i>${t('selected')}</li>
      </ul>
      <div class="sp-bar">
        <div class="bar-info"><span class="bar-label" id="barLabel"></span><strong class="bar-price" id="barPrice"></strong></div>
        <button class="btn btn-ghost-b" id="v3dBtn"><svg class="ico" viewBox="0 0 24 24"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg><span>${t('view3d')}</span></button>
        <button class="btn btn-green" id="contBtn">${t('continue')}</button>
      </div>`;

    const grid = $('#grid', page);
    const isSel = (r, i) => S.order.seats.some((s) => s.r === r && s.i === i);
    const drawGrid = () => {
      grid.innerHTML = '';
      for (let r = 0; r < rows.length; r++) {
        // VIP-ряды отделены от основного зала небольшим проходом
        if (isVip(r) && !isVip(r - 1)) grid.append(Object.assign(document.createElement('div'), { className: 'row-gap' }));
        for (let i = 0; i < perRow; i++) {
          if (AISLES.includes(i)) grid.append(Object.assign(document.createElement('div'), { className: 'aisle' }));
          const b = document.createElement('button');
          const name = seatName(r, i);
          const tk = taken.has(name);
          const hd = !tk && held.has(name);
          const sel = isSel(r, i);
          b.className = 'seat' + (isVip(r) ? ' vip' : '') + (tk ? ' taken' : '') + (hd ? ' held' : '') + (sel ? ' selected' : '');
          b.disabled = tk || hd || show.past;
          b.textContent = i + 1;
          b.setAttribute('aria-label', t('row_seat', { r: r + 1, s: i + 1 }) + (tk ? `, ${t('taken')}` : hd ? `, ${t('held')}` : ''));
          b.setAttribute('aria-pressed', String(sel));
          b.addEventListener('click', () => {
            if (sel) S.order.seats = S.order.seats.filter((s) => !(s.r === r && s.i === i));
            else if (S.order.seats.length >= maxSeats) return toast(t('max_seats', { n: maxSeats }));
            else S.order.seats.push({ r, i });
            saveOrder(); drawGrid(); drawBar(); syncHolds();
          });
          grid.append(b);
        }
        const lab = document.createElement('div');
        lab.className = 'row-label';
        lab.textContent = t('row_n', { n: r + 1 });
        grid.append(lab);
      }
    };

    // масштаб схемы: «по ширине экрана» и два уровня приближения
    const hs = $('#hallScroll'), inner = $('#hallInner');
    const ZOOMS = [1, 1.4, 1.85];
    let zoom = Math.min(store.get('zoom', 0), ZOOMS.length - 1);
    const applyZoom = (keepCenter) => {
      const cx = hs.scrollWidth ? (hs.scrollLeft + hs.clientWidth / 2) / hs.scrollWidth : 0.5;
      // ширина = поля 2×16 + подпись ряда ~62 + 16 промежутков по 3px + 14 мест + 2 прохода по 0.7 места
      const labelW = 62, gap = 3, pad = 32;
      const fit = (hs.clientWidth - pad - labelW - (perRow + 2) * gap) / (perRow + 2 * 0.7);
      const base = Math.max(14, Math.min(30, Math.floor(fit)));
      const s = Math.round(base * ZOOMS[zoom]);
      inner.style.setProperty('--s', s + 'px');
      inner.style.setProperty('--a', Math.round(s * 0.7) + 'px');
      $('#zIn').disabled = zoom === ZOOMS.length - 1;
      $('#zOut').disabled = zoom === 0;
      hs.scrollLeft = keepCenter ? cx * hs.scrollWidth - hs.clientWidth / 2 : (hs.scrollWidth - hs.clientWidth) / 2;
    };
    $('#zIn').addEventListener('click', () => { zoom = Math.min(zoom + 1, ZOOMS.length - 1); store.set('zoom', zoom); applyZoom(true); });
    $('#zOut').addEventListener('click', () => { zoom = Math.max(zoom - 1, 0); store.set('zoom', zoom); applyZoom(true); });
    window.addEventListener('resize', function onRz() {
      if (!document.body.contains(hs)) return window.removeEventListener('resize', onRz);
      applyZoom(true);
    });
    const total = () => S.order.seats.reduce((sum, { r, i }) => sum + priceFor(r, i), 0);
    const drawBar = () => {
      const n = S.order.seats.length;
      if (n === 1) { const { r, i } = S.order.seats[0]; $('#barLabel').textContent = t('row_seat_short', { r: r + 1, s: i + 1 }); }
      else $('#barLabel').textContent = n ? t('seats_n', { n }) : t('choose_seats');
      $('#barPrice').textContent = n ? money(total()) : '—';
      $('#contBtn').disabled = !n || show.past;
      $('#v3dBtn').disabled = !n;
    };
    // удержание выбранных мест на сервере (другие видят их занятыми 10 минут)
    let holdReq = null;
    const syncHolds = () => {
      clearTimeout(holdReq);
      return new Promise((resolve) => {
        holdReq = setTimeout(async () => {
          try {
            const res = await api('/holds', { method: 'POST', body: { showtime_id: id, seats: S.order.seats.map(({ r, i }) => seatName(r, i)) } });
            if (res.conflicts.length) {
              const lost = new Set(res.conflicts);
              S.order.seats = S.order.seats.filter(({ r, i }) => !lost.has(seatName(r, i)));
              res.conflicts.forEach((x) => held.add(x));
              saveOrder(); drawGrid(); drawBar();
              toast(t('seat_grabbed'));
            }
          } catch { /* сеть — попробуем при следующем изменении */ }
          resolve();
        }, 250);
      });
    };
    // обновление схемы каждые 5 секунд: чужие покупки и удержания появляются сразу
    clearInterval(liveTimer);
    liveTimer = setInterval(async () => {
      if (!document.body.contains(grid)) { clearInterval(liveTimer); return; }
      if (document.hidden || $('.view')) return;
      try {
        const fresh = await api(`/showtimes/${id}`);
        taken = new Set(fresh.taken);
        held = new Set(fresh.held || []);
        const before = S.order.seats.length;
        S.order.seats = S.order.seats.filter(({ r, i }) => !taken.has(seatName(r, i)) && !held.has(seatName(r, i)));
        if (S.order.seats.length !== before) { saveOrder(); toast(t('seat_grabbed')); }
        drawGrid(); drawBar();
      } catch { /* нет сети */ }
    }, 5000);
    const goNext = async () => {
      await syncHolds();
      if (!S.order.seats.length) return;
      S.order.holdUntil = Date.now() + 10 * 60 * 1000;
      saveOrder();
      if (!S.user) { toast(t('login_to_pay')); location.hash = '#/login?next=checkout'; }
      else location.hash = '#/checkout';
    };
    $('#contBtn').addEventListener('click', goNext);
    $('#v3dBtn').addEventListener('click', () => open3D(page, show, movie, priceFor, total, goNext));
    drawGrid(); drawBar();
    if (S.order.seats.length) syncHolds();
    applyZoom(false); // при увеличении схема шире окна — показываем её центр (там лучшие места)
  }

  function open3D(page, show, movie, priceFor, total, goNext) {
    const target = S.order.seats[S.order.seats.length - 1];
    if (!target) return;
    const { r, i } = target;
    const inf = Hall3D.info(r, i);
    const rows = S.cat.layout.rows;
    const offAbs = Math.abs(inf.off);
    const view = document.createElement('section');
    view.className = 'view';
    view.innerHTML = `
      <canvas></canvas>
      <button class="view-close icon-btn" aria-label="${t('back')}"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button>
      <p class="view-hint">${t('drag_hint')}</p>
      <span class="view-mood"></span>
      <button class="view-sound icon-btn" hidden aria-pressed="false" aria-label="${t('sound_on')}">🔇</button>
      <div class="sheet">
        <button class="handle-btn" aria-expanded="true" aria-label="${t('sheet_hide')}"><span class="handle"></span></button>
        <div class="sheet-mini">
          <div class="mini-txt"><b>${t('row_seat', { r: r + 1, s: i + 1 })}</b><span>${inf.dist.toFixed(1)} м · ${inf.fov}°</span></div>
          <button class="btn btn-white btn-sm" data-act="next">${money(total())} <svg class="ico" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg></button>
        </div>
        <div class="sheet-body">
        <div class="sheet-head">
          <div><span class="kicker">${t(inf.kind)}</span>
            <h2>${t('row_seat', { r: r + 1, s: i + 1 })}</h2>
            <span class="sub">${isVip(r) ? 'VIP' : t('standard')} · ${money(priceFor(r, i))}</span></div>
          <svg class="minimap" viewBox="0 0 64 54" aria-hidden="true"><path d="M4 6 Q32 0 60 6" fill="none" stroke="#bdbac2"/>
            ${rows.split('').map((_, rr) => [...Array(14)].map((__, ii) => {
              const on = rr === r && ii === i;
              const sel = S.order.seats.some((s) => s.r === rr && s.i === ii);
              const x = 4 + ii * 3.6 + (ii >= 3 ? 1.6 : 0) + (ii >= 11 ? 1.6 : 0);
              return `<rect x="${x.toFixed(1)}" y="${12 + rr * 4.6}" width="${on ? 2.6 : 1.8}" height="${on ? 2.6 : 1.8}" rx=".5" fill="${on || sel ? '#5fd38d' : '#3a383e'}"/>`;
            }).join('')).join('')}
          </svg>
        </div>
        <div class="stats">
          <div class="stat"><b>${inf.dist.toFixed(1)} м</b><span>${t('to_screen')}</span></div>
          <div class="stat"><b>${inf.fov}°</b><span>${t('fov')}</span></div>
          <div class="stat"><b>${offAbs.toFixed(1)} м</b><span>${offAbs < 0.05 ? t('centre') : inf.off < 0 ? t('left_c') : t('right_c')}</span></div>
        </div>
        <div class="sheet-actions">
          <button class="btn btn-ghost" data-act="change">${t('change_seat')}</button>
          <button class="btn btn-white" data-act="next">${t('continue')} · ${money(total())}</button>
        </div>
        </div>
      </div>`;
    page.append(view);
    document.body.classList.add('no-scroll');
    const sheet = $('.sheet', view), hint = $('.view-hint', view);
    const close = () => { Hall3D.close(); view.remove(); document.body.classList.remove('no-scroll'); };
    $('.view-close', view).addEventListener('click', close);
    $('[data-act="change"]', view).addEventListener('click', close);
    $$('[data-act="next"]', view).forEach((b) => b.addEventListener('click', () => { close(); goNext(); }));

    // панель можно свернуть: нажатием на полоску или свайпом вниз; развернуть — нажатием или свайпом вверх
    const handleBtn = $('.handle-btn', view);
    const setMin = (min) => {
      sheet.classList.toggle('min', min);
      handleBtn.setAttribute('aria-expanded', String(!min));
      handleBtn.setAttribute('aria-label', t(min ? 'sheet_show' : 'sheet_hide'));
      store.set('sheetMin', min);
    };
    let swipe = null;
    sheet.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button:not(.handle-btn)')) return;
      swipe = { y: e.clientY, moved: false };
    });
    sheet.addEventListener('pointermove', (e) => {
      if (swipe && Math.abs(e.clientY - swipe.y) > 8) swipe.moved = true;
    });
    sheet.addEventListener('pointerup', (e) => {
      if (!swipe) return;
      const dy = e.clientY - swipe.y;
      if (dy > 30) setMin(true);
      else if (dy < -30) setMin(false);
      else if (!swipe.moved && (e.target.closest('.handle-btn') || sheet.classList.contains('min'))) setMin(!sheet.classList.contains('min'));
      swipe = null;
    });
    sheet.addEventListener('pointercancel', () => { swipe = null; });
    if (store.get('sheetMin', false)) setMin(true);
    view.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
    $('.view-close', view).focus();
    if (!Hall3D.available()) { sheet.classList.add('open'); return; }
    const hour = Number(show.starts_at.slice(11, 13));
    const mood = hour >= 20 || hour < 6 ? 'night' : hour >= 17 ? 'evening' : 'day';
    const trailerKey = trailerOf(movie);
    $('.view-mood', view).textContent = t('mood_' + mood);
    Hall3D.open($('canvas', view), {
      selected: S.order.seats, target, mood,
      onArrive: () => { sheet.classList.add('open'); hint.classList.add('show'); setTimeout(() => hint.classList.remove('show'), 3000); },
      onDrag: () => hint.classList.remove('show'),
    });
    // трейлер включается на экране зала сам, со звуком; если браузер запретил автозвук — кнопка 🔊
    if (trailerKey && Hall3D.canTrailer()) {
      const sb = $('.view-sound', view);
      Hall3D.setTrailer(trailerKey, {
        onSound: (on) => {
          sb.hidden = false;
          sb.setAttribute('aria-pressed', String(on));
          sb.textContent = on ? '🔊' : '🔇';
          sb.setAttribute('aria-label', on ? t('sound_off') : t('sound_on'));
        },
      });
      sb.addEventListener('click', () => Hall3D.setMuted(sb.getAttribute('aria-pressed') === 'true'));
    }
  }

  // ---------- Страница: оплата ----------
  let holdTimer = null;
  let liveTimer = null;
  let cardDraft = null;

  async function pageCheckout(page) {
    if (!S.order || !S.order.seats.length) { location.hash = '#/cinema'; return; }
    if (!S.user) { location.hash = '#/login?next=checkout'; return; }
    let data, bonus = { balance: 0, max_share: 50 };
    const ok = fresh();
    try {
      [data, bonus] = await Promise.all([api(`/showtimes/${S.order.showId}`), api('/me/bonus').catch(() => bonus)]);
    } catch (e) { return ok() && notFound(page, errMsg(e)); }
    if (!ok()) return;
    const { show, movie } = data;
    const taken = new Set([...data.taken, ...(data.held || [])]);
    const lost = S.order.seats.filter(({ r, i }) => taken.has(seatName(r, i)));
    if (lost.length || show.past || !S.order.holdUntil || S.order.holdUntil < Date.now()) {
      toast(show.past ? t('show_started') : lost.length ? t('err_seats_taken', { s: lost.map(({ r, i }) => seatName(r, i)).join(', ') }) : t('hold_expired'));
      location.hash = `#/session/${show.id}`;
      return;
    }
    const rows = S.cat.layout.rows;
    const defType = S.kids && show.prices.child != null ? 'child' : 'adult';
    const typeOf = (r, i) => (isVip(r) ? 'vip' : S.order.types[seatName(r, i)] || defType);
    const priceOf = (r, i) => show.prices[typeOf(r, i)];
    const total = () => S.order.seats.reduce((s, { r, i }) => s + priceOf(r, i), 0);
    let useBonus = false;
    let gift = null; // { code, balance }
    const calc = () => {
      const tot = total();
      const b = useBonus ? Math.min(bonus.balance, Math.floor(tot * (bonus.max_share || 50) / 100)) : 0;
      const g = gift ? Math.min(gift.balance, tot - b) : 0;
      return { tot, b, g, paid: tot - b - g };
    };

    page.className = 'mid';
    page.innerHTML = `
      <a class="back" href="#/session/${show.id}">‹ ${t('back')}</a>
      <h1>${t('checkout')}</h1>
      <div class="co">
        <section class="card co-sum">
          <div class="co-movie">${poster(movie, 'xs')}<div><h3>${esc(L(movie.title))}</h3><p class="muted">${showLine(show)}</p></div></div>
          <div class="co-seats" id="coSeats"></div>
          <p class="note" id="stuNote" hidden>${t('student_note')}</p>
          <div class="co-extras">
            <label class="co-opt" ${bonus.balance > 0 ? '' : 'hidden'}><input type="checkbox" id="useBonus"> <span>${t('use_bonus', { n: bonus.balance })}</span></label>
            <div class="gift-apply"><input id="giftCode" placeholder="KADR-XXXX-XXXX" maxlength="14" autocapitalize="characters" aria-label="${t('gift_code')}"><button type="button" class="btn btn-ghost-b btn-sm" id="giftBtn">${t('apply')}</button></div>
            <p class="small muted" id="giftInfo"></p>
          </div>
          <div class="co-lines" id="coLines"></div>
          <div class="co-total"><span>${t('to_pay')}</span><b id="coTotal"></b></div>
          <p class="small earn" id="coEarn"></p>
          <p class="hold" id="hold"></p>
        </section>
        <form class="card co-pay" id="payForm" novalidate>
          <div id="cardBox">
          <h3>${t('card')} <span class="brand" id="brand"></span></h3>
          <label class="field"><span>${t('card_number')}</span><input id="cNum" inputmode="numeric" autocomplete="cc-number" placeholder="0000 0000 0000 0000" maxlength="23" required></label>
          <div class="field-row">
            <label class="field"><span>${t('card_exp')}</span><input id="cExp" inputmode="numeric" autocomplete="cc-exp" placeholder="12/29" maxlength="5" required></label>
            <label class="field"><span>${t('card_cvc')}</span><input id="cCvc" inputmode="numeric" autocomplete="cc-csc" placeholder="123" maxlength="4" type="password" required></label>
          </div>
          <label class="field"><span>${t('card_holder')}</span><input id="cHolder" autocomplete="cc-name" autocapitalize="characters" placeholder="IVAN IVANOV" required></label>
          </div>
          <p class="form-err" id="payErr" role="alert"></p>
          <button class="btn btn-green btn-block" id="payBtn" type="submit"></button>
          <div class="demo">
            <p>${t('demo_pay')}</p>
            <button type="button" class="demo-card" data-num="4242 4242 4242 4242"><code>4242 4242 4242 4242</code><span>${t('demo_ok')}</span></button>
            <button type="button" class="demo-card" data-num="4000 0000 0000 0002"><code>4000 0000 0000 0002</code><span>${t('demo_fail')}</span></button>
          </div>
        </form>
      </div>`;

    const drawSeats = () => {
      $('#coSeats').innerHTML = S.order.seats.map(({ r, i }) => {
        const name = seatName(r, i);
        const ty = typeOf(r, i);
        const sel = isVip(r) ? `<span class="tfixed">VIP</span>`
          : `<select data-seat="${name}" aria-label="${t('ticket_type')}">${['adult', 'child', 'student'].filter((k) => show.prices[k] != null)
            .map((k) => `<option value="${k}" ${k === ty ? 'selected' : ''}>${t('t_' + k)}</option>`).join('')}</select>`;
        return `<div class="co-seat"><span>${t('row_seat', { r: r + 1, s: i + 1 })}</span>${sel}<b>${money(priceOf(r, i))}</b></div>`;
      }).join('');
      $$('select[data-seat]').forEach((s) => s.addEventListener('change', () => { S.order.types[s.dataset.seat] = s.value; saveOrder(); drawSeats(); }));
      drawTotals();
      $('#stuNote').hidden = !S.order.seats.some(({ r, i }) => typeOf(r, i) === 'student');
    };
    function drawTotals() {
      const c = calc();
      $('#coLines').innerHTML = `<div class="co-line"><span>${t('total')}</span><span>${money(c.tot)}</span></div>`
        + (c.b ? `<div class="co-line minus"><span>${t('bonus_line')}</span><span>−${money(c.b)}</span></div>` : '')
        + (c.g ? `<div class="co-line minus"><span>${t('gift_line')}</span><span>−${money(c.g)}</span></div>` : '');
      $('#coTotal').textContent = money(c.paid);
      $('#coEarn').textContent = c.paid > 0 ? t('will_earn', { n: Math.floor(c.paid * 0.05) }) : '';
      $('#payBtn').textContent = c.paid > 0 ? t('pay', { p: money(c.paid) }) : t('pay_free');
      $('#cardBox').hidden = c.paid <= 0;
      $$('#cardBox input').forEach((x) => { x.required = c.paid > 0; });
    }
    drawSeats();
    $('#useBonus').addEventListener('change', (e) => { useBonus = e.target.checked; drawTotals(); });
    $('#giftBtn').addEventListener('click', async () => {
      const code = $('#giftCode').value.trim().toUpperCase();
      const info = $('#giftInfo');
      if (!code) { gift = null; info.textContent = ''; drawTotals(); return; }
      try {
        const { gift: g } = await api(`/gift/${encodeURIComponent(code)}`);
        if (g.balance <= 0) { gift = null; info.textContent = t('err_gift_empty'); }
        else { gift = { code: g.code, balance: g.balance }; info.textContent = t('gift_ok', { n: money(g.balance) }); }
      } catch (e) { gift = null; info.textContent = errMsg(e); }
      drawTotals();
    });

    const tick = () => {
      const left = Math.max(0, S.order.holdUntil - Date.now());
      const mm = String(Math.floor(left / 60000)).padStart(2, '0');
      const sec = String(Math.floor((left % 60000) / 1000)).padStart(2, '0');
      $('#hold').textContent = t('hold_timer', { t: `${mm}:${sec}` });
      if (!left) { clearInterval(holdTimer); toast(t('hold_expired')); location.hash = `#/session/${show.id}`; }
    };
    tick();
    holdTimer = setInterval(tick, 1000);

    const num = $('#cNum'), exp = $('#cExp'), cvc = $('#cCvc'), holder = $('#cHolder');
    const brandOf = (d) => (/^4/.test(d) ? 'VISA' : /^(5[1-5]|2[2-7])/.test(d) ? 'Mastercard' : '');
    num.addEventListener('input', () => {
      const d = num.value.replace(/\D/g, '').slice(0, 19);
      num.value = d.replace(/(.{4})/g, '$1 ').trim();
      $('#brand').textContent = brandOf(d);
    });
    exp.addEventListener('input', (e) => {
      let d = exp.value.replace(/\D/g, '').slice(0, 4);
      if (d.length >= 3 || (d.length === 2 && e.inputType !== 'deleteContentBackward')) d = d.slice(0, 2) + '/' + d.slice(2);
      exp.value = d;
    });
    cvc.addEventListener('input', () => { cvc.value = cvc.value.replace(/\D/g, '').slice(0, 4); });
    holder.addEventListener('input', () => { holder.value = holder.value.toUpperCase(); });
    // восстановить введённое после смены языка (только в памяти, никуда не сохраняется)
    if (cardDraft) {
      num.value = cardDraft.num; exp.value = cardDraft.exp; cvc.value = cardDraft.cvc; holder.value = cardDraft.holder;
      num.dispatchEvent(new Event('input'));
      cardDraft = null;
    }
    $$('.demo-card').forEach((b) => b.addEventListener('click', () => {
      num.value = b.dataset.num; num.dispatchEvent(new Event('input'));
      exp.value = '12/30'; cvc.value = '123';
      if (!holder.value) holder.value = (S.user.name || 'DEMO USER').toUpperCase();
    }));

    $('#payForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = $('#payBtn'), errEl = $('#payErr');
      errEl.textContent = '';
      btn.disabled = true;
      btn.innerHTML = `<span class="spin"></span>${t('paying')}`;
      try {
        await sleep(1200); // имитация обработки в банке
        const res = await api('/bookings', {
          method: 'POST',
          body: {
            showtime_id: show.id,
            seats: S.order.seats.map(({ r, i }) => ({ seat: seatName(r, i), type: typeOf(r, i) })),
            expected_total: total(),
            use_bonus: calc().b,
            gift_code: gift ? gift.code : undefined,
            card: calc().paid > 0 ? { number: num.value, exp: exp.value, cvc: cvc.value, holder: holder.value } : undefined,
          },
        });
        clearInterval(holdTimer);
        S.order = null; saveOrder();
        Object.keys(S.sched).forEach((k) => delete S.sched[k]);
        location.hash = `#/ticket/${res.booking.code}?new=1`;
      } catch (err) {
        errEl.textContent = errMsg(err);
        if (err.code === 'seats_taken') {
          const gone = new Set(err.data.seats || []);
          S.order.seats = S.order.seats.filter(({ r, i }) => !gone.has(seatName(r, i)));
          saveOrder();
          setTimeout(() => { location.hash = `#/session/${show.id}`; }, 1800);
        }
        if (err.code === 'auth_required') { S.user = null; location.hash = '#/login?next=checkout'; }
        btn.disabled = false;
        drawTotals();
      }
    });
  }

  // ---------- Билеты ----------
  function ticketHtml(b, big) {
    const m = b.movie, s = b.show;
    const rows = b.seats.map((x) => {
      const { r, i } = seatParse(x.seat);
      return `<li><span>${t('row_seat', { r: r + 1, s: i + 1 })}</span><span class="muted">${t('t_' + x.ticket_type)}</span><b>${money(x.price)}</b></li>`;
    }).join('');
    return `<div class="ticket ${big ? 'big' : ''}">
      <div class="t-top">${poster(m, 'xs')}<div><h3>${esc(L(m.title))} <span class="age">${m.age}+</span></h3><p class="muted">${showLine(s)}</p></div></div>
      <ul class="t-seats">${rows}</ul>
      <div class="t-foot"><div><small class="muted">${t('booking_code')}</small><b class="code">${esc(b.code)}</b></div><div class="t-sum"><small class="muted">${t('total')}</small><b>${money(b.total)}</b></div></div>
      ${big && (b.bonus_used || b.gift_used || b.bonus_earned) ? `<div class="t-extra">
        ${b.bonus_used ? `<span>${t('bonus_line')}: −${money(b.bonus_used)}</span>` : ''}
        ${b.gift_used ? `<span>${t('gift_line')}: −${money(b.gift_used)}</span>` : ''}
        ${b.bonus_earned ? `<span class="earn">+${b.bonus_earned} ${t('bonus_word')}</span>` : ''}</div>` : ''}
      ${big ? `<div class="t-qr"><div id="qr"></div><p class="muted">${t('show_qr')}</p>${b.card_last4 ? `<p class="muted small">${t('paid_with', { b: esc(b.card_brand), l: esc(b.card_last4) })}</p>` : ''}</div>` : ''}
    </div>`;
  }

  async function pageTicket(page, code, q) {
    if (!S.user) { location.hash = '#/login'; return; }
    let b;
    const ok = fresh();
    try { b = (await api(`/bookings/${encodeURIComponent(code)}`)).booking; } catch (e) { return ok() && notFound(page, errMsg(e)); }
    if (!ok()) return;
    page.className = 'narrow';
    page.innerHTML = `
      ${q.get('new') ? `<div class="success"><span class="check">✓</span><h1>${t('paid_ok')}</h1></div>` : `<a class="back" href="#/tickets">‹ ${t('my_tickets')}</a><h1>${t('your_ticket')}</h1>`}
      ${ticketHtml(b, true)}
      <div class="actions"><a class="btn btn-ghost-b" href="#/tickets">${t('my_tickets')}</a><a class="btn btn-white" href="#/cinema">${t('to_afisha')}</a></div>`;
    if (window.QRCode) new QRCode($('#qr'), { text: `KADR:${b.code}:${b.show.id}`, width: 168, height: 168, colorDark: '#0b0a0c', colorLight: '#ffffff' });
  }

  // билет стадиона / театра в «Мои билеты»: заголовок, дата, места, код, QR
  function venueTicketHtml(kind, x) {
    x = { ...x, seats: [...x.seats].sort((a, b) => { const [ra, sa] = a.split('-').map(Number), [rb, sb] = b.split('-').map(Number); return ra - rb || sa - sb; }) };
    const ST = window.StadiumTX || ((k) => k), TH = window.TheatreTX || ((k) => k);
    const idDate = (id) => { const m = /(\d{4})(\d{2})(\d{2})/.exec(id) || []; return m[1] ? `${m[1]}-${m[2]}-${m[3]}` : ''; };
    let ico, title, line, seats;
    if (kind === 'stadium') {
      ico = '🏟️';
      title = x.match ? `${esc(x.match.home)} — ${esc(x.match.away)}` : 'Қайсар Арена';
      line = `${fmtDay(x.match ? x.match.date : idDate(x.match_id))}${x.match ? ' · ' + x.match.time : ''} · Қайсар Арена`;
      seats = x.seats.map((p) => `<li><span>${ST('sector')} ${esc(x.sector)} · ${ST('row')} ${p.split('-')[0]}, ${ST('seat')} ${p.split('-')[1]}</span></li>`).join('');
    } else {
      ico = '🎭';
      title = x.show ? esc(L(x.show.play.title)) : TH('title');
      line = `${fmtDay(x.show ? x.show.date : idDate(x.show_id))}${x.show ? ' · ' + x.show.time : ''} · ${esc(TH('title'))}`;
      seats = x.seats.map((p) => `<li><span>${TH('row')} ${p.split('-')[0]}, ${TH('seat')} ${p.split('-')[1]}</span></li>`).join('');
    }
    return `<div class="ticket">
      <div class="t-top"><span class="t-ico">${ico}</span><div><h3>${title}</h3><p class="muted">${line}</p></div></div>
      <ul class="t-seats">${seats}</ul>
      <div class="t-foot"><div><small class="muted">${t('booking_code')}</small><b class="code">${esc(x.code)}</b></div><div class="t-sum"><small class="muted">${t('total')}</small><b>${money(x.total)}</b></div></div>
      <div class="t-qr small"><div data-qr="${kind === 'stadium' ? 'KAISAR' : 'BEKEZHANOV'}:${esc(x.code)}"></div></div>
    </div>`;
  }

  async function pageTickets(page) {
    page.className = 'mid';
    if (!S.user) {
      page.innerHTML = `<h1>${t('my_tickets')}</h1><div class="card center"><p>${t('err_auth_required')}</p><a class="btn btn-green" href="#/login?next=tickets">${t('login')}</a></div>`;
      return;
    }
    const ok = fresh();
    const safe = (p, key) => p.then((r) => r[key] || []).catch(() => []);
    const [bookings, stadium, theatre] = await Promise.all([
      safe(api('/bookings'), 'bookings'), safe(api('/stadium/my'), 'tickets'), safe(api('/theatre/my'), 'tickets'),
    ]);
    if (!ok()) return;
    const nowIso = new Date(Date.now() + 5 * 3600e3).toISOString().slice(0, 16); // время Казахстана (UTC+5), как в расписании
    const upcomingVenue = (x, ev) => ev && ev.starts_at > nowIso;
    const items = [
      ...bookings.filter((b) => b.show).map((b) => ({ up: !b.show.past, html: `<a href="#/ticket/${b.code}" class="tlink">${ticketHtml(b, false)}</a>` })),
      ...stadium.map((x) => ({ up: upcomingVenue(x, x.match), html: venueTicketHtml('stadium', x) })),
      ...theatre.map((x) => ({ up: upcomingVenue(x, x.show), html: venueTicketHtml('theatre', x) })),
    ];
    const block = (title, list) => (list.length ? `<h3 class="sec">${title}</h3><div class="tlist">${list.map((x) => x.html).join('')}</div>` : '');
    page.innerHTML = `<h1>${t('my_tickets')}</h1>` + (items.length ? block(t('upcoming'), items.filter((x) => x.up)) + block(t('past_tickets'), items.filter((x) => !x.up))
      : `<div class="card center"><p>${t('no_tickets')}</p><a class="btn btn-green" href="#/">${t('to_afisha')}</a></div>`);
    if (window.QRCode) page.querySelectorAll('[data-qr]').forEach((el) => new QRCode(el, { text: el.dataset.qr, width: 120, height: 120 }));
  }

  // ---------- Вход, регистрация, профиль ----------
  const nextHash = (q) => {
    const n = q.get('next') || '';
    if (/^movie-\d+$/.test(n)) return `#/movie/${n.slice(6)}`;
    return ({ checkout: '#/checkout', tickets: '#/tickets', admin: '#/admin', profile: '#/profile', gift: '#/gift' })[n] || '#/';
  };

  function authForm(page, q, kind) {
    page.className = 'auth';
    const reg = kind === 'register';
    const keep = q.get('next') ? `?next=${encodeURIComponent(q.get('next'))}` : '';
    page.innerHTML = `
      <form class="card auth-card" novalidate>
        <span class="logo-mark big">K</span>
        <h1>${t(reg ? 'register_title' : 'login_title')}</h1>
        ${reg ? `<label class="field"><span>${t('name')}</span><input name="name" autocomplete="name" required maxlength="60"></label>` : ''}
        <label class="field"><span>${t('email')}</span><input name="email" type="email" autocomplete="email" required></label>
        ${reg ? `<label class="field"><span>${t('phone')}</span><input name="phone" type="tel" autocomplete="tel" placeholder="+7 7__ ___ __ __"></label>` : ''}
        <label class="field"><span>${t('password')}</span>
          <span class="pw-wrap">
            <input name="password" type="password" autocomplete="${reg ? 'new-password' : 'current-password'}" required minlength="${reg ? 8 : 1}">
            <button type="button" class="pw-eye" aria-label="${t('show_pw')}" aria-pressed="false">
              <svg class="eye-open" viewBox="0 0 24 24"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>
              <svg class="eye-off" viewBox="0 0 24 24"><path d="M3 3l18 18M10.6 5.1A10.7 10.7 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.2 3.9M6.6 6.6C3.8 8.4 2 12 2 12s4 7 10 7c1.7 0 3.2-.5 4.5-1.2M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>
            </button>
          </span>
        </label>
        ${reg ? `<p class="hint">${t('pw_rule')}</p>` : ''}
        <p class="form-err" role="alert"></p>
        <button class="btn btn-green btn-block" type="submit">${t(reg ? 'register' : 'login')}</button>
        <p class="switch">${t(reg ? 'have_account' : 'no_account')} <a href="#/${reg ? 'login' : 'register'}${keep}">${t(reg ? 'login' : 'register')}</a></p>
      </form>`;
    const form = $('form', page);
    const eye = $('.pw-eye', form), pw = form.elements.password;
    eye.addEventListener('click', () => {
      const show = pw.type === 'password';
      pw.type = show ? 'text' : 'password';
      eye.setAttribute('aria-pressed', String(show));
      eye.setAttribute('aria-label', t(show ? 'hide_pw' : 'show_pw'));
      pw.focus({ preventScroll: true });
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = Object.fromEntries(new FormData(form));
      const btn = $('button[type="submit"]', form);
      btn.disabled = true;
      try {
        const { user } = await api(reg ? '/register' : '/login', { method: 'POST', body: fd });
        S.user = user;
        toast(t('welcome', { n: user.name.split(' ')[0] }));
        await loadLists();
        location.hash = nextHash(q);
        checkNotifications();
      } catch (err) {
        $('.form-err', form).textContent = errMsg(err);
        btn.disabled = false;
      }
    });
    $('input', form).focus();
  }

  function pageProfile(page) {
    if (!S.user) { location.hash = '#/login'; return; }
    const u = S.user;
    page.className = 'auth';
    page.innerHTML = `
      <div class="card auth-card">
        <span class="avatar big">${esc(u.name.trim()[0] || '?').toUpperCase()}</span>
        <h1>${esc(u.name)}</h1>
        <p class="muted">${esc(u.email)}${u.phone ? ' · ' + esc(u.phone) : ''}</p>
        <p class="muted small">${t('member_since', { d: fmtDay(u.created_at.slice(0, 10)) })}</p>
        ${u.is_admin ? `<a class="btn btn-green btn-block" href="#/admin">${t('admin_panel')}</a>` : ''}
        <a class="btn btn-white btn-block" href="#/tickets">${t('my_tickets')}</a>
        <button class="btn btn-ghost-b btn-block" id="logoutBtn">${t('logout')}</button>
      </div>
      <section class="card list-card bonus-card" id="bonusCard"><div class="skeleton small"></div></section>
      ${listBlock('favorites', t('favorites'), t('no_favorites'))}
      ${listBlock('reminders', t('reminders'), t('no_reminders'))}`;
    loadBonusCard();
    $('#logoutBtn').addEventListener('click', async () => {
      await api('/logout', { method: 'POST', body: {} }).catch(() => {});
      S.user = null;
      S.lists = { favorites: [], reminders: [] };
      toast(t('bye'));
      location.hash = '#/cinema';
    });
  }

  // ---------- Отзывы ----------
  async function loadReviews(m) {
    const box = $('#reviews');
    if (!box) return;
    let d;
    try { d = await api(`/movies/${m.id}/reviews`); } catch { box.innerHTML = ''; return; }
    if (!document.body.contains(box)) return;
    const stars = (n) => '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n);
    const mine = d.items.find((x) => x.mine);
    box.innerHTML = `
      <div class="rv-sum">${d.summary.count ? `<b>★ ${Number(d.summary.avg).toFixed(1)}</b><span class="muted">${t('reviews_count', { n: d.summary.count })}</span>` : `<span class="muted">${t('no_reviews')}</span>`}</div>
      ${d.can_review ? `<form class="card rv-form" novalidate>
          <span class="small muted">${mine ? t('review_edit') : t('review_write')}</span>
          <div class="rv-stars" role="radiogroup" aria-label="${t('your_rating')}">${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-star="${n}" aria-label="${n}" class="${mine && n <= mine.stars ? 'on' : ''}">★</button>`).join('')}</div>
          <textarea name="text" rows="3" maxlength="500" placeholder="${t('review_ph')}">${esc(mine ? mine.text || '' : '')}</textarea>
          <p class="form-err" role="alert"></p>
          <button class="btn btn-green btn-sm" type="submit">${t('review_send')}</button>
        </form>` : `<p class="small muted">${S.user ? t('review_need_ticket') : t('review_login')}</p>`}
      <div class="rv-list">${d.items.map((x) => `<div class="rv">
          <div class="rv-head"><b>${esc(x.name)}</b><span class="rv-st">${stars(x.stars)}</span><small class="muted">${fmtDay(x.created_at.slice(0, 10))}</small>
          ${d.is_admin ? `<button class="rv-del" data-del="${x.user_id}" aria-label="${t('delete')}">✕</button>` : ''}</div>
          ${x.text ? `<p>${esc(x.text)}</p>` : ''}</div>`).join('')}</div>`;
    const form = $('.rv-form', box);
    if (form) {
      let val = mine ? mine.stars : 0;
      $$('[data-star]', form).forEach((b) => b.addEventListener('click', () => {
        val = Number(b.dataset.star);
        $$('[data-star]', form).forEach((x) => x.classList.toggle('on', Number(x.dataset.star) <= val));
      }));
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!val) { $('.form-err', form).textContent = t('err_bad_stars'); return; }
        try {
          const r = await api(`/movies/${m.id}/reviews`, { method: 'POST', body: { stars: val, text: form.elements.text.value } });
          S.cat.ratings = S.cat.ratings || {};
          if (r.summary) S.cat.ratings[m.id] = r.summary;
          const mr = $('#mRating'); if (mr) mr.innerHTML = starsTxt(m);
          toast(t('review_thanks'));
          loadReviews(m);
        } catch (err) { $('.form-err', form).textContent = errMsg(err); }
      });
    }
    $$('[data-del]', box).forEach((b) => b.addEventListener('click', async () => {
      if (!confirm(t('delete_confirm'))) return;
      try { await api(`/admin/reviews/${m.id}/${b.dataset.del}`, { method: 'DELETE', body: {} }); loadReviews(m); } catch (err) { toast(errMsg(err)); }
    }));
  }

  // ---------- KADR-бонусы и значки ----------
  const BADGE_ICON = { first: '🎟️', premiere: '🌟', night: '🌙', family: '👨‍👩‍👧', vip: '💺', five: '🎬', ten: '🏆', critic: '✍️' };
  async function loadBonusCard() {
    const box = $('#bonusCard');
    if (!box) return;
    let d;
    try { d = await api('/me/bonus'); } catch { box.hidden = true; return; }
    if (!document.body.contains(box)) return;
    box.innerHTML = `
      <div class="bc-top"><div><span class="small muted">${t('bonus_title')}</span><b class="bc-bal">${d.balance} <small>${t('bonus_word')}</small></b></div>
        <a class="btn btn-ghost-b btn-sm" href="#/gift">🎁 ${t('gift_title')}</a></div>
      <p class="small muted">${t('bonus_rules', { e: d.earn_percent, m: d.max_share })}</p>
      <h3>${t('badges')}</h3>
      <div class="badges">${d.all_badges.map((b) => `<div class="badge-i${d.badges.includes(b) ? ' got' : ''}" title="${esc(t('bd_' + b + '_d'))}">
        <span class="bi">${BADGE_ICON[b] || '★'}</span><b>${t('bd_' + b)}</b><small>${t('bd_' + b + '_d')}</small></div>`).join('')}</div>`;
  }

  // ---------- Подарочные сертификаты ----------
  function giftCardHtml(g) {
    return `<div class="giftcard">
      <div class="gc-top"><span class="logo-mark">K</span><span>KADR Cinema</span></div>
      <p class="gc-hi">${g.to ? esc(t('gift_for', { n: g.to })) : t('gift_title')}</p>
      <b class="gc-amt">${money(g.amount)}</b>
      ${g.message ? `<p class="gc-msg">«${esc(g.message)}»</p>` : ''}
      ${g.from ? `<p class="gc-from">— ${esc(g.from)}</p>` : ''}
      <div class="gc-code"><small>${t('gift_code')}</small><code>${esc(g.code)}</code></div>
    </div>`;
  }
  function pageGift(page) {
    page.className = 'narrow';
    if (!S.user) {
      page.innerHTML = `<h1>🎁 ${t('gift_title')}</h1><div class="card center"><p>${t('gift_login')}</p><a class="btn btn-green" href="#/login?next=gift">${t('login')}</a></div>`;
      return;
    }
    let amount = 5000;
    page.innerHTML = `
      <a class="back" href="#/profile">‹ ${t('back')}</a>
      <h1>🎁 ${t('gift_title')}</h1>
      <p class="muted">${t('gift_intro')}</p>
      <form class="card gift-form" novalidate>
        <div class="amts">${[3000, 5000, 10000, 20000].map((a) => `<button type="button" class="chip-btn${a === amount ? ' on' : ''}" data-amt="${a}">${money(a)}</button>`).join('')}</div>
        <label class="field"><span>${t('gift_amount')}</span><input name="amount" type="number" min="1000" max="100000" step="500" value="${amount}"></label>
        <label class="field"><span>${t('gift_to')}</span><input name="to" maxlength="40" required></label>
        <label class="field"><span>${t('gift_from')}</span><input name="from" maxlength="40" value="${esc(S.user.name)}"></label>
        <label class="field"><span>${t('gift_msg')}</span><textarea name="msg" rows="3" maxlength="300" placeholder="${t('gift_msg_ph')}"></textarea></label>
        <h3>${t('card')}</h3>
        <label class="field"><span>${t('card_number')}</span><input name="num" inputmode="numeric" autocomplete="cc-number" placeholder="0000 0000 0000 0000" maxlength="23"></label>
        <div class="field-row">
          <label class="field"><span>${t('card_exp')}</span><input name="exp" inputmode="numeric" autocomplete="cc-exp" placeholder="12/29" maxlength="5"></label>
          <label class="field"><span>${t('card_cvc')}</span><input name="cvc" inputmode="numeric" autocomplete="cc-csc" placeholder="123" maxlength="4" type="password"></label>
        </div>
        <label class="field"><span>${t('card_holder')}</span><input name="holder" autocomplete="cc-name" placeholder="IVAN IVANOV"></label>
        <button type="button" class="demo-card" data-demo><code>4242 4242 4242 4242</code><span>${t('demo_ok')}</span></button>
        <p class="form-err" role="alert"></p>
        <button class="btn btn-green btn-block" type="submit">${t('gift_buy', { p: money(amount) })}</button>
      </form>`;
    const form = $('.gift-form', page);
    const f = form.elements;
    const setAmt = (a) => {
      amount = a;
      $$('[data-amt]', form).forEach((b) => b.classList.toggle('on', Number(b.dataset.amt) === a));
      $('[type=submit]', form).textContent = t('gift_buy', { p: money(a) });
    };
    $$('[data-amt]', form).forEach((b) => b.addEventListener('click', () => { f.amount.value = b.dataset.amt; setAmt(Number(b.dataset.amt)); }));
    f.amount.addEventListener('input', () => setAmt(Number(f.amount.value) || 0));
    f.num.addEventListener('input', () => { const d = f.num.value.replace(/\D/g, '').slice(0, 19); f.num.value = d.replace(/(.{4})/g, '$1 ').trim(); });
    $('[data-demo]', form).addEventListener('click', () => { f.num.value = '4242 4242 4242 4242'; f.exp.value = '12/30'; f.cvc.value = '123'; if (!f.holder.value) f.holder.value = S.user.name.toUpperCase(); });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = $('[type=submit]', form);
      btn.disabled = true;
      try {
        await sleep(900);
        const { code } = await api('/gift', { method: 'POST', body: { amount, to_name: f.to.value, from_name: f.from.value, message: f.msg.value,
          card: { number: f.num.value, exp: f.exp.value, cvc: f.cvc.value, holder: f.holder.value } } });
        location.hash = `#/gift/${code}?new=1`;
      } catch (err) { $('.form-err', form).textContent = errMsg(err); btn.disabled = false; }
    });
  }
  async function pageGiftView(page, code, q) {
    page.className = 'narrow';
    let g;
    const ok = fresh();
    try { ({ gift: g } = await api(`/gift/${encodeURIComponent(code)}`)); } catch (e) { return ok() && notFound(page, errMsg(e)); }
    if (!ok()) return;
    const link = `${location.origin}/#/gift/${g.code}`;
    page.innerHTML = `
      ${q.get('new') ? `<div class="success"><span class="check">✓</span><h1>${t('gift_done')}</h1></div>` : ''}
      ${giftCardHtml(g)}
      <p class="muted gc-bal">${t('gift_balance', { n: money(g.balance) })}</p>
      <p class="small muted">${t('gift_how')}</p>
      <div class="actions">
        <button class="btn btn-green" id="shareGift">${t('gift_share')}</button>
        <a class="btn btn-white" href="#/cinema">${t('choose_film')}</a>
      </div>`;
    $('#shareGift').addEventListener('click', async () => {
      const text = `${t('gift_share_text')} ${link}`;
      try {
        if (navigator.share) await navigator.share({ title: 'KADR Cinema', text, url: link });
        else { await navigator.clipboard.writeText(link); toast(t('copied')); }
      } catch { /* пользователь отменил */ }
    });
  }

  function notFound(page, msg) {
    page.className = 'narrow';
    page.innerHTML = `<div class="card center"><p>${esc(msg || t('err_not_found'))}</p><a class="btn btn-green" href="#/cinema">${t('to_afisha')}</a></div>`;
  }

  // ---------- Роутер ----------
  const routes = [
    [/^\/?$/, (p) => (window.HubPage ? window.HubPage(p) : pageHome(p))],
    [/^\/cinema$/, pageHome],
    [/^\/stadium$/, (p) => window.StadiumPage(p)],
    [/^\/theatre$/, (p) => window.TheatrePage(p)],
    [/^\/theatre\/(t\d{8}-\d{4})$/, (p, sid) => window.TheatreShowPage(p, sid)],
    [/^\/stadium\/(m\d{8})$/, (p, mid) => window.StadiumMatchPage(p, mid)],
    [/^\/movie\/(\d+)$/, pageMovie],
    [/^\/session\/([\w-]+)$/, pageSession],
    [/^\/checkout$/, pageCheckout],
    [/^\/ticket\/(\w+)$/, pageTicket],
    [/^\/tickets$/, pageTickets],
    [/^\/login$/, (p, q) => (S.user ? (location.hash = nextHash(q)) : authForm(p, q, 'login'))],
    [/^\/register$/, (p, q) => (S.user ? (location.hash = nextHash(q)) : authForm(p, q, 'register'))],
    [/^\/profile$/, pageProfile],
    [/^\/gift$/, pageGift],
    [/^\/gift\/(KADR-[A-Za-z0-9]{4}-[A-Za-z0-9]{4})$/, pageGiftView],
    [/^\/admin$/, (p, q) => {
      if (!S.user) { location.hash = '#/login?next=admin'; return; }
      if (!S.user.is_admin || !window.AdminPage) return notFound(p, t('err_forbidden'));
      return window.AdminPage(p, q);
    }],
  ];

  let routeSeq = 0;
  let catLoadedAt = Date.now();
  // true, пока пользователь не ушёл на другую страницу (защита от гонок медленных запросов)
  function fresh() { const s = routeSeq; return () => s === routeSeq; }
  async function route() {
    const seq = ++routeSeq;
    if (window.Hall3D) Hall3D.close();
    document.body.classList.remove('no-scroll');
    clearInterval(holdTimer);
    clearInterval(liveTimer);
    const raw = (location.hash || '#/').slice(1);
    const [path, qs] = raw.split('?');
    const q = new URLSearchParams(qs || '');
    const page = $('#page');
    const hit = routes.find(([re]) => re.test(path));
    // сайт открыт долго (например, через полночь) — обновить список дней
    if (Date.now() - catLoadedAt > 20 * 60 * 1000) {
      try {
        const cat = await api('/catalog');
        if (cat.days[0] !== S.cat.days[0]) { S.sched = {}; if (!cat.days.includes(S.date)) S.date = cat.days[0]; }
        S.cat = cat; catLoadedAt = Date.now();
      } catch { /* оставим старый */ }
      if (seq !== routeSeq) return;
    }
    updateChrome();
    if (!hit) return notFound(page);
    const args = path.match(hit[0]).slice(1);
    try {
      await hit[1](page, ...args, q);
    } catch (e) {
      if (seq === routeSeq) notFound(page, errMsg(e));
    }
    if (seq === routeSeq) { updateChrome(); hydratePosters(); window.scrollTo(0, 0); }
  }

  // ---------- Старт ----------
  $$('[data-lang]').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.lang === S.lang) return;
    if ($('#payForm')) cardDraft = { num: $('#cNum').value, exp: $('#cExp').value, cvc: $('#cCvc').value, holder: $('#cHolder').value };
    S.lang = b.dataset.lang;
    store.set('lang', S.lang);
    route();
  }));
  window.addEventListener('hashchange', route);

  // общие градиенты для экрана и постеров
  document.body.insertAdjacentHTML('beforeend', `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
    <linearGradient id="arc" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".95"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <radialGradient id="glow" cx=".5" cy="0" r=".7"><stop offset="0" stop-color="#fff" stop-opacity=".09"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
    <linearGradient id="shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".75"/></linearGradient>
  </defs></svg>`);

  // общие функции для admin.js
  window.KADR = { api, S, t, L, esc, money, cityName, toast, poster, fmtDay, movieById, langLabel, errMsg, fresh, reloadCatalog, $, $$ };

  (async () => {
    updateChrome();
    try {
      const [cat, me] = await Promise.all([api('/catalog'), api('/me')]);
      S.cat = cat;
      S.user = me.user;
      S.date = cat.days[0];
      if (!S.city || !cat.cities.some((c) => c.id === S.city)) S.city = null;
    } catch (e) {
      $('#page').innerHTML = `<div class="card center"><p>${esc(errMsg(e))}</p></div>`;
      return;
    }
    const firstVisit = !S.city;
    if (!S.city) S.city = S.cat.default_city;
    $('#cityBtn').addEventListener('click', () => openCityPicker(false));
    await loadLists();
    route();
    if (firstVisit) openCityPicker(true);
    checkNotifications();
    setInterval(checkNotifications, 15 * 60 * 1000);
    // официальные постеры грузятся отдельно, чтобы не задерживать открытие сайта
    api('/posters').then((p) => {
      S.tmdbOn = !!p.enabled;
      S.posters = Object.fromEntries(Object.entries(p.movies || {}).map(([k, v]) => [Number(k), v]));
      hydratePosters();
    }).catch(() => {});
  })();
})();
