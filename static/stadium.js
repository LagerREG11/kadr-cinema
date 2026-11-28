/* 3D City: главная страница-хаб и раздел стадиона «Қайсар Арена» (матчи → секторы → места → 3D-вид → покупка). */
(() => {
  'use strict';
  const K = () => window.KADR;
  const TX = {
    kk: {
      hub_title: '3D City · Қызылорда', hub_sub: 'Қаланың орындарын 3D-де көріп, билетті онлайн алыңыз.',
      cinema: 'KADR Cinema', cinema_d: 'Кинотеатр: афиша, орынды таңдау, 3D залдан көрініс', stadium: 'Қайсар Арена', stadium_d: 'Стадион: матчтар, секторлар, 3D трибунадан көрініс',
      soon: 'Жақында', soon_d: 'Жаңа 3D нысандар қосылады', open: 'Ашу',
      st_facts: '11 000 орын · алаң 105×68 м · УЕФА IV санаты', matches: 'Матчтар', demo: 'Демо-кесте: нақты матчтар емес',
      from: '{p} бастап', choose_sector: 'Секторды таңдаңыз', sector: 'Сектор', row: 'Қатар', seat: 'Орын', free: 'бос',
      v3d: '3D көрініс', buy: 'Сатып алу · {p}', pick_seats: 'Орын таңдаңыз (6-ға дейін)', approx: 'Схема шамамен: ресми секторлар жарияланбаған.',
      pay_title: 'Төлем', done: 'Билет дайын!', to_pitch: 'алаң ортасына дейін', height: 'биіктігі', angle: 'көру бұрышы', back: 'Артқа',
      vip: 'VIP', center: 'Орталық', side: 'Бүйір', east: 'Шығыс', end: 'Қақпа артында', away: 'Қонақтар', my: 'Стадион билеттері',
      W: 'Батыс трибуна', E: 'Шығыс трибуна', N: 'Солтүстік трибуна', S: 'Оңтүстік трибуна',
    },
    ru: {
      hub_title: '3D City · Кызылорда', hub_sub: 'Смотрите места города в 3D и покупайте билеты онлайн.',
      cinema: 'KADR Cinema', cinema_d: 'Кинотеатр: афиша, выбор места, вид из зала в 3D', stadium: 'Қайсар Арена', stadium_d: 'Стадион: матчи, секторы, вид с трибуны в 3D',
      soon: 'Скоро', soon_d: 'Добавим новые 3D-объекты', open: 'Открыть',
      st_facts: '11 000 мест · поле 105×68 м · УЕФА IV категория', matches: 'Матчи', demo: 'Демо-расписание: не реальные матчи',
      from: 'от {p}', choose_sector: 'Выберите сектор', sector: 'Сектор', row: 'Ряд', seat: 'Место', free: 'свободно',
      v3d: 'Вид в 3D', buy: 'Купить · {p}', pick_seats: 'Выберите места (до 6)', approx: 'Схема приблизительная: официальные секторы не опубликованы.',
      pay_title: 'Оплата', done: 'Билет готов!', to_pitch: 'до центра поля', height: 'высота', angle: 'угол обзора', back: 'Назад',
      vip: 'VIP', center: 'Центр', side: 'Боковой', east: 'Восток', end: 'За воротами', away: 'Гостевой', my: 'Билеты на стадион',
      W: 'Западная трибуна', E: 'Восточная трибуна', N: 'Северная трибуна', S: 'Южная трибуна',
    },
  };
  const s = (k, v = {}) => ((TX[K().S.lang] || TX.ru)[k] || TX.ru[k] || k).replace(/\{(\w+)\}/g, (_, x) => v[x] ?? '');
  let data = null;
  const load = async () => (data = data || await K().api('/stadium'));
  const fmtDay = (iso) => K().fmtDay(iso);

  // ---------- Главная 3D City ----------
  window.HubPage = function HubPage(page) {
    page.className = 'wide';
    page.innerHTML = `
      <section class="hub-hero"><h1>${s('hub_title')}</h1><p class="muted">${s('hub_sub')}</p></section>
      <div class="hub-grid">
        <a class="hub-card hc-cinema" href="#/cinema"><span class="hc-art">🎬</span><b>${s('cinema')}</b><small>${s('cinema_d')}</small><span class="btn btn-green btn-sm">${s('open')}</span></a>
        <a class="hub-card hc-stadium" href="#/stadium"><span class="hc-art">🏟️</span><b>${s('stadium')}</b><small>${s('stadium_d')}</small><span class="btn btn-green btn-sm">${s('open')}</span></a>
        <div class="hub-card hc-soon"><span class="hc-art">✨</span><b>${s('soon')}</b><small>${s('soon_d')}</small></div>
      </div>`;
  };

  // ---------- Стадион: матчи ----------
  window.StadiumPage = async function StadiumPage(page) {
    const { esc, money, L } = K();
    page.className = 'wide';
    const d = await load();
    const minP = Math.min(...d.sectors.map((x) => x.price));
    page.innerHTML = `
      <a class="back" href="#/">‹ 3D City</a>
      <section class="st-hero"><div><h1>🏟️ ${esc(d.stadium.name)}</h1><p class="muted">${esc(L(d.stadium.city))} · ${s('st_facts')}</p></div></section>
      <h3>${s('matches')}</h3><p class="small muted">${s('demo')}</p>
      <div class="st-matches">${d.matches.map((m) => `<a class="st-match" href="#/stadium/${m.id}">
        <small>${fmtDay(m.date)} · ${m.time}</small><b>${esc(m.home)} — ${esc(m.away)}</b><span class="muted small">${esc(L(m.tournament))}</span>
        <span class="st-from">${s('from', { p: money(minP) })}</span></a>`).join('')}</div>`;
  };

  // ---------- Стадион: секторы, места, 3D, покупка ----------
  const SECT_COL = { vip: '#3b5bdb', center: '#5fd38d', side: '#4fb37a', east: '#38a169', end: '#2f855a', away: '#8a94a6' };
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

  window.StadiumMatchPage = async function StadiumMatchPage(page, mid) {
    const { api, esc, money, L, toast, errMsg, S } = K();
    page.className = 'mid';
    const d = await load();
    let info = await api(`/stadium/matches/${mid}`);
    let secId = null, taken = new Set(), picked = [];
    const draw = async () => {
      const sec = secId && d.sectors.find((x) => x.id === secId);
      page.innerHTML = `
        <a class="back" href="#/stadium">‹ ${s('back')}</a>
        <h1>${esc(info.match.home)} — ${esc(info.match.away)}</h1>
        <p class="muted">${fmtDay(info.match.date)} · ${info.match.time} · ${esc(d.stadium.name)}</p>
        <h3>${s('choose_sector')}</h3>
        ${sectorMap(d, info.sold, secId)}
        <div class="st-legend">${['vip', 'center', 'side', 'east', 'end', 'away'].map((k) => `<span><i style="background:${SECT_COL[k]}"></i>${s(k)} · ${money(d.sectors.find((x) => x.kind === k).price)}</span>`).join('')}</div>
        <p class="small muted">${s('approx')}</p>
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
      const inf = window.Stadium3D.info(sec, r, k);
      const view = document.createElement('section');
      view.className = 'view';
      view.innerHTML = `<canvas></canvas><button class="view-close icon-btn" aria-label="${s('back')}"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button>
        <div class="sheet"><div class="sheet-head"><div><span class="kicker">${s(sec.stand)}</span><h2>${s('sector')} ${sec.id} · ${s('row')} ${r} · ${s('seat')} ${k}</h2><span class="sub">${s(sec.kind)} · ${money(sec.price)}</span></div></div>
        <div class="stats"><div class="stat"><b>${inf.dist.toFixed(0)} м</b><span>${s('to_pitch')}</span></div><div class="stat"><b>${inf.height.toFixed(1)} м</b><span>${s('height')}</span></div><div class="stat"><b>${inf.angle}°</b><span>${s('angle')}</span></div></div></div>`;
      document.body.append(view); document.body.classList.add('no-scroll');
      const close = () => { window.Stadium3D.close(); view.remove(); document.body.classList.remove('no-scroll'); };
      view.querySelector('.view-close').addEventListener('click', close);
      if (!window.Stadium3D.available()) { view.querySelector('.sheet').classList.add('open'); return; }
      window.Stadium3D.open(view.querySelector('canvas'), { sectors: d.sectors, taken: { [sec.id]: [...taken] }, sector: sec, row: r, seat: k,
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
