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
      default: return '';
    }
  }
  function poster(m, cls = '') {
    const id = `pg${m.id}`;
    return `<div class="poster ${cls}" aria-hidden="true">
      <svg viewBox="0 0 200 300" preserveAspectRatio="xMidYMid slice">
        <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${m.colors[0]}"/><stop offset="1" stop-color="${m.colors[1]}"/></linearGradient></defs>
        <rect width="200" height="300" fill="url(#${id})"/>${motif(m)}
        <rect y="190" width="200" height="110" fill="url(#shade)"/>
      </svg>
      <span class="poster-title">${esc(L(m.title))}</span>
      <span class="age-badge">${m.age}+</span>
    </div>`;
  }

  // ---------- Шапка и навигация ----------
  function updateChrome() {
    document.documentElement.lang = S.lang;
    $$('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    $$('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === S.lang)));
    const hash = location.hash || '#/';
    const section = hash.startsWith('#/tickets') || hash.startsWith('#/ticket/') ? 'tickets'
      : hash.startsWith('#/profile') || hash.startsWith('#/login') || hash.startsWith('#/register') ? 'profile' : 'home';
    $$('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === section));
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
    if (!S.sched[day]) S.sched[day] = (await api(`/schedule?date=${day}`)).shows;
    return S.sched[day];
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
          <p class="muted"><svg class="ico" viewBox="0 0 24 24"><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>${esc(L(c.city))}, ${esc(L(c.address))}</p>
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
    if (!shows.length) { list.innerHTML = `<p class="empty">${t('no_shows')}</p>`; return; }
    list.innerHTML = S.mode === 'movies' ? byMovies(shows) : byHalls(shows);
  }

  const priceCells = (p) => `<span class="pc">${money(p.adult)}</span><span class="pc">${money(p.child)}</span><span class="pc">${money(p.student)}</span><span class="pc vip">${money(p.vip)}</span>`;
  const sessHead = (second) => `<div class="srow shead"><span>${t('col_time')}</span><span>${second}</span><span>${t('col_lang')}</span><span class="pc">${t('col_adult')}</span><span class="pc">${t('col_child')}</span><span class="pc">${t('col_student')}</span><span class="pc">${t('col_vip')}</span></div>`;
  function sessRow(s, second) {
    const tag = s.past ? 'div' : 'a';
    return `<${tag} class="srow${s.past ? ' past' : ''}" ${s.past ? '' : `href="#/session/${s.id}"`}>
      <b class="stime">${s.time}</b><span class="shall">${second}</span><span class="slang">${langLabel(s.lang)}</span>
      ${priceCells(s.prices)}<span class="sfrom">${s.past ? t('past') : t('from', { p: money(Math.min(s.prices.adult, s.prices.student)) })}</span>
    </${tag}>`;
  }

  function byMovies(shows) {
    const groups = new Map();
    shows.forEach((s) => { if (!groups.has(s.movie_id)) groups.set(s.movie_id, []); groups.get(s.movie_id).push(s); });
    return [...groups].map(([mid, ss]) => {
      const m = movieById(mid);
      return `<article class="mcard">
        <a href="#/movie/${m.id}" class="mposter">${poster(m, 'sm')}</a>
        <div class="mbody">
          <a href="#/movie/${m.id}" class="mtitle"><h3>${esc(L(m.title))}</h3><span class="age">${m.age}+</span></a>
          <p class="meta">${esc(L(m.genre))} · ${t('min', { n: m.duration })}</p>
          <div class="stable">${sessHead(t('col_hall'))}${ss.map((s) => sessRow(s, `${S.cat.halls[s.hall].name} · ${s.format}`)).join('')}</div>
        </div>
      </article>`;
    }).join('');
  }

  function byHalls(shows) {
    return Object.entries(S.cat.halls).map(([hid, hl]) => {
      const ss = shows.filter((s) => String(s.hall) === hid);
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
        <div class="info-card"><h4>${t('address')}</h4><p>${esc(L(c.city))}, ${esc(L(c.address))}</p><h4>${t('hours')}</h4><p>${esc(c.hours)}</p></div>
        <div class="info-card"><h4>${t('contacts')}</h4><p>${esc(c.phone)}</p></div>
      </div>
    </div>`;
  }

  // ---------- Страница: фильм ----------
  async function pageMovie(page, id) {
    const m = movieById(Number(id));
    if (!m) return notFound(page);
    page.className = 'wide';
    page.innerHTML = `
      <a class="back" href="#/">‹ ${t('back')}</a>
      <section class="movie">
        ${poster(m, 'lg')}
        <div class="movie-info">
          <h1>${esc(L(m.title))} <span class="age">${m.age}+</span></h1>
          <dl class="facts">
            <div><dt>${t('genre')}</dt><dd>${esc(L(m.genre))}</dd></div>
            <div><dt>${t('duration')}</dt><dd>${t('min', { n: m.duration })}</dd></div>
            <div><dt>${t('langs')}</dt><dd>${m.langs.map(langLabel).join(', ')}</dd></div>
          </dl>
          <h3>${t('about_movie')}</h3>
          <p class="muted">${esc(L(m.about))}</p>
          <h3>${t('sessions_for')}</h3>
          <div id="mDates"></div>
          <div class="chipsess" id="mSess"></div>
        </div>
      </section>`;
    const draw = async () => {
      $('#mDates', page).replaceChildren(dateStrip(draw));
      const box = $('#mSess', page);
      const day = S.date;
      const ok = fresh();
      const shows = (await loadSchedule(day)).filter((s) => s.movie_id === m.id);
      if (day !== S.date || !ok()) return;
      box.innerHTML = shows.length ? shows.map((s) => {
        const inner = `<b>${s.time}</b><span>${S.cat.halls[s.hall].name} · ${s.format} · ${langLabel(s.lang)}</span><small>${s.past ? t('past') : t('from', { p: money(Math.min(s.prices.adult, s.prices.student)) })}</small>`;
        return s.past ? `<div class="sbtn past">${inner}</div>` : `<a class="sbtn" href="#/session/${s.id}">${inner}</a>`;
      }).join('') : `<p class="empty">${t('no_shows')}</p>`;
    };
    await draw();
  }

  // ---------- Страница: выбор мест ----------
  const showLine = (show) => `${fmtDay(show.date)}, ${show.time} · ${S.cat.halls[show.hall].name} · ${show.format} · ${langLabel(show.lang)}`;
  const AISLES = [3, 11];

  async function pageSession(page, id) {
    let data;
    const ok = fresh();
    try { data = await api(`/showtimes/${id}`); } catch (e) { return ok() && notFound(page, errMsg(e)); }
    if (!ok()) return;
    const { show, movie } = data;
    const taken = new Set(data.taken);
    if (!S.order || S.order.showId !== id) S.order = { showId: id, seats: [], types: {} };
    S.order.seats = S.order.seats.filter(({ r, i }) => !taken.has(seatName(r, i)));
    saveOrder();
    const { rows, seats: perRow, max_seats: maxSeats } = S.cat.layout;
    const priceFor = (r, i) => {
      if (isVip(r)) return show.prices.vip;
      const tp = S.order.types[seatName(r, i)] || 'adult';
      return show.prices[tp] ?? show.prices.adult;
    };

    page.className = 'narrow seatpage';
    page.innerHTML = `
      <div class="sp-head">
        <a class="icon-btn" href="#/movie/${movie.id}" aria-label="${t('back')}"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></a>
        <div><h2>${esc(L(movie.title))} <span class="age">${movie.age}+</span></h2><p>${showLine(show)}</p></div>
      </div>
      ${show.past ? `<p class="warn">${t('show_started')}</p>` : ''}
      <div class="hall-scroll" id="hallScroll"><div class="hall-inner">
        <div class="screen" aria-hidden="true">
          <svg viewBox="0 0 400 60" preserveAspectRatio="none">
            <path d="M0 60 L0 26 Q200 -6 400 26 L400 60 Z" fill="url(#glow)"/>
            <path d="M8 26 Q200 -4 392 26" fill="none" stroke="url(#arc)" stroke-width="2"/>
          </svg>
          <span>${t('screen')}</span>
        </div>
        <div class="grid" id="grid" role="grid"></div>
      </div></div>
      <p class="pan-hint">${t('pan_hint')}</p>
      <ul class="legend">
        <li><i class="dot available"></i>${t('available')}</li>
        <li><i class="dot taken"></i>${t('taken')}</li>
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
        const lab = document.createElement('div');
        lab.className = 'row-label';
        lab.textContent = rows[r];
        grid.append(lab);
        for (let i = 0; i < perRow; i++) {
          if (AISLES.includes(i)) grid.append(Object.assign(document.createElement('div'), { className: 'aisle' }));
          const b = document.createElement('button');
          const name = seatName(r, i);
          const tk = taken.has(name);
          const sel = isSel(r, i);
          b.className = 'seat' + (isVip(r) ? ' vip' : '') + (tk ? ' taken' : '') + (sel ? ' selected' : '');
          b.disabled = tk || show.past;
          if (sel) b.textContent = i + 1;
          b.setAttribute('aria-label', t('row_seat', { r: rows[r], s: i + 1 }) + (tk ? `, ${t('taken')}` : ''));
          b.setAttribute('aria-pressed', String(sel));
          b.addEventListener('click', () => {
            if (sel) S.order.seats = S.order.seats.filter((s) => !(s.r === r && s.i === i));
            else if (S.order.seats.length >= maxSeats) return toast(t('max_seats', { n: maxSeats }));
            else S.order.seats.push({ r, i });
            saveOrder(); drawGrid(); drawBar();
          });
          grid.append(b);
        }
      }
    };
    const total = () => S.order.seats.reduce((sum, { r, i }) => sum + priceFor(r, i), 0);
    const drawBar = () => {
      const n = S.order.seats.length;
      if (n === 1) { const { r, i } = S.order.seats[0]; $('#barLabel').textContent = t('row_seat_short', { r: rows[r], s: i + 1 }); }
      else $('#barLabel').textContent = n ? t('seats_n', { n }) : t('choose_seats');
      $('#barPrice').textContent = n ? money(total()) : '—';
      $('#contBtn').disabled = !n || show.past;
      $('#v3dBtn').disabled = !n;
    };
    const goNext = () => {
      S.order.holdUntil = Date.now() + 10 * 60 * 1000;
      saveOrder();
      if (!S.user) { toast(t('login_to_pay')); location.hash = '#/login?next=checkout'; }
      else location.hash = '#/checkout';
    };
    $('#contBtn').addEventListener('click', goNext);
    $('#v3dBtn').addEventListener('click', () => open3D(page, show, movie, priceFor, total, goNext));
    drawGrid(); drawBar();
    // на узком экране схема шире окна — показываем её центр (там лучшие места)
    const hs = $('#hallScroll');
    hs.scrollLeft = (hs.scrollWidth - hs.clientWidth) / 2;
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
      <div class="sheet">
        <button class="handle-btn" aria-expanded="true" aria-label="${t('sheet_hide')}"><span class="handle"></span></button>
        <div class="sheet-mini">
          <div class="mini-txt"><b>${t('row_seat', { r: rows[r], s: i + 1 })}</b><span>${inf.dist.toFixed(1)} м · ${inf.fov}°</span></div>
          <button class="btn btn-white btn-sm" data-act="next">${money(total())} <svg class="ico" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg></button>
        </div>
        <div class="sheet-body">
        <div class="sheet-head">
          <div><span class="kicker">${t(inf.kind)}</span>
            <h2>${t('row_seat', { r: rows[r], s: i + 1 })}</h2>
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
    Hall3D.open($('canvas', view), {
      selected: S.order.seats, target,
      onArrive: () => { sheet.classList.add('open'); hint.classList.add('show'); setTimeout(() => hint.classList.remove('show'), 3000); },
      onDrag: () => hint.classList.remove('show'),
    });
  }

  // ---------- Страница: оплата ----------
  let holdTimer = null;
  let cardDraft = null;

  async function pageCheckout(page) {
    if (!S.order || !S.order.seats.length) { location.hash = '#/'; return; }
    if (!S.user) { location.hash = '#/login?next=checkout'; return; }
    let data;
    const ok = fresh();
    try { data = await api(`/showtimes/${S.order.showId}`); } catch (e) { return ok() && notFound(page, errMsg(e)); }
    if (!ok()) return;
    const { show, movie } = data;
    const taken = new Set(data.taken);
    const lost = S.order.seats.filter(({ r, i }) => taken.has(seatName(r, i)));
    if (lost.length || show.past || !S.order.holdUntil || S.order.holdUntil < Date.now()) {
      toast(show.past ? t('show_started') : lost.length ? t('err_seats_taken', { s: lost.map(({ r, i }) => seatName(r, i)).join(', ') }) : t('hold_expired'));
      location.hash = `#/session/${show.id}`;
      return;
    }
    const rows = S.cat.layout.rows;
    const typeOf = (r, i) => (isVip(r) ? 'vip' : S.order.types[seatName(r, i)] || 'adult');
    const priceOf = (r, i) => show.prices[typeOf(r, i)];
    const total = () => S.order.seats.reduce((s, { r, i }) => s + priceOf(r, i), 0);

    page.className = 'mid';
    page.innerHTML = `
      <a class="back" href="#/session/${show.id}">‹ ${t('back')}</a>
      <h1>${t('checkout')}</h1>
      <div class="co">
        <section class="card co-sum">
          <div class="co-movie">${poster(movie, 'xs')}<div><h3>${esc(L(movie.title))}</h3><p class="muted">${showLine(show)}</p></div></div>
          <div class="co-seats" id="coSeats"></div>
          <p class="note" id="stuNote" hidden>${t('student_note')}</p>
          <div class="co-total"><span>${t('total')}</span><b id="coTotal"></b></div>
          <p class="hold" id="hold"></p>
        </section>
        <form class="card co-pay" id="payForm" novalidate>
          <h3>${t('card')} <span class="brand" id="brand"></span></h3>
          <label class="field"><span>${t('card_number')}</span><input id="cNum" inputmode="numeric" autocomplete="cc-number" placeholder="0000 0000 0000 0000" maxlength="23" required></label>
          <div class="field-row">
            <label class="field"><span>${t('card_exp')}</span><input id="cExp" inputmode="numeric" autocomplete="cc-exp" placeholder="12/29" maxlength="5" required></label>
            <label class="field"><span>${t('card_cvc')}</span><input id="cCvc" inputmode="numeric" autocomplete="cc-csc" placeholder="123" maxlength="4" type="password" required></label>
          </div>
          <label class="field"><span>${t('card_holder')}</span><input id="cHolder" autocomplete="cc-name" autocapitalize="characters" placeholder="IVAN IVANOV" required></label>
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
        return `<div class="co-seat"><span>${t('row_seat', { r: rows[r], s: i + 1 })}</span>${sel}<b>${money(priceOf(r, i))}</b></div>`;
      }).join('');
      $$('select[data-seat]').forEach((s) => s.addEventListener('change', () => { S.order.types[s.dataset.seat] = s.value; saveOrder(); drawSeats(); }));
      $('#coTotal').textContent = money(total());
      $('#payBtn').textContent = t('pay', { p: money(total()) });
      $('#stuNote').hidden = !S.order.seats.some(({ r, i }) => typeOf(r, i) === 'student');
    };
    drawSeats();

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
            card: { number: num.value, exp: exp.value, cvc: cvc.value, holder: holder.value },
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
        btn.textContent = t('pay', { p: money(total()) });
      }
    });
  }

  // ---------- Билеты ----------
  function ticketHtml(b, big) {
    const m = b.movie, s = b.show;
    const rows = b.seats.map((x) => {
      const { r, i } = seatParse(x.seat);
      return `<li><span>${t('row_seat', { r: S.cat.layout.rows[r], s: i + 1 })}</span><span class="muted">${t('t_' + x.ticket_type)}</span><b>${money(x.price)}</b></li>`;
    }).join('');
    return `<div class="ticket ${big ? 'big' : ''}">
      <div class="t-top">${poster(m, 'xs')}<div><h3>${esc(L(m.title))} <span class="age">${m.age}+</span></h3><p class="muted">${showLine(s)}</p></div></div>
      <ul class="t-seats">${rows}</ul>
      <div class="t-foot"><div><small class="muted">${t('booking_code')}</small><b class="code">${esc(b.code)}</b></div><div class="t-sum"><small class="muted">${t('total')}</small><b>${money(b.total)}</b></div></div>
      ${big ? `<div class="t-qr"><div id="qr"></div><p class="muted">${t('show_qr')}</p><p class="muted small">${t('paid_with', { b: esc(b.card_brand), l: esc(b.card_last4) })}</p></div>` : ''}
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
      <div class="actions"><a class="btn btn-ghost-b" href="#/tickets">${t('my_tickets')}</a><a class="btn btn-white" href="#/">${t('to_afisha')}</a></div>`;
    if (window.QRCode) new QRCode($('#qr'), { text: `KADR:${b.code}:${b.show.id}`, width: 168, height: 168, colorDark: '#0b0a0c', colorLight: '#ffffff' });
  }

  async function pageTickets(page) {
    page.className = 'mid';
    if (!S.user) {
      page.innerHTML = `<h1>${t('my_tickets')}</h1><div class="card center"><p>${t('err_auth_required')}</p><a class="btn btn-green" href="#/login?next=tickets">${t('login')}</a></div>`;
      return;
    }
    const ok = fresh();
    const { bookings } = await api('/bookings');
    if (!ok()) return;
    const up = bookings.filter((b) => b.show && !b.show.past);
    const past = bookings.filter((b) => b.show && b.show.past);
    const block = (title, list) => (list.length ? `<h3 class="sec">${title}</h3><div class="tlist">${list.map((b) => `<a href="#/ticket/${b.code}" class="tlink">${ticketHtml(b, false)}</a>`).join('')}</div>` : '');
    page.innerHTML = `<h1>${t('my_tickets')}</h1>` + (bookings.length ? block(t('upcoming'), up) + block(t('past_tickets'), past)
      : `<div class="card center"><p>${t('no_tickets')}</p><a class="btn btn-green" href="#/">${t('to_afisha')}</a></div>`);
  }

  // ---------- Вход, регистрация, профиль ----------
  const nextHash = (q) => ({ checkout: '#/checkout', tickets: '#/tickets' }[q.get('next')] || '#/');

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
        location.hash = nextHash(q);
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
        <a class="btn btn-white btn-block" href="#/tickets">${t('my_tickets')}</a>
        <button class="btn btn-ghost-b btn-block" id="logoutBtn">${t('logout')}</button>
      </div>`;
    $('#logoutBtn').addEventListener('click', async () => {
      await api('/logout', { method: 'POST', body: {} }).catch(() => {});
      S.user = null;
      toast(t('bye'));
      location.hash = '#/';
    });
  }

  function notFound(page, msg) {
    page.className = 'narrow';
    page.innerHTML = `<div class="card center"><p>${esc(msg || t('err_not_found'))}</p><a class="btn btn-green" href="#/">${t('to_afisha')}</a></div>`;
  }

  // ---------- Роутер ----------
  const routes = [
    [/^\/?$/, pageHome],
    [/^\/movie\/(\d+)$/, pageMovie],
    [/^\/session\/([\w-]+)$/, pageSession],
    [/^\/checkout$/, pageCheckout],
    [/^\/ticket\/(\w+)$/, pageTicket],
    [/^\/tickets$/, pageTickets],
    [/^\/login$/, (p, q) => (S.user ? (location.hash = nextHash(q)) : authForm(p, q, 'login'))],
    [/^\/register$/, (p, q) => (S.user ? (location.hash = nextHash(q)) : authForm(p, q, 'register'))],
    [/^\/profile$/, pageProfile],
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
    if (seq === routeSeq) { updateChrome(); window.scrollTo(0, 0); }
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

  (async () => {
    updateChrome();
    try {
      const [cat, me] = await Promise.all([api('/catalog'), api('/me')]);
      S.cat = cat;
      S.user = me.user;
      S.date = cat.days[0];
    } catch (e) {
      $('#page').innerHTML = `<div class="card center"><p>${esc(errMsg(e))}</p></div>`;
      return;
    }
    route();
  })();
})();
