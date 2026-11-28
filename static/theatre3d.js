/* 3D-зал драмтеатра им. Н. Бекежанова: партер + амфитеатр, сцена с красным занавесом, вид с выбранного места.
   Пропорции и отделка — по панорамам официального 3D-тура театра (схема приблизительная). */
(() => {
  'use strict';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const SW = 0.56;            // ширина кресла
  const HALL_W = 25, BACK_Z = 24.9, CEIL = 11.5;
  const STAGE_H = 1.1, STAGE_FRONT = 0.6, PORTAL_W = 15, PORTAL_H = 8.6;

  // координаты кресла: сцена у z<0, зрители смотрят в сторону -z
  function seatPos(row, seat) {
    const r = row.row;
    let x, y, z;
    if (r <= 10) {
      z = 3.0 + (r - 1) * 0.92; y = 0.06 * (r - 1);
      x = seat <= 16 ? -0.7 - (16 - seat + 0.5) * SW : 0.7 + (seat - 16 - 0.5) * SW;
    } else {
      const i = r - 11, hc = 8 * SW;
      z = 12.88 + i * 0.95; y = 1.0 + i * 0.42;
      if (seat <= 9) x = -(hc + 1.2) - (9 - seat + 0.5) * SW;
      else if (seat <= 25) x = -hc + (seat - 9 - 0.5) * SW;
      else x = hc + 1.2 + (seat - 25 - 0.5) * SW;
    }
    return { x, y, z };
  }
  function info(row, seat) {
    const p = seatPos(row, seat);
    const eyeY = p.y + 1.25;
    return {
      dist: Math.hypot(p.x, p.z - STAGE_FRONT),
      height: eyeY - STAGE_H,
      angle: Math.round(Math.atan2(Math.abs(p.x), p.z + 4) * 180 / Math.PI),
    };
  }

  function canvasTex(w, h, draw) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.anisotropy = 8; return t;
  }
  // белые рельефные панели стен (чешуйчатый узор, как в зале)
  function wallTex(rx, ry) {
    const t = canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#ecebe7'; g.fillRect(0, 0, w, h);
      const s = 32;
      for (let y = 0; y < h + s; y += s / 2) {
        for (let x = ((y / (s / 2)) % 2) * (s / 2) - s; x < w + s; x += s) {
          const gr = g.createLinearGradient(x, y - s / 2, x, y + s / 2);
          gr.addColorStop(0, '#f8f7f4'); gr.addColorStop(0.6, '#e2e0db'); gr.addColorStop(1, '#cfccc6');
          g.fillStyle = gr; g.beginPath();
          g.moveTo(x, y - s / 2); g.lineTo(x + s / 2, y); g.lineTo(x, y + s / 2); g.lineTo(x - s / 2, y); g.closePath(); g.fill();
        }
      }
    });
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); return t;
  }
  function carpetTex(base, border) {
    return canvasTex(64, 512, (g, w, h) => {
      g.fillStyle = base; g.fillRect(0, 0, w, h);
      g.fillStyle = border; g.fillRect(0, 0, 8, h); g.fillRect(w - 8, 0, 8, h);
      g.strokeStyle = border; g.lineWidth = 2;
      for (let y = 0; y < h; y += 24) { g.beginPath(); g.arc(w / 2, y, 7, 0, Math.PI * 2); g.stroke(); }
    });
  }
  // декорация: небо, облака, цветы, казахский орнамент
  function backdropTex() {
    return canvasTex(1024, 512, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, '#2c6fd6'); gr.addColorStop(0.65, '#9fd0ff'); gr.addColorStop(1, '#f7e6ff');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(255,255,255,.9)';
      [[160, 120, 70], [420, 80, 90], [760, 140, 80], [900, 60, 50]].forEach(([x, y, r]) => {
        for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(x + i * r * 0.45 - r, y + Math.sin(i) * 12, r * 0.55, 0, Math.PI * 2); g.fill(); }
      });
      for (let i = 0; i < 70; i++) {
        const x = Math.random() * w, y = h - 20 - Math.random() * 120, r = 8 + Math.random() * 18;
        g.fillStyle = ['#e8336d', '#ff6f91', '#c2185b', '#ff8fb1'][i % 4];
        for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(x + Math.cos(k * 1.256) * r * 0.6, y + Math.sin(k * 1.256) * r * 0.6, r * 0.5, 0, Math.PI * 2); g.fill(); }
      }
      g.strokeStyle = '#f2c230'; g.lineWidth = 10;
      for (let x = 0; x < w; x += 64) { g.beginPath(); g.moveTo(x, h - 6); g.quadraticCurveTo(x + 16, h - 34, x + 32, h - 6); g.quadraticCurveTo(x + 48, h - 34, x + 64, h - 6); g.stroke(); }
    });
  }

  function build(rows, taken) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1612);
    const dummy = new THREE.Object3D();
    const col = new THREE.Color();

    scene.add(new THREE.HemisphereLight(0xfff4e6, 0x3a2a26, 0.55));
    scene.add(new THREE.AmbientLight(0xffffff, 0.12));
    [[-6, 6], [6, 6], [-6, 16], [6, 16]].forEach(([x, z]) => { const l = new THREE.PointLight(0xfff0dc, 0.45, 26, 1.6); l.position.set(x, CEIL - 0.8, z); scene.add(l); });
    // театральные прожекторы на сцену
    [[-7, 9, 8], [7, 9, 8], [0, 10, 14]].forEach(([x, y, z]) => {
      const s = new THREE.SpotLight(0xfff2d8, 0.8, 50, Math.PI / 7, 0.6, 1);
      s.position.set(x, y, z); s.target.position.set(x * 0.2, STAGE_H, -4); scene.add(s, s.target);
    });

    // --- пол и ступени ---
    const pinkCarpet = new THREE.MeshStandardMaterial({ color: 0xa0567c, roughness: 1 });
    const redCarpet = new THREE.MeshStandardMaterial({ color: 0x9c1c24, roughness: 1 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(HALL_W, 40), pinkCarpet);
    floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, 10); scene.add(floor);
    rows.forEach((row) => {
      const p = seatPos(row, 1), depth = row.row <= 10 ? 0.92 : 0.95;
      if (p.y < 0.03) return;
      const b = new THREE.Mesh(new THREE.BoxGeometry(HALL_W, p.y, depth), row.row <= 10 ? pinkCarpet : redCarpet);
      b.position.set(0, p.y / 2, p.z + 0.12); scene.add(b);
    });
    // проход-ковры с орнаментом
    const aisleMat = new THREE.MeshStandardMaterial({ map: carpetTex('#b3212b', '#e9d9b0'), roughness: 1 });
    const aisle = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 9.5), aisleMat);
    aisle.rotation.x = -Math.PI / 2 + 0.065; aisle.position.set(0, 0.3, 7.2); scene.add(aisle);
    [-1, 1].forEach((sg) => {
      const side = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 11), aisleMat);
      side.rotation.x = -Math.PI / 2; side.position.set(sg * 11.4, 0.02, 7.6); scene.add(side);
    });
    // светлые кромки ступеней в проходах амфитеатра
    const stepEdge = new THREE.MeshStandardMaterial({ color: 0xe8d9a8, roughness: 0.6 });
    const hc = 8 * SW;
    for (let i = 0; i < 12; i++) {
      const y = 1.0 + i * 0.42, z = 12.88 + i * 0.95 - 0.35;
      [-(hc + 0.6), hc + 0.6].forEach((x) => { const e = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.03, 0.08), stepEdge); e.position.set(x, y + 0.02, z); scene.add(e); });
    }
    // парапет перед амфитеатром
    const parapet = new THREE.Mesh(new THREE.BoxGeometry(HALL_W, 1.05, 0.15), new THREE.MeshStandardMaterial({ color: 0xe6e1d8, roughness: 0.8 }));
    parapet.position.set(0, 0.52, 12.2); scene.add(parapet);

    // --- стены и потолок ---
    const wallMat = new THREE.MeshStandardMaterial({ map: wallTex(6, 3), roughness: 0.9 });
    const plain = new THREE.MeshStandardMaterial({ color: 0xeeebe5, roughness: 0.85 });
    const wood = new THREE.MeshStandardMaterial({ color: 0x7a4a2a, roughness: 0.6 });
    [-1, 1].forEach((sg) => {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(26, CEIL - 2.6), wallMat);
      w.position.set(sg * HALL_W / 2, 2.6 + (CEIL - 2.6) / 2, 12); w.rotation.y = -sg * Math.PI / 2; scene.add(w);
      const low = new THREE.Mesh(new THREE.PlaneGeometry(26, 2.6), plain);
      low.position.set(sg * HALL_W / 2, 1.3, 12); low.rotation.y = -sg * Math.PI / 2; scene.add(low);
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.15, 26), wood); base.position.set(sg * (HALL_W / 2 - 0.03), 0.08, 12); scene.add(base);
      [5, 12.5].forEach((z) => { // двери и табличка выхода
        const y0 = z > 10 ? 1.1 : 0;
        const d = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.3, 1.4), wood); d.position.set(sg * (HALL_W / 2 - 0.04), y0 + 1.15, z); scene.add(d);
        const ex = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.25), new THREE.MeshBasicMaterial({ color: 0xd8262e, toneMapped: false }));
        ex.position.set(sg * (HALL_W / 2 - 0.05), y0 + 2.6, z); ex.rotation.y = -sg * Math.PI / 2; scene.add(ex);
      });
    });
    const back = new THREE.Mesh(new THREE.PlaneGeometry(HALL_W, CEIL), wallMat);
    back.position.set(0, CEIL / 2, BACK_Z); back.rotation.y = Math.PI; scene.add(back);
    // окна кинопроекционной / осветительской
    for (let i = 0; i < 6; i++) {
      const x = -6.25 + i * 2.5;
      const win = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.75), new THREE.MeshBasicMaterial({ color: i === 2 || i === 3 ? 0x8fd0ff : 0x2a3340, toneMapped: false }));
      win.position.set(x, 8.6, BACK_Z - 0.02); win.rotation.y = Math.PI; scene.add(win);
    }
    [-(hc + 0.6), hc + 0.6].forEach((x) => { // выходы наверху амфитеатра
      const d = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 2.2), wood); d.position.set(x, 6.1 + 1.1, BACK_Z - 0.03); d.rotation.y = Math.PI; scene.add(d);
    });
    // потолок с кессонами и точечными светильниками
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(HALL_W, 26), new THREE.MeshStandardMaterial({ color: 0xe9e7e2, roughness: 0.95 }));
    ceil.rotation.x = Math.PI / 2; ceil.position.set(0, CEIL, 12); scene.add(ceil);
    const beamMat = new THREE.MeshStandardMaterial({ color: 0xf4f2ee, roughness: 0.8 });
    for (let z = 0; z <= 13; z += 3.2) { const b = new THREE.Mesh(new THREE.BoxGeometry(HALL_W, 0.45, 0.35), beamMat); b.position.set(0, CEIL - 0.22, z); scene.add(b); }
    [-6, 0, 6].forEach((x) => { const b = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.45, 13.5), beamMat); b.position.set(x, CEIL - 0.22, 6.5); scene.add(b); });
    const dl = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, side: THREE.DoubleSide });
    const discs = new THREE.InstancedMesh(new THREE.CircleGeometry(0.16, 16), dl, 60);
    let di = 0;
    for (let z = 1.6; z < 13; z += 3.2) for (let x = -10.5; x <= 10.5; x += 3) {
      if (di >= 60) break;
      dummy.position.set(x, CEIL - 0.01, z); dummy.rotation.set(Math.PI / 2, 0, 0); dummy.updateMatrix(); discs.setMatrixAt(di++, dummy.matrix);
    }
    discs.count = di; scene.add(discs);
    // хрустальные люстры над амфитеатром
    const glowTex = canvasTex(128, 128, (g, w) => {
      const gr = g.createRadialGradient(w / 2, w / 2, 4, w / 2, w / 2, w / 2);
      gr.addColorStop(0, 'rgba(255,248,225,1)'); gr.addColorStop(0.35, 'rgba(255,236,190,.55)'); gr.addColorStop(1, 'rgba(255,220,160,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, w);
    });
    const crystal = new THREE.MeshStandardMaterial({ color: 0xfff6e0, emissive: 0xfff0c8, emissiveIntensity: 0.9, roughness: 0.2, metalness: 0.3, side: THREE.DoubleSide });
    [[-3.2, 16], [3.2, 16], [-3.2, 20.5], [3.2, 20.5]].forEach(([x, z]) => {
      const g = new THREE.Group();
      for (let t = 0; t < 4; t++) {
        const tier = new THREE.Mesh(new THREE.CylinderGeometry(0.25 + t * 0.18, 0.35 + t * 0.18, 0.28, 18, 1, true), crystal);
        tier.position.y = -t * 0.32; g.add(tier);
      }
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.2, 6), crystal); rod.position.y = 0.7; g.add(rod);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, toneMapped: false }));
      glow.scale.set(3.2, 3.2, 1); glow.position.y = -0.5; g.add(glow);
      g.position.set(x, CEIL - 1.6, z); scene.add(g);
      const l = new THREE.PointLight(0xffe7b8, 0.35, 14, 1.8); l.position.set(x, CEIL - 2.4, z); scene.add(l);
    });

    // --- сцена ---
    const stageFloor = new THREE.Mesh(new THREE.BoxGeometry(PORTAL_W + 1, STAGE_H, 12), new THREE.MeshStandardMaterial({ color: 0x111215, roughness: 0.25, metalness: 0.2 }));
    stageFloor.position.set(0, STAGE_H / 2, STAGE_FRONT - 6); scene.add(stageFloor);
    const front = new THREE.Mesh(new THREE.PlaneGeometry(PORTAL_W + 1, STAGE_H), new THREE.MeshStandardMaterial({ color: 0x8e1820, roughness: 0.9 }));
    front.position.set(0, STAGE_H / 2, STAGE_FRONT + 0.01); scene.add(front);
    [-1, 1].forEach((sg) => { // боковые лесенки на сцену
      for (let k = 0; k < 4; k++) {
        const st = new THREE.Mesh(new THREE.BoxGeometry(1.2, (k + 1) * STAGE_H / 4, 0.3), plain);
        st.position.set(sg * (PORTAL_W / 2 + 1.2), (k + 1) * STAGE_H / 8, STAGE_FRONT + 1.05 - k * 0.3); scene.add(st);
      }
    });
    // портал
    const portalMat = new THREE.MeshStandardMaterial({ color: 0xf1efea, roughness: 0.85 });
    const sideW = (HALL_W - PORTAL_W) / 2;
    const speakerMat = new THREE.MeshStandardMaterial({ color: 0x1b1c20, roughness: 0.5 });
    [-1, 1].forEach((sg) => {
      const p = new THREE.Mesh(new THREE.BoxGeometry(sideW, CEIL, 0.6), portalMat);
      p.position.set(sg * (PORTAL_W / 2 + sideW / 2), CEIL / 2, -0.3); scene.add(p);
      // линейные массивы колонок
      const arr = new THREE.Group();
      for (let k = 0; k < 6; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.32, 0.55), speakerMat); b.position.y = -k * 0.33; b.rotation.x = k * 0.05; arr.add(b); }
      arr.position.set(sg * (PORTAL_W / 2 + 0.6), 9.6, 0.6); scene.add(arr);
    });
    const top = new THREE.Mesh(new THREE.BoxGeometry(PORTAL_W, CEIL - PORTAL_H, 0.6), portalMat);
    top.position.set(0, PORTAL_H + (CEIL - PORTAL_H) / 2, -0.3); scene.add(top);
    const black = new THREE.MeshStandardMaterial({ color: 0x0c0c0f, roughness: 1, side: THREE.DoubleSide });
    const pelmet = new THREE.Mesh(new THREE.BoxGeometry(PORTAL_W, 0.9, 0.1), black); pelmet.position.set(0, PORTAL_H - 0.45, -0.7); scene.add(pelmet);
    // красный падуг-занавес с драпировкой
    const velvet = canvasTex(512, 256, (g, w, h) => {
      for (let x = 0; x < w; x++) {
        const v = 0.62 + 0.38 * Math.sin(x * 0.18) * Math.sin(x * 0.05 + 1);
        g.fillStyle = `rgb(${Math.round(70 + 60 * v)},${Math.round(4 + 8 * v)},${Math.round(10 + 12 * v)})`; g.fillRect(x, 0, 1, h);
      }
      g.fillStyle = '#d4a63a';
      for (let x = 10; x < w; x += 42) g.fillRect(x, h - 26, 3, 22);
    });
    const valance = new THREE.Mesh(new THREE.PlaneGeometry(PORTAL_W - 0.4, 2.4), new THREE.MeshStandardMaterial({ map: velvet, roughness: 1, side: THREE.DoubleSide }));
    valance.position.set(0, PORTAL_H - 2.0, -0.9); scene.add(valance);
    // чёрные кулисы с цветными полосами
    const wingTex = canvasTex(128, 512, (g, w, h) => {
      g.fillStyle = '#0d0d10'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 9; i++) { g.fillStyle = ['#3ee07a', '#ff7a2f', '#e8e8e8', '#ff3d6a'][i % 4]; g.fillRect(8 + i * 13, 40 + (i * 53) % 260, 3, 120 + (i * 37) % 140); }
    });
    [-1, 1].forEach((sg) => {
      [-2.5, -5.5].forEach((z, k) => {
        const wg = new THREE.Mesh(new THREE.PlaneGeometry(2.2, PORTAL_H - 1), new THREE.MeshStandardMaterial({ map: wingTex, roughness: 1, side: THREE.DoubleSide }));
        wg.position.set(sg * (PORTAL_W / 2 - 1.2 - k * 0.4), STAGE_H + (PORTAL_H - 1) / 2, z); scene.add(wg);
      });
      // жёлтые станки-декорации
      const flat = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.6, 0.08), new THREE.MeshStandardMaterial({ color: 0xf2c230, roughness: 0.7 }));
      flat.position.set(sg * 4.6, STAGE_H + 1.3, -3.4); flat.rotation.y = sg * 0.15; scene.add(flat);
    });
    const bd = new THREE.Mesh(new THREE.PlaneGeometry(PORTAL_W - 2, PORTAL_H - 1.6), new THREE.MeshBasicMaterial({ map: backdropTex(), toneMapped: false }));
    bd.position.set(0, STAGE_H + (PORTAL_H - 1.6) / 2, -9); scene.add(bd);
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(PORTAL_W + 2, CEIL), black); sky.position.set(0, CEIL / 2, -11.5); scene.add(sky);
    // софиты над сценой
    for (let k = 0; k < 6; k++) {
      const f = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.35, 10), black);
      f.rotation.x = 1.1; f.position.set(-3.75 + k * 1.5, PORTAL_H - 0.2, -1.4); scene.add(f);
    }

    // --- кресла: красная обивка, деревянные подлокотники ---
    const total = rows.reduce((a, r) => a + r.seats, 0);
    const redMat = new THREE.MeshStandardMaterial({ roughness: 0.75 });
    const cushions = new THREE.InstancedMesh(new THREE.BoxGeometry(0.48, 0.12, 0.46), redMat, total);
    const backs = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.54, 0.09), redMat, total);
    const darkWood = new THREE.MeshStandardMaterial({ color: 0x4a2a18, roughness: 0.55 });
    const arms = new THREE.InstancedMesh(new THREE.BoxGeometry(0.05, 0.06, 0.46), darkWood, total * 2);
    const frames = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.03, 0.05), darkWood, total);
    let n = 0;
    rows.forEach((row) => {
      for (let k = 1; k <= row.seats; k++) {
        const p = seatPos(row, k);
        dummy.rotation.set(0, 0, 0);
        dummy.position.set(p.x, p.y + 0.44, p.z); dummy.updateMatrix(); cushions.setMatrixAt(n, dummy.matrix);
        dummy.position.set(p.x, p.y + 0.78, p.z + 0.26); dummy.rotation.x = -0.12; dummy.updateMatrix(); backs.setMatrixAt(n, dummy.matrix);
        dummy.rotation.set(0, 0, 0);
        dummy.position.set(p.x, p.y + 1.06, p.z + 0.29); dummy.updateMatrix(); frames.setMatrixAt(n, dummy.matrix);
        [-1, 1].forEach((sg, j) => { dummy.position.set(p.x + sg * 0.265, p.y + 0.66, p.z + 0.02); dummy.updateMatrix(); arms.setMatrixAt(n * 2 + j, dummy.matrix); });
        col.set(taken.has(`${row.row}-${k}`) ? 0x3a2a2c : 0xa3101c);
        cushions.setColorAt(n, col); backs.setColorAt(n, col);
        n++;
      }
    });
    scene.add(cushions, backs, arms, frames);
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
    renderer.toneMappingExposure = 1.0;
    const camera = new THREE.PerspectiveCamera(60, 1, 0.05, 200);
    const built = build(opts.rows, new Set(opts.taken || []));
    ctx = { renderer, camera, ...built, raf: 0 };
    window.addEventListener('resize', resize);
    resize();
    canvas.addEventListener('pointerdown', (e) => { look.drag = { x: e.clientX, y: e.clientY, yaw: look.tYaw, pitch: look.tPitch }; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', (e) => {
      if (!look.drag) return;
      look.tYaw = clamp(look.drag.yaw - (e.clientX - look.drag.x) * 0.004, -1.6, 1.6);
      look.tPitch = clamp(look.drag.pitch + (e.clientY - look.drag.y) * 0.003, -0.6, 0.7);
    });
    const endDrag = () => { look.drag = null; };
    canvas.addEventListener('pointerup', endDrag); canvas.addEventListener('pointercancel', endDrag);

    const row = opts.rows.find((r) => r.row === opts.row);
    const p = seatPos(row, opts.seat);
    const mark = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.48), new THREE.MeshStandardMaterial({ color: 0x5fd38d, emissive: 0x1d6b3e, emissiveIntensity: 0.8 }));
    mark.position.set(p.x, p.y + 0.45, p.z); ctx.scene.add(mark);

    const eye = new THREE.Vector3(p.x, p.y + 1.25, p.z + 0.05);
    const lookEnd = new THREE.Vector3(p.x * 0.15, STAGE_H + 2.2, -4.5);
    const start = new THREE.Vector3(0, 5.5, -3), center = new THREE.Vector3(0, 3, 20);
    const mid = new THREE.Vector3(p.x * 0.6, 7.5, p.z * 0.6);
    look.yaw = look.tYaw = look.pitch = look.tPitch = 0;
    const dur = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 3800;
    const t0 = performance.now();
    const pos = new THREE.Vector3(), tgt = new THREE.Vector3(), dir = new THREE.Vector3();
    let arrived = false;
    const frame = (now) => {
      if (!ctx) return;
      const t = clamp((now - t0) / dur, 0, 1), k = ease(t);
      const a = (1 - k) * (1 - k), b = 2 * (1 - k) * k, c = k * k;
      pos.set(a * start.x + b * mid.x + c * eye.x, a * start.y + b * mid.y + c * eye.y, a * start.z + b * mid.z + c * eye.z);
      tgt.lerpVectors(center, lookEnd, k);
      const hFov = ((60 + 20 * k) * Math.PI) / 180;
      camera.fov = clamp((2 * Math.atan(Math.tan(hFov / 2) / camera.aspect)) * 180 / Math.PI, 45, 95);
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
  window.Theatre3D = { available: () => typeof window.THREE !== 'undefined', open, close, info, seatPos };
})();
