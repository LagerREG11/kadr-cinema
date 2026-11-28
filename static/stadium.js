/* 3D Ticket: главная страница-хаб и раздел стадиона «Қайсар Арена» (матчи → секторы → места → 3D-вид → покупка). */
(() => {
  'use strict';
  const K = () => window.KADR;
  const TX = {
    kk: {
      hub_title: '3D Ticket · {c}', hub_sub: '{c}: орындарды 3D-де көріп, билетті онлайн алыңыз.', soon_city: '{c} қаласының 3D нысандары (стадион, театр т.б.) жақында қосылады',
      cinema: 'Кинотеатр', cinema_d: 'Афиша, орынды таңдау, 3D залдан көрініс', stadium: 'Қайсар Арена', stadium_d: 'Стадион: матчтар, секторлар, 3D трибунадан көрініс',
      soon: 'Жақында', soon_d: 'Жаңа 3D нысандар қосылады', open: 'Ашу',
      st_facts: '11 000 орын · алаң 105×68 м · УЕФА IV санаты', matches: 'Матчтар', demo: 'Демо-кесте: нақты матчтар емес',
      from: '{p} бастап', choose_sector: 'Секторды таңдаңыз', sector: 'Сектор', row: 'Қатар', seat: 'Орын', free: 'бос',
      v3d: '3D көрініс', buy: 'Сатып алу · {p}', pick_seats: 'Орын таңдаңыз (6-ға дейін)', approx: 'Схема шамамен: ресми секторлар жарияланбаған.',
      pay_title: 'Төлем', done: 'Билет дайын!', to_pitch: 'алаң ортасына дейін', height: 'биіктігі', angle: 'көру бұрышы', back: 'Артқа',
      vip: 'VIP', center: 'Орталық', side: 'Бүйір', east: 'Шығыс', end: 'Қақпа артында', away: 'Қонақтар', my: 'Стадион билеттері', lodge: 'Ложа', west: 'Батыс', upper: 'Жоғарғы ярус (C)', lower: 'Төменгі ярус (B)', premium: 'Премиум (A)', A: 'Премиум, төменгі ярус', B: 'Төменгі ярус', C: 'Жоғарғы ярус', arena_d: 'Мұз аренасы: хоккей, A/B/C секторлары, 3D орыннан көрініс', arena_note: 'Секторлар арена картасы бойынша; орын саны шамамен.', stage_ice: 'МҰЗ АЛАҢЫ', main_entrance: 'Басты кіреберіс', central_d: 'Стадион: «Қайрат» матчтары, 60 сектор, 3D трибунадан көрініс', oval_note: 'Секторлар стадионның ресми картасы бойынша; орын саны шамамен.',
      W: 'Батыс трибуна', E: 'Шығыс трибуна', N: 'Солтүстік трибуна', S: 'Оңтүстік трибуна',
    },
    ru: {
      hub_title: '3D Ticket · {c}', hub_sub: '{c}: смотрите места в 3D и покупайте билеты онлайн.', soon_city: '3D-объекты города {c} (стадион, театр и др.) появятся скоро',
      cinema: 'Кинотеатр', cinema_d: 'Афиша, выбор места, вид из зала в 3D', stadium: 'Қайсар Арена', stadium_d: 'Стадион: матчи, секторы, вид с трибуны в 3D',
      soon: 'Скоро', soon_d: 'Добавим новые 3D-объекты', open: 'Открыть',
      st_facts: '11 000 мест · поле 105×68 м · УЕФА IV категория', matches: 'Матчи', demo: 'Демо-расписание: не реальные матчи',
      from: 'от {p}', choose_sector: 'Выберите сектор', sector: 'Сектор', row: 'Ряд', seat: 'Место', free: 'свободно',
      v3d: 'Вид в 3D', buy: 'Купить · {p}', pick_seats: 'Выберите места (до 6)', approx: 'Схема приблизительная: официальные секторы не опубликованы.',
      pay_title: 'Оплата', done: 'Билет готов!', to_pitch: 'до центра поля', height: 'высота', angle: 'угол обзора', back: 'Назад',
      vip: 'VIP', center: 'Центр', side: 'Боковой', east: 'Восток', end: 'За воротами', away: 'Гостевой', my: 'Билеты на стадион', lodge: 'Ложа', west: 'Запад', upper: 'Верхний ярус (C)', lower: 'Нижний ярус (B)', premium: 'Премиум (A)', A: 'Премиум, нижний ярус', B: 'Нижний ярус', C: 'Верхний ярус', arena_d: 'Ледовая арена: хоккей, секторы A/B/C, вид с места в 3D', arena_note: 'Секторы — по карте арены; число мест приблизительное.', stage_ice: 'ЛЁД', main_entrance: 'Главный вход', central_d: 'Стадион: матчи «Кайрата», 60 секторов, вид с трибуны в 3D', oval_note: 'Секторы — по официальной карте стадиона; число мест приблизительное.',
      W: 'Западная трибуна', E: 'Восточная трибуна', N: 'Северная трибуна', S: 'Южная трибуна',
    },
  };
  const s = (k, v = {}) => ((TX[K().S.lang] || TX.ru)[k] || TX.ru[k] || k).replace(/\{(\w+)\}/g, (_, x) => v[x] ?? '');
  let data = null;
  const cache = {};
  const curCity = () => { const S = K().S; return S.city || (S.cat && S.cat.default_city) || 'kzo'; };
  const load = async (q) => {
    const key = q || `city=${curCity()}`;
    return (cache[key] = cache[key] || await K().api(`/stadium?${key}`));
  };
  const STADIUM_BY_PREFIX = { m: 'kaisar', c: 'central', h: 'arena' };
  // фото стадиона для карточки и шапки
  const STADIUM_IMG = { kaisar: '/img/venue-stadium.jpg', central: '/img/venue-central.jpg', arena: '/img/venue-arena.jpg' };
  const module3d = (d) => ({ oval: window.Oval3D, arena: window.Arena3D }[d.stadium.shape] || window.Stadium3D);

  // ТРЦ с кинотеатром по городам; фото — собственное пользователя или свободные с Wikimedia Commons
  const MALLS = {
    kzo: [
      { id: 'aray', name: 'Aray City Mall', img: '/img/mall-aray.jpg', pos: 'center 40%',
        addr: { kk: 'Қызылорда, Назарбаев даңғылы, 13А', ru: 'Кызылорда, пр. Назарбаева, 13А' } },
    ],
    ala: [
      { id: 'mega-ala', name: 'MEGA Alma-Ata', img: '/img/mall-mega.jpg', pos: 'center 55%', credit: 'Фото: Anton Yefimov, CC BY 3.0',
        addr: { kk: 'Алматы, Розыбакиев көшесі, 247А', ru: 'Алматы, ул. Розыбакиева, 247А' } },
      { id: 'esentai', name: 'Esentai Mall', img: '/img/mall-esentai.jpg', pos: 'left center', credit: 'Фото: Xcite, CC0',
        addr: { kk: 'Алматы, әл-Фараби даңғылы, 77/8', ru: 'Алматы, пр. аль-Фараби, 77/8' } },
      { id: 'moskva', name: 'Moskva Metropolitan', img: '/img/mall-moskva.jpg', pos: 'center 30%', credit: 'Фото: Wetowp5029, CC BY 4.0',
        addr: { kk: 'Алматы, 8-шағынаудан, 37/1', ru: 'Алматы, 8-й микрорайон, 37/1' } },
    ],
  };
  window.MALLS = MALLS;
  // выбранный ТРЦ текущего города (по умолчанию — первый)
  window.currentMall = () => {
    const S = K().S, city = S.city || (S.cat && S.cat.default_city) || 'kzo';
    const list = MALLS[city] || [];
    let id = null; try { id = localStorage.getItem('mall'); } catch (e) { /* ignore */ }
    return list.find((m) => m.id === id) || list[0] || null;
  };
  const fmtDay = (iso) => K().fmtDay(iso);

  // ---------- Главная 3D Ticket ----------
  window.HubPage = function HubPage(page) {
    page.className = 'wide';
    const { S, cityName } = K();
    const city = S.city || (S.cat && S.cat.default_city) || 'kzo';
    const c = cityName(city) || 'Қызылорда';
    const local = city === 'kzo'; // стадион и театр пока есть только в Кызылорде
    page.innerHTML = `
      <section class="hub-hero"><h1>${s('hub_title', { c })}</h1><p class="muted">${s('hub_sub', { c })}</p></section>
      <div class="hub-grid">
        ${(MALLS[city] || []).map((m) => `<a class="hub-card hc-photo" href="#/cinema" data-mall="${m.id}" style="--img:url('${m.img}'); --pos: ${m.pos || 'center'}">
          <span class="hc-tag">${s('cinema')}</span><b>${K().esc(m.name)}</b>
          <small class="hc-addr"><svg class="ico" viewBox="0 0 24 24"><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>${K().esc(K().L(m.addr))}</small>
          <small>${s('cinema_d')}</small><span class="btn btn-green btn-sm">${s('open')}</span>${m.credit ? `<span class="hc-credit">${K().esc(m.credit)}</span>` : ''}</a>`).join('')}
        ${city === 'ala' ? `<a class="hub-card hc-photo" href="#/stadium" style="--img:url('/img/venue-central.jpg'); --pos: center 40%"><b>${K().S.lang === 'kk' ? 'Орталық стадион' : 'Центральный стадион'}</b>
          <small class="hc-addr"><svg class="ico" viewBox="0 0 24 24"><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>${K().S.lang === 'kk' ? 'Алматы, Сәтбаев көшесі, 29/3' : 'Алматы, ул. Сатпаева, 29/3'}</small>
          <small>${s('central_d')}</small><span class="btn btn-green btn-sm">${s('open')}</span></a>
        <a class="hub-card hc-photo" href="#/arena" style="--img:url('/img/venue-arena.jpg'); --pos: center 60%"><b>Almaty Arena</b>
          <small class="hc-addr"><svg class="ico" viewBox="0 0 24 24"><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>${K().S.lang === 'kk' ? 'Алматы, Нұркент шағынауданы, 7' : 'Алматы, мкр. Нуркент, 7'}</small>
          <small>${s('arena_d')}</small><span class="btn btn-green btn-sm">${s('open')}</span></a>` : ''}
        ${local ? `<a class="hub-card hc-photo" href="#/stadium" style="--img:url('/img/venue-stadium.jpg')"><b>${s('stadium')}</b><small>${s('stadium_d')}</small><span class="btn btn-green btn-sm">${s('open')}</span></a>
        <a class="hub-card hc-photo" href="#/theatre" style="--img:url('/img/venue-theatre.jpg'); --pos: center 78%"><b>${window.TheatreTX ? window.TheatreTX('hub') : 'Театр'}</b><small>${window.TheatreTX ? window.TheatreTX('hub_d') : ''}</small><span class="btn btn-green btn-sm">${s('open')}</span><span class="hc-credit">Фото: SAKRI, CC BY-SA 4.0</span></a>
` : ''}
        <div class="hub-card hc-soon"><span class="hc-art">✨</span><b>${s('soon')}</b><small>${local ? s('soon_d') : s('soon_city', { c })}</small></div>
      </div>`;
    page.querySelectorAll('[data-mall]').forEach((a) => a.addEventListener('click', () => { try { localStorage.setItem('mall', a.dataset.mall); } catch (e) { /* ignore */ } }));
  };

  // ---------- Стадион: матчи ----------
  window.StadiumPage = async function StadiumPage(page, q) {
    const { esc, money, L } = K();
    page.className = 'wide';
    const d = await load(q);
    const minP = Math.min(...d.sectors.map((x) => x.price));
    page.innerHTML = `
      <a class="back" href="#/">‹ 3D Ticket</a>
      <section class="st-hero st-hero-photo" style="--img:url('${STADIUM_IMG[d.stadium.id]}')"><div><h1>🏟️ ${esc(L(d.stadium.name))}</h1><p>${esc(L(d.stadium.city))}</p><p class="small">${esc(L(d.stadium.facts))}</p></div></section>
      <h3>${s('matches')}</h3><p class="small muted">${s('demo')}</p>
      <div class="st-matches">${d.matches.map((m) => `<a class="st-match" href="#/stadium/${m.id}">
        <small>${fmtDay(m.date)} · ${m.time}</small><b>${esc(m.home)} — ${esc(m.away)}</b><span class="muted small">${esc(L(m.tournament))}</span>
        <span class="st-from">${s('from', { p: money(minP) })}</span></a>`).join('')}</div>`;
  };

  // ---------- Стадион: секторы, места, 3D, покупка ----------
  const SECT_COL = { vip: '#3b5bdb', center: '#5fd38d', side: '#4fb37a', east: '#38a169', end: '#2f855a', away: '#8a94a6', lodge: '#d9741c', west: '#c9a227', premium: '#d23a46', lower: '#2f7fd8', upper: '#2f9e5b' };
  function sectorMap(d, sold, sel) {
    // вид сверху: поле в центре, секторы по периметру
    const W = 360, H = 260, cx = W / 2, cy = H / 2, pw = 150, ph = 98;
    const out = [];
    d.sectors.forEach((sec) => {
      const side = sec.stand === 'W' || sec.stand === 'E';
      const span = side ? 230 : 150, w = span / sec.count, depth = 40;
      let x, y, ww, hh;
      if (side) { ww = w - 3; hh = depth; x = cx - span / 2 + sec.index * w; y = sec.stand === 'W' ? cy - ph / 2 - 10 - depth : cy + ph / 2 + 10; if (sec.stand === 'E') x = cx + span / 2 - (sec.index + 1) * w; }
      else { ww = depth; hh = w - 3; y = cy - span / 2 + sec.index * w; x = sec.stand === 'N' ? cx + pw / 2 + 10 : cx - pw / 2 - 10 - depth; if (sec.stand === 'S') y = cy + span / 2 - (sec.index + 1) * w; }
      const free = sec.rows * sec.seats - (sold[sec.id] || 0);
      out.push(`<g class="sec${sel === sec.id ? ' on' : ''}" data-sec="${sec.id}" role="button" tabindex="0" aria-label="${s('sector')} ${sec.id}">
        <rect x="${x}" y="${y}" width="${ww}" height="${hh}" rx="5" fill="${SECT_COL[sec.kind]}"/>
        <text x="${x + ww / 2}" y="${y + hh / 2 + 4}" text-anchor="middle">${sec.id}</text><title>${sec.id} · ${free} ${s('free')}</title></g>`);
    });
    return `<svg class="st-map" viewBox="0 0 ${W} ${H}">
      <rect x="${cx - pw / 2}" y="${cy - ph / 2}" width="${pw}" height="${ph}" rx="4" fill="#2f8a3c"/>
      <rect x="${cx - pw / 2 + 4}" y="${cy - ph / 2 + 4}" width="${pw - 8}" height="${ph - 8}" fill="none" stroke="#e8f5e9" stroke-width="1.2"/>
      <line x1="${cx}" y1="${cy - ph / 2 + 4}" x2="${cx}" y2="${cy + ph / 2 - 4}" stroke="#e8f5e9" stroke-width="1.2"/>
      <circle cx="${cx}" cy="${cy}" r="12" fill="none" stroke="#e8f5e9" stroke-width="1.2"/>${out.join('')}</svg>`;
  }

  function ovalMap(d, sold, sel) {
    const W = 380, H = 300, cx = W / 2, cy = H / 2, k = 1.05, Lh = 42.2 * k;
    // контур «стадиона» в пикселях: угол a (0° — север/вправо, 90° — восток/вниз)
    const pt = (a, R) => {
      const dx = Math.cos(a * Math.PI / 180), dz = Math.sin(a * Math.PI / 180);
      let lo = 0, hi = R + Lh + 5;
      for (let i = 0; i < 24; i++) { const t = (lo + hi) / 2, x = dx * t, z = dz * t, ex = Math.max(Math.abs(x) - Lh, 0); if (ex * ex + z * z <= R * R) lo = t; else hi = t; }
      return [cx + dx * lo, cy + dz * lo];
    };
    const band = (sec) => (sec.tier ? [96, 122] : [66, 92]);
    const out = d.sectors.map((sec) => {
      const [r0, r1] = band(sec), N = 6, pts = [];
      for (let i = 0; i <= N; i++) pts.push(pt(sec.a0 + ((sec.a1 - sec.a0) * i) / N + 0.4, r0));
      for (let i = N; i >= 0; i--) pts.push(pt(sec.a0 + ((sec.a1 - sec.a0) * i) / N - 0.4 * (i === 0 ? -1 : 1), r1));
      const mid = pt((sec.a0 + sec.a1) / 2, (r0 + r1) / 2);
      const free = sec.rows * sec.seats - (sold[sec.id] || 0);
      return `<g class="sec${sel === sec.id ? ' on' : ''}" data-sec="${sec.id}" role="button" tabindex="0" aria-label="${s('sector')} ${sec.id}">
        <path d="M${pts.map((p) => p.map((v) => v.toFixed(1)).join(',')).join('L')}Z" fill="${SECT_COL[sec.kind]}"/>
        <text x="${mid[0].toFixed(1)}" y="${(mid[1] + 3.5).toFixed(1)}" text-anchor="middle">${sec.id}</text><title>${sec.id} · ${free} ${s('free')}</title></g>`;
    });
    const track = (R) => { const a = []; for (let i = 0; i <= 72; i++) a.push(pt(i * 5, R)); return `M${a.map((p) => p.map((v) => v.toFixed(1)).join(',')).join('L')}Z`; };
    return `<svg class="st-map st-oval" viewBox="0 0 ${W} ${H}">
      <path d="${track(58)}" fill="#2a5fc4"/><path d="${track(46)}" fill="#2f8a3c"/>
      <rect x="${cx - 55}" y="${cy - 36}" width="110" height="72" fill="none" stroke="#e8f5e9" stroke-width="1.2"/>
      <line x1="${cx}" y1="${cy - 36}" x2="${cx}" y2="${cy + 36}" stroke="#e8f5e9" stroke-width="1.2"/>
      <circle cx="${cx}" cy="${cy}" r="9" fill="none" stroke="#e8f5e9" stroke-width="1.2"/>
      <text class="st-stand" x="${cx}" y="12" text-anchor="middle">${s('W')}</text><text class="st-stand" x="${cx}" y="${H - 4}" text-anchor="middle">${s('E')}</text>
      ${out.join('')}</svg>`;
  }

  function arenaMap(d, sold, sel) {
    const W = 380, H = 300, cx = W / 2, cy = H / 2 + 6, k = 2.4;
    const HX = 33 * k, HZ = 18 * k, RR = 11 * k;
    const pt = (a, off) => {
      const dx = Math.cos(a * Math.PI / 180), dz = Math.sin(a * Math.PI / 180);
      const hx = HX + off, hz = HZ + off, r = RR + off;
      let lo = 0, hi = hx + hz + 10;
      for (let i = 0; i < 24; i++) { const t = (lo + hi) / 2, ex = Math.max(Math.abs(dx * t) - (hx - r), 0), ez = Math.max(Math.abs(dz * t) - (hz - r), 0); if (ex * ex + ez * ez <= r * r) lo = t; else hi = t; }
      return [cx + dx * lo, cy + dz * lo];
    };
    const band = (sec) => (sec.tier ? [44, 70] : [6, 36]);
    const path = (pts) => `M${pts.map((p) => p.map((v) => v.toFixed(1)).join(',')).join('L')}Z`;
    const out = d.sectors.map((sec) => {
      const [r0, r1] = band(sec), N = 8, pts = [], g = 0.6;
      for (let i = 0; i <= N; i++) pts.push(pt(sec.a0 + g + ((sec.a1 - sec.a0 - 2 * g) * i) / N, r0));
      for (let i = N; i >= 0; i--) pts.push(pt(sec.a0 + g + ((sec.a1 - sec.a0 - 2 * g) * i) / N, r1));
      const mid = pt((sec.a0 + sec.a1) / 2, (r0 + r1) / 2);
      const free = sec.rows * sec.seats - (sold[sec.id] || 0);
      return `<g class="sec${sel === sec.id ? ' on' : ''}" data-sec="${sec.id}" role="button" tabindex="0" aria-label="${s('sector')} ${sec.id}">
        <path d="${path(pts)}" fill="${SECT_COL[sec.kind]}"/><text x="${mid[0].toFixed(1)}" y="${(mid[1] + 3).toFixed(1)}" text-anchor="middle">${sec.id}</text><title>${sec.id} · ${free} ${s('free')}</title></g>`;
    });
    const rink = (off) => { const a = []; for (let i = 0; i <= 90; i++) a.push(pt(i * 4, off)); return path(a); };
    const ice = (() => { const a = []; const kx = 30 * k, kz = 15 * k, kr = 8.5 * k; for (let i = 0; i <= 90; i++) { const ang = i * 4 * Math.PI / 180, dx = Math.cos(ang), dz = Math.sin(ang); let lo = 0, hi = kx + kz; for (let j = 0; j < 22; j++) { const t = (lo + hi) / 2, ex = Math.max(Math.abs(dx * t) - (kx - kr), 0), ez = Math.max(Math.abs(dz * t) - (kz - kr), 0); if (ex * ex + ez * ez <= kr * kr) lo = t; else hi = t; } a.push([cx + dx * lo, cy + dz * lo]); } return path(a); })();
    return `<svg class="st-map st-oval" viewBox="0 0 ${W} ${H}">
      <path d="${rink(-1)}" fill="#22252c"/><path d="${ice}" fill="#eef4f8"/>
      <line x1="${cx}" y1="${cy - 36}" x2="${cx}" y2="${cy + 36}" stroke="#c8202c" stroke-width="1.6"/>
      <line x1="${cx - 21}" y1="${cy - 36}" x2="${cx - 21}" y2="${cy + 36}" stroke="#1f56b5" stroke-width="1.4"/><line x1="${cx + 21}" y1="${cy - 36}" x2="${cx + 21}" y2="${cy + 36}" stroke="#1f56b5" stroke-width="1.4"/>
      <circle cx="${cx}" cy="${cy}" r="10" fill="none" stroke="#1f56b5" stroke-width="1.2"/>
      <text class="st-stand" x="${cx}" y="12" text-anchor="middle">▼ ${s('main_entrance')}</text>
      ${out.join('')}</svg>`;
  }

  window.StadiumMatchPage = async function StadiumMatchPage(page, mid) {
    const { api, esc, money, L, toast, errMsg, S } = K();
    page.className = 'mid';
    const d = await load(`id=${STADIUM_BY_PREFIX[mid[0]] || 'kaisar'}`);
    const M3 = module3d(d);
    let info = await api(`/stadium/matches/${mid}`);
    let secId = null, taken = new Set(), picked = [];
    const draw = async () => {
      const sec = secId && d.sectors.find((x) => x.id === secId);
      page.innerHTML = `
        <a class="back" href="${d.stadium.id === 'arena' ? '#/arena' : '#/stadium'}">‹ ${s('back')}</a>
        <h1>${esc(info.match.home)} — ${esc(info.match.away)}</h1>
        <p class="muted">${fmtDay(info.match.date)} · ${info.match.time} · ${esc(L(d.stadium.name))}</p>
        <h3>${s('choose_sector')}</h3>
        ${d.stadium.shape === 'oval' ? ovalMap(d, info.sold, secId) : d.stadium.shape === 'arena' ? arenaMap(d, info.sold, secId) : sectorMap(d, info.sold, secId)}
        <div class="st-legend">${[...new Set(d.sectors.map((x) => x.kind))].map((k) => `<span><i style="background:${SECT_COL[k]}"></i>${s(k)} · ${money(d.sectors.find((x) => x.kind === k).price)}</span>`).join('')}</div>
        <p class="small muted">${({ oval: s('oval_note'), arena: s('arena_note') })[d.stadium.shape] || s('approx')}</p>
        ${sec ? `<section class="card st-seats"><h3>${s('sector')} ${sec.id} · ${s(sec.stand)} · ${money(sec.price)}</h3><p class="small muted">${s('pick_seats')}</p>
          <div class="st-grid" style="--n:${sec.seats}">${Array.from({ length: sec.rows }, (_, ri) => {
            const r = sec.rows - ri;
            return `<span class="st-rl">${r}</span>` + Array.from({ length: sec.seats }, (_, k) => {
              const id = `${r}-${k + 1}`; const tk = taken.has(id); const on = picked.includes(id);
              return `<button class="sseat${tk ? ' tk' : ''}${on ? ' on' : ''}" data-seat="${id}" ${tk ? 'disabled' : ''} aria-label="${s('row')} ${r}, ${s('seat')} ${k + 1}"></button>`;
            }).join('');
          }).join('')}</div>
          <div class="st-bar"><span>${picked.length ? picked.map((p) => `${s('row')} ${p.split('-')[0]}/${p.split('-')[1]}`).join(', ') : '—'}</span>
            <button class="btn btn-ghost-b btn-sm" id="st3d" ${picked.length ? '' : 'disabled'}>${s('v3d')}</button>
            <button class="btn btn-green btn-sm" id="stBuy" ${picked.length ? '' : 'disabled'}>${s('buy', { p: money(sec.price * picked.length) })}</button></div>
        </section>` : ''}
        <div id="stPay"></div>`;
      page.querySelectorAll('[data-sec]').forEach((g) => g.addEventListener('click', async () => {
        secId = g.dataset.sec; picked = [];
        taken = new Set((await api(`/stadium/matches/${mid}/sectors/${secId}`)).taken);
        await draw(); page.querySelector('.st-seats').scrollIntoView({ behavior: 'smooth', block: 'start' });
      }));
      page.querySelectorAll('[data-seat]').forEach((b) => b.addEventListener('click', () => {
        const id = b.dataset.seat;
        if (picked.includes(id)) picked = picked.filter((x) => x !== id);
        else if (picked.length < 6) picked.push(id); else return;
        const y = window.scrollY; draw().then(() => window.scrollTo(0, y));
      }));
      const b3 = page.querySelector('#st3d'); if (b3) b3.addEventListener('click', () => open3D(sec));
      const bb = page.querySelector('#stBuy'); if (bb) bb.addEventListener('click', () => payForm(sec));
    };
    const open3D = (sec) => {
      const [r, k] = picked[picked.length - 1].split('-').map(Number);
      const inf = M3.info(sec, r, k);
      const view = document.createElement('section');
      view.className = 'view';
      view.innerHTML = `<canvas></canvas><button class="view-close icon-btn" aria-label="${s('back')}"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button>
        <div class="sheet"><button class="handle-btn" aria-expanded="true" aria-label="${K().t('sheet_hide')}"><span class="handle"></span></button>
        <div class="sheet-mini"><div class="mini-txt"><b>${sec.id} · ${s('row')} ${r} · ${s('seat')} ${k}</b><span>${inf.dist.toFixed(0)} м · ${money(sec.price)}</span></div>
          <button class="icon-btn mini-open" aria-label="${K().t('sheet_show')}"><svg viewBox="0 0 24 24"><path d="M6 15l6-6 6 6"/></svg></button></div>
        <div class="sheet-body"><div class="sheet-head"><div><span class="kicker">${s(sec.stand)}</span><h2>${s('sector')} ${sec.id} · ${s('row')} ${r} · ${s('seat')} ${k}</h2><span class="sub">${s(sec.kind)} · ${money(sec.price)}</span></div></div>
        <div class="stats"><div class="stat"><b>${inf.dist.toFixed(0)} м</b><span>${s('to_pitch')}</span></div><div class="stat"><b>${inf.height.toFixed(1)} м</b><span>${s('height')}</span></div><div class="stat"><b>${inf.angle}°</b><span>${s('angle')}</span></div></div></div></div>`;
      document.body.append(view); document.body.classList.add('no-scroll');
      const close = () => { M3.close(); view.remove(); document.body.classList.remove('no-scroll'); };
      view.querySelector('.view-close').addEventListener('click', close);
      // карточку можно свернуть (полоска / свайп вниз) и вернуть обратно (нажатие / свайп вверх)
      const sheet = view.querySelector('.sheet'), hb = view.querySelector('.handle-btn');
      const setMin = (min) => {
        sheet.classList.toggle('min', min);
        hb.setAttribute('aria-expanded', String(!min));
        hb.setAttribute('aria-label', K().t(min ? 'sheet_show' : 'sheet_hide'));
        try { localStorage.setItem('stSheetMin', min ? '1' : '0'); } catch (e) { /* приватный режим */ }
      };
      let sw = null;
      sheet.addEventListener('pointerdown', (e) => { sw = { y: e.clientY, moved: false }; });
      sheet.addEventListener('pointermove', (e) => { if (sw && Math.abs(e.clientY - sw.y) > 8) sw.moved = true; });
      sheet.addEventListener('pointerup', (e) => {
        if (!sw) return;
        const dy = e.clientY - sw.y;
        if (dy > 30) setMin(true);
        else if (dy < -30) setMin(false);
        else if (!sw.moved && (e.target.closest('.handle-btn, .mini-open') || sheet.classList.contains('min'))) setMin(!sheet.classList.contains('min'));
        sw = null;
      });
      sheet.addEventListener('pointercancel', () => { sw = null; });
      try { if (localStorage.getItem('stSheetMin') === '1') setMin(true); } catch (e) { /* ignore */ }
      if (!M3.available()) { view.querySelector('.sheet').classList.add('open'); return; }
      M3.open(view.querySelector('canvas'), { sectors: d.sectors, taken: { [sec.id]: [...taken] }, sector: sec, row: r, seat: k, match: info.match,
        onArrive: () => view.querySelector('.sheet').classList.add('open') });
    };
    const payForm = (sec) => {
      if (!S.user) { toast(K().t('login_to_pay')); location.hash = '#/login?next=profile'; return; }
      const box = page.querySelector('#stPay');
      box.innerHTML = `<form class="card" novalidate><h3>${s('pay_title')} · ${money(sec.price * picked.length)}</h3>
        <label class="field"><span>${K().t('card_number')}</span><input name="num" inputmode="numeric" placeholder="0000 0000 0000 0000" maxlength="23"></label>
        <div class="field-row"><label class="field"><span>${K().t('card_exp')}</span><input name="exp" placeholder="12/29" maxlength="5"></label>
        <label class="field"><span>CVC</span><input name="cvc" type="password" maxlength="4"></label></div>
        <label class="field"><span>${K().t('card_holder')}</span><input name="holder"></label>
        <button type="button" class="demo-card" data-demo><code>4242 4242 4242 4242</code><span>${K().t('demo_ok')}</span></button>
        <p class="form-err" role="alert"></p><button class="btn btn-green btn-block" type="submit">${s('buy', { p: money(sec.price * picked.length) })}</button></form>`;
      const f = box.querySelector('form');
      f.querySelector('[data-demo]').addEventListener('click', () => { f.num.value = '4242 4242 4242 4242'; f.exp.value = '12/30'; f.cvc.value = '123'; f.holder.value = S.user.name.toUpperCase(); });
      f.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
          const { ticket } = await api('/stadium/book', { method: 'POST', body: { match_id: mid, sector: sec.id, seats: picked, card: { number: f.num.value, exp: f.exp.value, cvc: f.cvc.value, holder: f.holder.value } } });
          box.innerHTML = `<div class="ticket big"><div class="success"><span class="check">✓</span><h2>${s('done')}</h2></div>
            <p><b>${esc(ticket.match.home)} — ${esc(ticket.match.away)}</b><br><span class="muted">${fmtDay(ticket.match.date)} · ${ticket.match.time}</span></p>
            <p>${s('sector')} ${ticket.sector}: ${ticket.seats.map((p) => `${s('row')} ${p.split('-')[0]}, ${s('seat')} ${p.split('-')[1]}`).join('; ')}</p>
            <div class="t-foot"><div><small class="muted">${K().t('booking_code')}</small><b class="code">${ticket.code}</b></div><div class="t-sum"><b>${money(ticket.total)}</b></div></div><div class="t-qr"><div id="stqr"></div></div></div>`;
          if (window.QRCode) new QRCode(box.querySelector('#stqr'), { text: `KAISAR:${ticket.code}`, width: 160, height: 160 });
          info = await api(`/stadium/matches/${mid}`); picked.forEach((p) => taken.add(p)); picked = [];
        } catch (err) { f.querySelector('.form-err').textContent = errMsg(err); }
      });
      box.scrollIntoView({ behavior: 'smooth' });
    };
    await draw();
  };
  window.StadiumTX = s;
})();
