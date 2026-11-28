/* Раздел театра им. Н. Бекежанова: афиша → схема зала → 3D-вид с места → оплата (демо) → билет. */
(() => {
  'use strict';
  const K = () => window.KADR;
  const TX = {
    kk: {
      title: 'Бекежанов театры', facts: '1955 жылдан · көрермен залы ~{n} орын', shows: 'Афиша', demo: 'Демо-афиша: нақты кесте емес',
      from: '{p} бастап', min: '{n} мин', back: 'Артқа', stage: 'САХНА', parter: 'Партер', amfi: 'Амфитеатр', row: 'Қатар', seat: 'Орын',
      step1: 'Орын таңдау', step2: '3D көрініс', step3: 'Төлем', pick: 'Схемадан орынды басыңыз (6-ға дейін). Таңдалған орынды басып, 3D-де көріңіз.',
      v3d: '3D көрініс', buy: 'Сатып алу · {p}', none: 'Орын таңдалмады', approx: 'Зал схемасы театрдың ресми 3D-туры бойынша шамамен жасалған.',
      front: '1–5 қатар', parter_z: '6–10 қатар', amfi_z: '11–16 қатар', amfi_back: '17–22 қатар', taken: 'Бос емес', chosen: 'Таңдалды',
      to_stage: 'сахнаға дейін', height: 'сахнадан биік', angle: 'бүйірлік бұрыш', pay_title: 'Төлем', done: 'Билет дайын!', my: 'Театр билеттері',
      hub: 'Драма театры', hub_d: 'Н. Бекежанов театры: афиша, зал схемасы, 3D орыннан көрініс',
    },
    ru: {
      title: 'Театр Бекежанова', facts: 'с 1955 года · зрительный зал ~{n} мест', shows: 'Афиша', demo: 'Демо-афиша: не реальное расписание',
      from: 'от {p}', min: '{n} мин', back: 'Назад', stage: 'СЦЕНА', parter: 'Партер', amfi: 'Амфитеатр', row: 'Ряд', seat: 'Место',
      step1: 'Выбор места', step2: 'Вид в 3D', step3: 'Оплата', pick: 'Нажмите на место на схеме (до 6). Нажмите на выбранное место, чтобы посмотреть в 3D.',
      v3d: 'Вид в 3D', buy: 'Купить · {p}', none: 'Места не выбраны', approx: 'Схема зала приблизительная, по официальному 3D-туру театра.',
      front: 'ряды 1–5', parter_z: 'ряды 6–10', amfi_z: 'ряды 11–16', amfi_back: 'ряды 17–22', taken: 'Занято', chosen: 'Выбрано',
      to_stage: 'до сцены', height: 'выше сцены', angle: 'угол сбоку', pay_title: 'Оплата', done: 'Билет готов!', my: 'Билеты в театр',
      hub: 'Драмтеатр', hub_d: 'Театр Бекежанова: афиша, схема зала, вид с места в 3D',
    },
  };
  const s = (k, v = {}) => ((TX[K().S.lang] || TX.ru)[k] || TX.ru[k] || k).replace(/\{(\w+)\}/g, (_, x) => v[x] ?? '');
  const ZONE_COL = { front: '#d23a46', parter: '#e0765a', amfi: '#d9a441', amfi_back: '#8f9bb3' };
  const ZONE_TX = { front: 'front', parter: 'parter_z', amfi: 'amfi_z', amfi_back: 'amfi_back' };
  let data = null;
  const load = async () => (data = data || await K().api('/theatre'));
  const poster = (play, L) => `<div class="th-poster" style="--h:${play.hue}"><span>🎭</span><b>${K().esc(L(play.title))}</b><small>${K().esc(L(play.author))}</small></div>`;
  window.TheatreTX = s;

  // ---------- Афиша ----------
  window.TheatrePage = async function TheatrePage(page) {
    const { esc, money, L, fmtDay } = K();
    page.className = 'wide';
    const d = await load();
    const minP = Math.min(...d.rows.map((r) => r.price));
    page.innerHTML = `
      <a class="back" href="#/">‹ 3D Ticket</a>
      <section class="th-hero"><div><h1>🎭 ${esc(L(d.theatre.name))}</h1><p>${esc(L(d.theatre.full))}</p>
        <p class="muted small">${esc(L(d.theatre.address))} · ${s('facts', { n: d.total })}</p></div></section>
      <h3>${s('shows')}</h3><p class="small muted">${s('demo')}</p>
      <div class="th-shows">${d.shows.map((x) => `<a class="th-show" href="#/theatre/${x.id}">${poster(x.play, L)}
        <div class="th-meta"><small>${fmtDay(x.date)} · ${x.time}</small><b>${esc(L(x.play.title))}</b>
        <span class="muted small">${esc(L(x.play.genre))} · ${s('min', { n: x.play.minutes })} · ${x.play.age}</span>
        <span class="st-from">${s('from', { p: money(minP) })}</span></div></a>`).join('')}</div>`;
  };

  // ---------- Спектакль: схема зала, 3D, покупка ----------
  window.TheatreShowPage = async function TheatreShowPage(page, sid) {
    const { api, esc, money, L, toast, errMsg, S, fmtDay } = K();
    page.className = 'mid';
    const d = await load();
    let info = await api(`/theatre/shows/${sid}`);
    let taken = new Set(info.taken), picked = [], step = 1;
    let zoom = (() => { try { return Number(localStorage.getItem('thZoom')) || 0; } catch (e) { return 0; } })();
    const autoZoom = !zoom; if (!zoom) zoom = 1;
    const priceOf = (id) => d.rows[Number(id.split('-')[0]) - 1].price;
    const total = () => picked.reduce((a, id) => a + priceOf(id), 0);
    const label = (id) => `${id.split('-')[0]} ${s('row').toLowerCase()} · ${id.split('-')[1]} ${s('seat').toLowerCase()}`;

    const rowHtml = (row) => {
      let k = 0;
      const parts = row.blocks.map((n) => Array.from({ length: n }, () => {
        k += 1;
        const id = `${row.row}-${k}`, tk = taken.has(id), on = picked.includes(id);
        return `<button class="tseat${tk ? ' tk' : ''}${on ? ' on' : ''}" style="--c:${ZONE_COL[row.zone]}" data-seat="${id}" ${tk ? 'disabled' : ''}
          aria-label="${s('row')} ${row.row}, ${s('seat')} ${k}${tk ? ', ' + s('taken') : ''}" title="${s('row')} ${row.row} · ${s('seat')} ${k} · ${money(row.price)}">${k}</button>`;
      }).join(''));
      return `<div class="trow${row.row <= 10 ? ' parter' : ''}"><span class="trl">${row.row}</span><div class="tblocks">${parts.map((p) => `<div class="tblock">${p}</div>`).join('<i class="taisle"></i>')}</div><span class="trl">${row.row}</span></div>`;
    };

    const draw = () => {
      const show = info.show;
      page.innerHTML = `
        <a class="back" href="#/theatre">‹ ${s('back')}</a>
        <section class="th-head">${poster(show.play, L)}<div><h1>${esc(L(show.play.title))}</h1>
          <p class="muted">${esc(L(show.play.author))} · ${esc(L(show.play.genre))} · ${show.play.age}</p>
          <p><b>${fmtDay(show.date)} · ${show.time}</b> · ${s('min', { n: show.play.minutes })}</p>
          <p class="small muted">${esc(L(d.theatre.address))}</p></div></section>
        <ol class="th-steps">${[1, 2, 3].map((n) => `<li class="${step === n ? 'on' : step > n ? 'ok' : ''}"><span>${n}</span>${s('step' + n)}</li>`).join('')}</ol>
        <section class="card th-map">
          <p class="small muted">${s('pick')}</p>
          <div class="th-zoom"><button class="icon-btn" data-z="-1" aria-label="−">−</button><button class="icon-btn" data-z="1" aria-label="+">+</button></div>
          <div class="th-scroll"><div class="th-hall" style="--sz:${Math.round(20 * zoom)}px">
            <div class="th-stage">${s('stage')}</div>
            <div class="th-zone">${s('parter')}</div>
            ${d.rows.filter((r) => r.row <= 10).map(rowHtml).join('')}
            <div class="th-zone">${s('amfi')}</div>
            ${d.rows.filter((r) => r.row > 10).map(rowHtml).join('')}
          </div></div>
          <div class="st-legend">${Object.keys(ZONE_COL).map((z) => `<span><i style="background:${ZONE_COL[z]}"></i>${s(ZONE_TX[z])} · ${money(d.rows.find((r) => r.zone === z).price)}</span>`).join('')}
            <span><i class="lg-tk"></i>${s('taken')}</span><span><i class="lg-on"></i>${s('chosen')}</span></div>
          <p class="small muted center">${s('approx')}</p>
        </section>
        <div class="th-bar">
          <div class="th-chips">${picked.length ? picked.map((id) => `<button class="chip" data-chip="${id}" title="${s('v3d')}">${label(id)} · 3D</button>`).join('') : `<span class="muted small">${s('none')}</span>`}</div>
          <div class="th-actions"><button class="btn btn-ghost-b btn-sm" id="th3d" ${picked.length ? '' : 'disabled'}>${s('v3d')}</button>
          <button class="btn btn-green btn-sm" id="thBuy" ${picked.length ? '' : 'disabled'}>${s('buy', { p: money(total()) })}</button></div>
        </div>
        <div id="thPay"></div>`;
      page.querySelectorAll('[data-seat]').forEach((b) => b.addEventListener('click', () => {
        const id = b.dataset.seat;
        if (picked.includes(id)) picked = picked.filter((x) => x !== id);
        else if (picked.length < 6) picked.push(id); else { toast(s('pick')); return; }
        step = 1; redraw();
      }));
      page.querySelectorAll('[data-chip]').forEach((b) => b.addEventListener('click', () => open3D(b.dataset.chip)));
      page.querySelectorAll('[data-z]').forEach((b) => b.addEventListener('click', () => {
        zoom = Math.min(1.6, Math.max(0.7, zoom + Number(b.dataset.z) * 0.15));
        try { localStorage.setItem('thZoom', String(zoom)); } catch (e) { /* ignore */ }
        redraw();
      }));
      const b3 = page.querySelector('#th3d'); if (b3) b3.addEventListener('click', () => open3D(picked[picked.length - 1]));
      const bb = page.querySelector('#thBuy'); if (bb) bb.addEventListener('click', payForm);
    };
    const redraw = () => {
      const y = window.scrollY, sc = page.querySelector('.th-scroll'), sl = sc ? sc.scrollLeft : 0;
      draw(); window.scrollTo(0, y);
      const sc2 = page.querySelector('.th-scroll'); if (sc2) sc2.scrollLeft = sl;
    };
    const centerMap = () => { const sc = page.querySelector('.th-scroll'); if (sc) sc.scrollLeft = (sc.scrollWidth - sc.clientWidth) / 2; };

    const open3D = (id) => {
      const [r, k] = id.split('-').map(Number);
      const row = d.rows[r - 1];
      step = Math.max(step, 2);
      const inf = window.Theatre3D.info(row, k);
      const view = document.createElement('section');
      view.className = 'view';
      view.innerHTML = `<canvas></canvas><button class="view-close icon-btn" aria-label="${s('back')}"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button>
        <div class="sheet"><button class="handle-btn" aria-expanded="true" aria-label="${K().t('sheet_hide')}"><span class="handle"></span></button>
        <div class="sheet-mini"><div class="mini-txt"><b>${label(id)}</b><span>${inf.dist.toFixed(1)} м · ${money(row.price)}</span></div>
          <button class="icon-btn mini-open" aria-label="${K().t('sheet_show')}"><svg viewBox="0 0 24 24"><path d="M6 15l6-6 6 6"/></svg></button></div>
        <div class="sheet-body"><div class="sheet-head"><div><span class="kicker">${s(r <= 10 ? 'parter' : 'amfi')}</span><h2>${s('row')} ${r} · ${s('seat')} ${k}</h2><span class="sub">${esc(L(info.show.play.title))} · ${money(row.price)}</span></div></div>
        <div class="stats"><div class="stat"><b>${inf.dist.toFixed(1)} м</b><span>${s('to_stage')}</span></div><div class="stat"><b>${inf.height.toFixed(1)} м</b><span>${s('height')}</span></div><div class="stat"><b>${inf.angle}°</b><span>${s('angle')}</span></div></div>
        <div class="sheet-actions"><button class="btn btn-green" data-act="buy">${s('buy', { p: money(total()) })}</button></div></div></div>`;
      document.body.append(view); document.body.classList.add('no-scroll');
      const close = () => { window.Theatre3D.close(); view.remove(); document.body.classList.remove('no-scroll'); redraw(); };
      view.querySelector('.view-close').addEventListener('click', close);
      view.querySelector('[data-act="buy"]').addEventListener('click', () => { close(); payForm(); });
      view.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
      const sheet = view.querySelector('.sheet'), hb = view.querySelector('.handle-btn');
      const setMin = (min) => {
        sheet.classList.toggle('min', min);
        hb.setAttribute('aria-expanded', String(!min));
        hb.setAttribute('aria-label', K().t(min ? 'sheet_show' : 'sheet_hide'));
        try { localStorage.setItem('thSheetMin', min ? '1' : '0'); } catch (e) { /* ignore */ }
      };
      let sw = null;
      sheet.addEventListener('pointerdown', (e) => { if (e.target.closest('[data-act]')) return; sw = { y: e.clientY, moved: false }; });
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
      try { if (localStorage.getItem('thSheetMin') === '1') setMin(true); } catch (e) { /* ignore */ }
      if (!window.Theatre3D.available()) { sheet.classList.add('open'); return; }
      window.Theatre3D.open(view.querySelector('canvas'), { rows: d.rows, taken: [...taken], row: r, seat: k, onArrive: () => sheet.classList.add('open') });
    };

    const payForm = () => {
      if (!S.user) { toast(K().t('login_to_pay')); location.hash = '#/login?next=profile'; return; }
      step = 3; redraw();
      const box = page.querySelector('#thPay');
      box.innerHTML = `<form class="card" novalidate><h3>${s('pay_title')} · ${money(total())}</h3>
        <p class="small muted">${picked.map(label).join('; ')}</p>
        <label class="field"><span>${K().t('card_number')}</span><input name="num" inputmode="numeric" placeholder="0000 0000 0000 0000" maxlength="23"></label>
        <div class="field-row"><label class="field"><span>${K().t('card_exp')}</span><input name="exp" placeholder="12/29" maxlength="5"></label>
        <label class="field"><span>CVC</span><input name="cvc" type="password" maxlength="4"></label></div>
        <label class="field"><span>${K().t('card_holder')}</span><input name="holder"></label>
        <button type="button" class="demo-card" data-demo><code>4242 4242 4242 4242</code><span>${K().t('demo_ok')}</span></button>
        <p class="form-err" role="alert"></p><button class="btn btn-green btn-block" type="submit">${s('buy', { p: money(total()) })}</button></form>`;
      const f = box.querySelector('form');
      f.querySelector('[data-demo]').addEventListener('click', () => { f.num.value = '4242 4242 4242 4242'; f.exp.value = '12/30'; f.cvc.value = '123'; f.holder.value = S.user.name.toUpperCase(); });
      f.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
          const { ticket } = await api('/theatre/book', { method: 'POST', body: { show_id: sid, seats: picked, card: { number: f.num.value, exp: f.exp.value, cvc: f.cvc.value, holder: f.holder.value } } });
          picked.forEach((p) => taken.add(p)); picked = []; step = 1;
          draw();
          const out = page.querySelector('#thPay');
          out.innerHTML = ticketHtml(ticket, true);
          if (window.QRCode) new QRCode(out.querySelector('.t-qr div'), { text: `BEKEZHANOV:${ticket.code}`, width: 160, height: 160 });
          out.scrollIntoView({ behavior: 'smooth' });
        } catch (err) {
          f.querySelector('.form-err').textContent = errMsg(err);
          if (err && err.data && err.data.seats) { err.data.seats.forEach((x) => taken.add(x)); }
        }
      });
      box.scrollIntoView({ behavior: 'smooth' });
    };
    draw();
    if (autoZoom) { const sc = page.querySelector('.th-scroll'); if (sc && sc.scrollWidth > sc.clientWidth) { zoom = Math.max(0.7, Math.floor((sc.clientWidth / sc.scrollWidth) * 100) / 100); draw(); } }
    centerMap();
  };

  function ticketHtml(ticket, big) {
    const { esc, money, L, fmtDay } = K();
    return `<div class="ticket${big ? ' big' : ''}">${big ? `<div class="success"><span class="check">✓</span><h2>${s('done')}</h2></div>` : ''}
      <p><b>🎭 ${esc(L(ticket.show.play.title))}</b><br><span class="muted">${fmtDay(ticket.show.date)} · ${ticket.show.time} · ${esc(L(data ? data.theatre.name : ticket.show.play.author))}</span></p>
      <p>${ticket.seats.map((p) => `${s('row')} ${p.split('-')[0]}, ${s('seat')} ${p.split('-')[1]}`).join('; ')}</p>
      <div class="t-foot"><div><small class="muted">${K().t('booking_code')}</small><b class="code">${ticket.code}</b></div><div class="t-sum"><b>${money(ticket.total)}</b></div></div>
      ${big ? '<div class="t-qr"><div></div></div>' : ''}</div>`;
  }

  // «Билеттерім»: добавить билеты в театр
  window.TheatreTickets = async function TheatreTickets(page) {
    try {
      await load();
      const { tickets } = await K().api('/theatre/my');
      const list = tickets.filter((x) => x.show);
      if (!list.length) return;
      const sec = document.createElement('section');
      sec.innerHTML = `<h3 class="sec">${s('my')}</h3><div class="tlist">${list.map((x) => ticketHtml(x, false)).join('')}</div>`;
      page.append(sec);
    } catch (e) { /* без театральных билетов */ }
  };
})();
