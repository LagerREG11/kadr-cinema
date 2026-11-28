/* 3D-модель «Қайсар Арены»: поле 105×68, чаша трибун (4 трибуны, 20 секторов), крыша-козырёк, жёлтый фасад.
   Камера пролетает над стадионом к выбранному месту и смотрит на поле. */
(() => {
  'use strict';
  const PL = 105, PW = 68;          // размер поля
  const GAP_SIDE = 6, GAP_END = 8;  // от поля до первого ряда
  const ROW_D = 0.8, ROW_H = 0.45, FIRST_H = 1.2, ROWS = 20;
  const DEPTH = ROWS * ROW_D;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const isSide = (sec) => sec.stand === 'W' || sec.stand === 'E';
  const AISLE = 1.4; // лестничный проход между секторами

  // позиция места: sector = {stand, index, count, seats}; row, seat — с 1
  function seatPos(sec, row, seat) {
    const r = row - 1;
    const out = isSide(sec) ? PW / 2 + GAP_SIDE + r * ROW_D : PL / 2 + GAP_END + r * ROW_D;
    const y = FIRST_H + r * ROW_H;
    const span = isSide(sec) ? 96 : 60;
    const w = span / sec.count;
    const along = -span / 2 + sec.index * w + AISLE / 2 + (seat - 0.5) * ((w - AISLE) / sec.seats);
    switch (sec.stand) {
      case 'W': return { x: along, y, z: -out };
      case 'E': return { x: -along, y, z: out };
      case 'N': return { x: out, y, z: along };
      default: return { x: -out, y, z: -along };
    }
  }
  function info(sec, row, seat) {
    const p = seatPos(sec, row, seat);
    const toEdge = Math.max(1, (isSide(sec) ? Math.abs(p.z) - PW / 2 : Math.abs(p.x) - PL / 2));
    return { dist: Math.hypot(p.x, p.z), height: p.y, toEdge, angle: Math.round(Math.atan2(p.y, toEdge) * 180 / Math.PI) };
  }

  // высота и азимут солнца над Кызылордой (44.85° с.ш., 65.51° в.д., UTC+5) в момент матча
  function sunAt(dateStr, timeStr, geo) {
    const g0 = geo || { lat: 44.85, lon: 65.51 }; // по умолчанию — Кызылорда
    const d = dateStr ? new Date(dateStr + 'T00:00:00') : new Date();
    const [hh, mm] = (timeStr || '18:00').split(':').map(Number);
    const N = Math.round((d - new Date(d.getFullYear(), 0, 0)) / 864e5);
    const rad = Math.PI / 180, lat = g0.lat * rad;
    const decl = 23.44 * rad * Math.sin(2 * Math.PI * (284 + N) / 365);
    const B = 2 * Math.PI * (N - 81) / 364;
    const eot = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
    const solar = hh + mm / 60 + (4 * (g0.lon - 75) + eot) / 60;
    const H = 15 * (solar - 12) * rad;
    const el = Math.asin(Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(H));
    const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(lat) - Math.tan(decl) * Math.cos(lat));
    return { el: el / rad, az };
  }
  const lerp = (a, b, t) => a + (b - a) * t;
  function mixHex(a, b, t) {
    const ca = new THREE.Color(a), cb = new THREE.Color(b);
    return ca.lerp(cb, clamp(t, 0, 1));
  }
  // палитра неба по высоте солнца: ночь → сумерки → закат → день
  function skyColors(el) {
    const keys = [[-18, '#02040d', '#141c3f'], [-8, '#08113a', '#3a3f7a'], [-2, '#1f3a78', '#e0805a'], [4, '#5b86c2', '#f5c08c'], [15, '#3f7fd0', '#cfe2f3'], [90, '#2f6fc8', '#bcd7f0']];
    let i = 0; while (i < keys.length - 2 && el > keys[i + 1][0]) i++;
    const [e0, t0, h0] = keys[i], [e1, t1, h1] = keys[i + 1];
    const k = clamp((el - e0) / (e1 - e0), 0, 1);
    return { top: mixHex(t0, t1, k), hor: mixHex(h0, h1, k) };
  }

  function canvasTex(w, h, draw) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.anisotropy = 8; return t;
  }
  function pitchTexture() {
    return canvasTex(1260, 840, (g, W, H) => {
      const sx = W / 120, sy = H / 80;
      for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? '#1f6a2a' : '#257631'; g.fillRect(i * W / 16, 0, W / 16 + 1, H); }
      g.strokeStyle = '#f4f7f2'; g.fillStyle = '#f4f7f2'; g.lineWidth = 4;
      const X = (m) => (m + 60) * sx, Y = (m) => (m + 40) * sy;
      g.strokeRect(X(-52.5), Y(-34), 105 * sx, 68 * sy);
      g.beginPath(); g.moveTo(X(0), Y(-34)); g.lineTo(X(0), Y(34)); g.stroke();
      g.beginPath(); g.ellipse(X(0), Y(0), 9.15 * sx, 9.15 * sy, 0, 0, Math.PI * 2); g.stroke();
      [-1, 1].forEach((s) => {
        g.strokeRect(s < 0 ? X(-52.5) : X(36), Y(-20.16), 16.5 * sx, 40.32 * sy);
        g.strokeRect(s < 0 ? X(-52.5) : X(47), Y(-9.16), 5.5 * sx, 18.32 * sy);
        g.beginPath(); g.arc(X(s * 41.5), Y(0), 3, 0, Math.PI * 2); g.fill();
      });
      g.beginPath(); g.arc(X(0), Y(0), 4, 0, Math.PI * 2); g.fill();
    });
  }
  function rrectShape(hx, hz, r) {
    const s = new THREE.Shape();
    s.moveTo(-hx + r, -hz); s.lineTo(hx - r, -hz); s.quadraticCurveTo(hx, -hz, hx, -hz + r);
    s.lineTo(hx, hz - r); s.quadraticCurveTo(hx, hz, hx - r, hz); s.lineTo(-hx + r, hz);
    s.quadraticCurveTo(-hx, hz, -hx, hz - r); s.lineTo(-hx, -hz + r); s.quadraticCurveTo(-hx, -hz, -hx + r, -hz);
    return s;
  }
  function ring(outer, inner, depth, mat) {
    const sh = rrectShape(...outer);
    sh.holes.push(rrectShape(...inner));
    const m = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false, curveSegments: 24 }), mat);
    m.rotation.x = -Math.PI / 2;
    return m;
  }

  // небо, солнце/луна и свет по дате и времени матча (общее для всех стадионов)
  function addSky(scene, match, geo) {
    const sun = sunAt(match && match.date, match && match.time, geo);
    const el = sun.el, day = clamp((el + 2) / 14, 0, 1), night = clamp((-el - 3) / 9, 0, 1);
    const sc = skyColors(el);
    scene.background = sc.hor.clone();
    const css = (c) => '#' + c.getHexString();
    const skyTex = canvasTex(2048, 1024, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, css(sc.top)); gr.addColorStop(0.47, css(sc.hor)); gr.addColorStop(0.5, css(sc.hor)); gr.addColorStop(1, '#14130f');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      if (night > 0) {
        for (let i = 0; i < 2600; i++) {
          const r = Math.random() < 0.06 ? 1.6 : 0.8;
          g.fillStyle = `rgba(255,255,255,${(0.35 + Math.random() * 0.65) * night})`;
          g.beginPath(); g.arc(Math.random() * w, Math.random() * h * 0.46, r, 0, Math.PI * 2); g.fill();
        }
      }
    });
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false, toneMapped: false })));
    const sunDir = new THREE.Vector3(-Math.sin(sun.az) * Math.cos(el * Math.PI / 180), Math.sin(el * Math.PI / 180), Math.cos(sun.az) * Math.cos(el * Math.PI / 180)).normalize();
    if (el > -4) { // солнце (у горизонта — крупное и тёплое)
      const low = clamp(1 - el / 20, 0, 1);
      const sunTex = canvasTex(256, 256, (g, w) => {
        const gr = g.createRadialGradient(w / 2, w / 2, 8, w / 2, w / 2, w / 2);
        gr.addColorStop(0, 'rgba(255,253,240,1)'); gr.addColorStop(0.18, `rgba(255,${Math.round(lerp(245, 200, low))},${Math.round(lerp(220, 140, low))},1)`);
        gr.addColorStop(0.3, `rgba(255,${Math.round(lerp(230, 160, low))},120,.45)`); gr.addColorStop(1, 'rgba(255,170,90,0)');
        g.fillStyle = gr; g.fillRect(0, 0, w, w);
      });
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTex, fog: false, toneMapped: false, depthWrite: false }));
      sp.scale.set(lerp(140, 220, low), lerp(140, 220, low), 1); sp.position.copy(sunDir).multiplyScalar(800); scene.add(sp);
    }
    if (night > 0.2) { // луна
      const moonTex = canvasTex(256, 256, (g, w) => {
        const gr = g.createRadialGradient(w / 2, w / 2, 20, w / 2, w / 2, w / 2);
        gr.addColorStop(0, 'rgba(255,250,230,1)'); gr.addColorStop(0.32, 'rgba(255,248,225,1)'); gr.addColorStop(0.36, 'rgba(200,210,255,.35)'); gr.addColorStop(1, 'rgba(120,140,255,0)');
        g.fillStyle = gr; g.fillRect(0, 0, w, w);
        g.fillStyle = 'rgba(210,205,190,.55)'; [[110, 100, 14], [150, 140, 10], [120, 150, 7]].forEach(([x, y, r]) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); });
      });
      const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonTex, fog: false, toneMapped: false, depthWrite: false, opacity: night }));
      moon.scale.set(110, 110, 1); moon.position.set(-420, 330, -520); scene.add(moon);
    }
    scene.fog = new THREE.Fog(sc.hor.getHex(), 500, 1300);
    scene.add(new THREE.HemisphereLight(sc.top.clone().lerp(new THREE.Color(0xffffff), 0.6), 0x2a2620, lerp(0.35, 0.6, day)));
    if (el > -2) {
      const sl = new THREE.DirectionalLight(mixHex('#ffb070', '#fff6e8', el / 25), lerp(0.2, 1.1, day));
      sl.position.copy(sunDir).multiplyScalar(300); scene.add(sl);
    }
    if (night > 0) { const ml = new THREE.DirectionalLight(0x9fb4ff, 0.2 * night); ml.position.set(-420, 330, -520); scene.add(ml); }
    return { el, night };
  }

  function build(sectors, takenBySector, match) {
    const scene = new THREE.Scene();
    const { el } = addSky(scene, match);
    // прожекторы стадиона: на полную в сумерках и ночью
    const flood = lerp(0.25, 0.85, clamp(1 - el / 6, 0, 1));
    [[-60, -45], [60, -45], [-60, 45], [60, 45]].forEach(([x, z]) => {
      const sp = new THREE.SpotLight(0xffffff, flood, 260, Math.PI / 3.2, 0.5, 1);
      sp.position.set(x * 1.15, 26, z * 1.25); sp.target.position.set(x * 0.25, 0, z * 0.2);
      scene.add(sp, sp.target);
    });

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), new THREE.MeshStandardMaterial({ color: 0x3a3630, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.05; scene.add(ground);
    const pitch = new THREE.Mesh(new THREE.PlaneGeometry(120, 80), new THREE.MeshStandardMaterial({ map: pitchTexture(), roughness: 0.95 }));
    pitch.rotation.x = -Math.PI / 2; scene.add(pitch);
    const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
    [-1, 1].forEach((s) => {
      [-3.66, 3.66].forEach((z) => { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.44, 8), white); p.position.set(s * 52.5, 1.22, z); scene.add(p); });
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 7.32, 8), white);
      bar.rotation.x = Math.PI / 2; bar.position.set(s * 52.5, 2.44, 0); scene.add(bar);
    });

    // чаша трибун: ступенчатое бетонное основание (кольцо на каждый ряд)
    const concrete = new THREE.MeshStandardMaterial({ color: 0x86888d, roughness: 0.95 });
    const wallPanel = new THREE.MeshStandardMaterial({ color: 0xb4b6b9, roughness: 0.9 });
    const standBlock = (len, out0, horiz) => {
      for (let r = 0; r < ROWS; r++) {
        const h = FIRST_H + r * ROW_H;
        [-1, 1].forEach((sg) => {
          const b = new THREE.Mesh(new THREE.BoxGeometry(horiz ? len : ROW_D, h, horiz ? ROW_D : len), concrete);
          const o = out0 + r * ROW_D + ROW_D / 2;
          if (horiz) b.position.set(0, h / 2, sg * o); else b.position.set(sg * o, h / 2, 0);
          scene.add(b);
        });
      }
    };
    standBlock(98, PW / 2 + GAP_SIDE - 0.4, true);
    standBlock(62, PL / 2 + GAP_END - 0.4, false);
    // высокая светло-серая стена за трибунами и в открытых углах
    const wallH = FIRST_H + ROWS * ROW_H + 7;
    const wx = PL / 2 + GAP_END + DEPTH + 0.6, wz = PW / 2 + GAP_SIDE + DEPTH + 0.6;
    [[wx * 2 + 2, 0, -wz, 0], [wx * 2 + 2, 0, wz, 0], [wz * 2 + 2, wx, 0, Math.PI / 2], [wz * 2 + 2, -wx, 0, Math.PI / 2]].forEach(([len, x, z, ry2]) => {
      const w = new THREE.Mesh(new THREE.BoxGeometry(len, wallH, 0.5), wallPanel);
      w.position.set(x, wallH / 2, z); w.rotation.y = ry2; scene.add(w);
    });

    // места: одна InstancedMesh на все ~11 000 кресел
    const total = sectors.reduce((s, x) => s + x.rows * x.seats, 0);
    const seatMat = new THREE.MeshStandardMaterial({ roughness: 0.55 });
    const seats = new THREE.InstancedMesh(new THREE.BoxGeometry(0.42, 0.07, 0.36), seatMat, total);
    const backs = new THREE.InstancedMesh(new THREE.BoxGeometry(0.42, 0.38, 0.05), seatMat, total);
    const MOSAIC = [0xe6b012, 0x1f4fa8, 0xd9dde2, 0xe6b012, 0x1f4fa8];
    const dummy = new THREE.Object3D(), col = new THREE.Color();
    let n = 0;
    sectors.forEach((sec) => {
      const taken = new Set(takenBySector[sec.id] || []);
      for (let r = 1; r <= sec.rows; r++) {
        for (let k = 1; k <= sec.seats; k++) {
          const p = seatPos(sec, r, k);
          dummy.position.set(p.x, p.y + 0.42, p.z);
          dummy.rotation.set(0, 0, 0);
          dummy.lookAt(isSide(sec) ? p.x : 0, p.y + 0.42, isSide(sec) ? 0 : p.z);
          dummy.updateMatrix();
          seats.setMatrixAt(n, dummy.matrix);
          dummy.translateZ(-0.17); dummy.translateY(0.2); dummy.rotateX(-0.12); dummy.updateMatrix();
          backs.setMatrixAt(n, dummy.matrix);
          const hsh = (r * 73856093) ^ (k * 19349663) ^ (sec.index * 83492791);
          const base = sec.kind === 'vip' ? 0x2b4a8c : MOSAIC[Math.abs(hsh) % MOSAIC.length];
          col.set(taken.has(`${r}-${k}`) ? 0x3d4148 : base);
          seats.setColorAt(n, col); backs.setColorAt(n, col);
          n++;
        }
      }
    });
    scene.add(seats, backs);

    // лестничные проходы между секторами: жёлтые кромки ступеней
    const steps = [];
    sectors.forEach((sec) => {
      const side = isSide(sec), span = side ? 96 : 60, w = span / sec.count;
      const edges = [-span / 2 + sec.index * w];
      if (sec.index === sec.count - 1) edges.push(span / 2);
      edges.forEach((along) => {
        for (let r = 0; r < ROWS; r++) {
          const out = side ? PW / 2 + GAP_SIDE + r * ROW_D : PL / 2 + GAP_END + r * ROW_D;
          const y = FIRST_H + r * ROW_H + 0.02;
          let x, z;
          if (sec.stand === 'W') { x = along; z = -out; } else if (sec.stand === 'E') { x = -along; z = out; } else if (sec.stand === 'N') { x = out; z = along; } else { x = -out; z = -along; }
          steps.push([x, y, z, side]);
        }
      });
    });
    const stepsMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1.2, 0.06, 0.1), new THREE.MeshStandardMaterial({ color: 0xf2c230, emissive: 0x6b5208, emissiveIntensity: 0.4 }), steps.length);
    steps.forEach(([x, y, z, side], i) => { dummy.position.set(x, y, z); dummy.rotation.set(0, side ? 0 : Math.PI / 2, 0); dummy.updateMatrix(); stepsMesh.setMatrixAt(i, dummy.matrix); });
    scene.add(stepsMesh);

    // борт с рекламой + защитная сетка 1 м перед первым рядом
    const netTex = canvasTex(128, 64, (g, w, h) => {
      g.strokeStyle = 'rgba(235,240,245,.8)'; g.lineWidth = 1.2;
      for (let x = 0; x <= w; x += 8) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
      for (let y = 0; y <= h; y += 8) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    });
    netTex.wrapS = netTex.wrapT = THREE.RepeatWrapping;
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x23272e, roughness: 0.8 });
    const railMat = new THREE.MeshStandardMaterial({ color: 0xdfe3e8, metalness: 0.4, roughness: 0.3 });
    const fence = (len, x, z, rotY) => {
      const g = new THREE.Group();
      const wall = new THREE.Mesh(new THREE.BoxGeometry(len, FIRST_H, 0.25), wallMat); wall.position.y = FIRST_H / 2;
      const t = netTex.clone(); t.needsUpdate = true; t.repeat.set(len / 2, 1);
      const net = new THREE.Mesh(new THREE.PlaneGeometry(len, 1), new THREE.MeshStandardMaterial({ map: t, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
      net.position.y = FIRST_H + 0.5;
      const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.06, 0.06), railMat); rail.position.y = FIRST_H + 1;
      g.add(wall, net, rail); g.position.set(x, 0, z); g.rotation.y = rotY; scene.add(g);
    };
    fence(98, 0, -(PW / 2 + GAP_SIDE - 0.5), 0); fence(98, 0, PW / 2 + GAP_SIDE - 0.5, 0);
    fence(62, PL / 2 + GAP_END - 0.5, 0, Math.PI / 2); fence(62, -(PL / 2 + GAP_END - 0.5), 0, Math.PI / 2);

    // скамейки запасных (технические зоны) у западной бровки
    const benchSeat = new THREE.MeshStandardMaterial({ color: 0xc8202a, roughness: 0.6 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x9fc6ff, transparent: true, opacity: 0.35, roughness: 0.1, side: THREE.DoubleSide });
    [-11, 11].forEach((bx) => {
      const g = new THREE.Group();
      const base = new THREE.Mesh(new THREE.BoxGeometry(9, 0.25, 1.8), wallMat); base.position.y = 0.12;
      const row = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.45, 0.6), benchSeat); row.position.set(0, 0.48, -0.35);
      const backW = new THREE.Mesh(new THREE.BoxGeometry(9, 2.1, 0.08), glass); backW.position.set(0, 1.05, -0.85);
      const roofG = new THREE.Mesh(new THREE.BoxGeometry(9, 0.08, 1.9), glass); roofG.position.set(0, 2.1, 0); roofG.rotation.x = 0.12;
      const sideL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.1, 1.8), glass); sideL.position.set(-4.5, 1.05, 0);
      const sideR = sideL.clone(); sideR.position.x = 4.5;
      g.add(base, row, backW, roofG, sideL, sideR);
      g.position.set(bx, 0, -(PW / 2 + 3)); scene.add(g);
    });

    // крыша-козырёк с белыми фермами
    const ry = FIRST_H + ROWS * ROW_H + 8;
    const outerR = [PL / 2 + GAP_END + DEPTH + 4, PW / 2 + GAP_SIDE + DEPTH + 4, 34];
    const innerR = [PL / 2 + GAP_END + 3, PW / 2 + GAP_SIDE + 2, 16];
    const roof = ring(outerR, innerR, 0.6, new THREE.MeshStandardMaterial({ color: 0x8e8f8c, metalness: 0.3, roughness: 0.7, side: THREE.DoubleSide }));
    roof.position.y = ry; scene.add(roof);
    const fins = new THREE.InstancedMesh(new THREE.BoxGeometry(0.25, 3.4, 0.25), new THREE.MeshStandardMaterial({ color: 0xd8c27a, metalness: 0.4, roughness: 0.5 }), 140);
    for (let i = 0; i < 140; i++) {
      const a = (i / 140) * Math.PI * 2;
      const k = 1 / Math.max(Math.abs(Math.cos(a)) / innerR[0], Math.abs(Math.sin(a)) / innerR[1]);
      dummy.position.set(Math.cos(a) * k, ry + 1.5, Math.sin(a) * k);
      dummy.rotation.set(Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35);
      dummy.updateMatrix(); fins.setMatrixAt(i, dummy.matrix);
    }
    scene.add(fins);
    const lightRing = ring([innerR[0] + 0.6, innerR[1] + 0.6, innerR[2] + 0.6], [innerR[0], innerR[1], innerR[2]], 0.3,
      new THREE.MeshBasicMaterial({ color: el < 6 ? 0xffffff : 0x9a9a96, toneMapped: el >= 6 }));
    lightRing.position.y = ry - 0.35; scene.add(lightRing);

    // жёлтый решётчатый фасад
    const facadeTex = canvasTex(512, 128, (g, w, h) => {
      g.fillStyle = '#2a2620'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#f2c230'; g.lineWidth = 7;
      for (let x = -h; x < w + h; x += 48) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + h, h); g.stroke(); g.beginPath(); g.moveTo(x + h, 0); g.lineTo(x, h); g.stroke(); }
      g.fillStyle = '#f2c230'; g.fillRect(0, h - 10, w, 10); g.fillRect(0, 0, w, 6);
    });
    facadeTex.wrapS = THREE.RepeatWrapping; facadeTex.repeat.set(28, 1);
    const fac = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 128, 1, true), new THREE.MeshStandardMaterial({ map: facadeTex, roughness: 0.7, side: THREE.DoubleSide }));
    fac.scale.set(outerR[0] + 6, ry, outerR[1] + 6); fac.position.y = ry / 2; scene.add(fac);

    // большие LED-экраны на стене в открытых углах между трибунами (как на фото), по диагонали
    const away = (match && match.away) || '';
    const screenTex = canvasTex(1024, 512, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#5a0f3c'); gr.addColorStop(1, '#16091f');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.fillStyle = '#f2c230'; g.fillRect(0, 0, w, 14); g.fillRect(0, h - 14, w, 14);
      g.textAlign = 'center'; g.fillStyle = '#ffffff';
      g.font = 'bold 54px Arial'; g.fillText('ҚАЙСАР АРЕНА', w / 2, 110);
      g.font = 'bold 96px Arial'; g.fillStyle = '#f2c230'; g.fillText('ҚАЙСАР  0 : 0', w / 2, 270);
      g.font = 'bold 60px Arial'; g.fillStyle = '#ffffff'; g.fillText(away.toUpperCase(), w / 2, 360);
      g.font = '40px Arial'; g.fillStyle = '#d9c3ff'; g.fillText(((match && match.time) || '') + '  ·  Премьер-лига', w / 2, 440);
    });
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x1a1b1e, roughness: 0.6 });
    const cx0 = 57.5, cz0 = 40.5; // внутри фасада, между краями трибун
    [[1, 1], [-1, -1]].forEach(([sx, sz]) => {
      const g = new THREE.Group();
      const wall = new THREE.Mesh(new THREE.BoxGeometry(22, FIRST_H + ROWS * ROW_H + 7, 0.6), wallPanel);
      wall.position.set(0, (FIRST_H + ROWS * ROW_H + 7) / 2, -1.2);
      const frame = new THREE.Mesh(new THREE.BoxGeometry(17.2, 9.2, 0.6), frameMat); frame.position.set(0, 12, -0.5);
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(16, 8), new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false }));
      scr.position.set(0, 12, -0.15);
      const sub = new THREE.Mesh(new THREE.BoxGeometry(12, 6.6, 3), wallPanel); sub.position.set(0, 3.3, -0.2);
      const gate = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 3.4), frameMat); gate.position.set(0, 1.7, 1.31);
      g.add(wall, frame, scr, sub, gate);
      g.position.set(sx * cx0, 0, sz * cz0);
      g.lookAt(0, 0, 0);
      scene.add(g);
    });
    return { scene };
  }

  let ctx = null;
  const look = { yaw: 0, pitch: 0, tYaw: 0, tPitch: 0, drag: null };
  function resize() {
    if (!ctx) return;
    const c = ctx.renderer.domElement, w = c.clientWidth, h = c.clientHeight;
    if (!w || !h) return;
    ctx.renderer.setSize(w, h, false); ctx.camera.aspect = w / h; ctx.camera.updateProjectionMatrix();
  }

  function open(canvas, opts) {
    close();
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.9;
    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 2000);
    const built = build(opts.sectors, opts.taken || {}, opts.match);
    ctx = { renderer, camera, ...built, raf: 0 };
    window.addEventListener('resize', resize);
    resize();
    canvas.addEventListener('pointerdown', (e) => { look.drag = { x: e.clientX, y: e.clientY, yaw: look.tYaw, pitch: look.tPitch }; canvas.setPointerCapture(e.pointerId); opts.onDrag && opts.onDrag(); });
    canvas.addEventListener('pointermove', (e) => {
      if (!look.drag) return;
      look.tYaw = clamp(look.drag.yaw - (e.clientX - look.drag.x) * 0.004, -1.3, 1.3);
      look.tPitch = clamp(look.drag.pitch + (e.clientY - look.drag.y) * 0.003, -0.5, 0.45);
    });
    const endDrag = () => { look.drag = null; };
    canvas.addEventListener('pointerup', endDrag); canvas.addEventListener('pointercancel', endDrag);

    const p = seatPos(opts.sector, opts.row, opts.seat);
    const mark = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.48, 0.48), new THREE.MeshStandardMaterial({ color: 0x5fd38d, emissive: 0x1d6b3e, emissiveIntensity: 0.7 }));
    mark.position.set(p.x, p.y + 0.23, p.z); ctx.scene.add(mark);

    const side = isSide(opts.sector);
    const inward = side ? new THREE.Vector3(0, 0, -Math.sign(p.z)) : new THREE.Vector3(-Math.sign(p.x), 0, 0);
    const eye = new THREE.Vector3(p.x, p.y + 1.15, p.z).addScaledVector(inward, 0.2);
    const lookEnd = new THREE.Vector3(side ? p.x * 0.35 : p.x * 0.3, 0, side ? p.z * 0.05 : p.z * 0.35);
    const start = new THREE.Vector3(140, 170, 190);
    const mid = new THREE.Vector3(p.x * 1.5 - inward.x * 30, 55, p.z * 1.5 - inward.z * 30);
    look.yaw = look.tYaw = look.pitch = look.tPitch = 0;
    const dur = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 4200;
    const t0 = performance.now();
    const pos = new THREE.Vector3(), tgt = new THREE.Vector3(), dir = new THREE.Vector3(), center = new THREE.Vector3();
    let arrived = false;
    const frame = (now) => {
      if (!ctx) return;
      const t = clamp((now - t0) / dur, 0, 1), k = ease(t);
      const a = (1 - k) * (1 - k), b = 2 * (1 - k) * k, c = k * k;
      pos.set(a * start.x + b * mid.x + c * eye.x, a * start.y + b * mid.y + c * eye.y, a * start.z + b * mid.z + c * eye.z);
      tgt.lerpVectors(center, lookEnd, k);
      const hFov = ((50 + 22 * k) * Math.PI) / 180;
      camera.fov = clamp((2 * Math.atan(Math.tan(hFov / 2) / camera.aspect)) * 180 / Math.PI, 40, 95);
      camera.updateProjectionMatrix();
      camera.position.copy(pos);
      if (t >= 1) {
        look.yaw += (look.tYaw - look.yaw) * 0.12; look.pitch += (look.tPitch - look.pitch) * 0.12;
        dir.subVectors(lookEnd, eye).normalize();
        const yaw = Math.atan2(dir.x, -dir.z) + look.yaw, pitch = Math.asin(dir.y) + look.pitch;
        tgt.set(eye.x + Math.sin(yaw) * Math.cos(pitch), eye.y + Math.sin(pitch), eye.z - Math.cos(yaw) * Math.cos(pitch));
        if (!arrived) { arrived = true; opts.onArrive && opts.onArrive(); }
      }
      camera.lookAt(tgt);
      renderer.render(ctx.scene, camera);
      ctx.raf = requestAnimationFrame(frame);
    };
    ctx.raf = requestAnimationFrame(frame);
  }
  function close() {
    if (!ctx) return;
    cancelAnimationFrame(ctx.raf);
    window.removeEventListener('resize', resize);
    ctx.scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.map) o.material.map.dispose(); });
    ctx.renderer.dispose(); ctx.renderer.forceContextLoss();
    ctx = null;
  }
  window.Stadium3D = { available: () => typeof window.THREE !== 'undefined', open, close, info, seatPos, addSky, canvasTex };
})();
