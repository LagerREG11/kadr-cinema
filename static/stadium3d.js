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

  // позиция места: sector = {stand, index, count, seats}; row, seat — с 1
  function seatPos(sec, row, seat) {
    const r = row - 1;
    const out = isSide(sec) ? PW / 2 + GAP_SIDE + r * ROW_D : PL / 2 + GAP_END + r * ROW_D;
    const y = FIRST_H + r * ROW_H;
    const span = isSide(sec) ? 96 : 60;
    const w = span / sec.count;
    const along = -span / 2 + sec.index * w + (seat - 0.5) * (w / sec.seats);
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

  function canvasTex(w, h, draw) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.anisotropy = 8; return t;
  }
  function pitchTexture() {
    return canvasTex(1260, 840, (g, W, H) => {
      const sx = W / 120, sy = H / 80;
      for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? '#2f8a3c' : '#36994a'; g.fillRect(i * W / 16, 0, W / 16 + 1, H); }
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

  function build(sectors, takenBySector) {
    const scene = new THREE.Scene();
    scene.background = canvasTex(4, 256, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, '#5d7fb0'); gr.addColorStop(0.55, '#e8b98a'); gr.addColorStop(1, '#f2d2a6');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    });
    scene.fog = new THREE.Fog(0xe8c9a0, 450, 1100);
    scene.add(new THREE.HemisphereLight(0xfff1dc, 0x6b5a44, 0.7));
    const sun = new THREE.DirectionalLight(0xffd7a8, 1.1);
    sun.position.set(-120, 90, -60);
    scene.add(sun);

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), new THREE.MeshStandardMaterial({ color: 0xb59b7a, roughness: 1 }));
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
    const concrete = new THREE.MeshStandardMaterial({ color: 0xa3a3a7, roughness: 0.95 });
    for (let r = 0; r < ROWS; r += 2) {
      const hxI = PL / 2 + GAP_END + r * ROW_D - 0.4, hzI = PW / 2 + GAP_SIDE + r * ROW_D - 0.4;
      const step = ring([hxI + ROW_D * 2, hzI + ROW_D * 2, 18 + r], [hxI, hzI, 16 + r], FIRST_H + r * ROW_H, concrete);
      scene.add(step);
    }
    // задняя стена чаши
    const back = ring([PL / 2 + GAP_END + DEPTH + 1.2, PW / 2 + GAP_SIDE + DEPTH + 1.2, 40], [PL / 2 + GAP_END + DEPTH, PW / 2 + GAP_SIDE + DEPTH, 38], FIRST_H + ROWS * ROW_H + 1.5, concrete);
    scene.add(back);

    // места: одна InstancedMesh на все ~11 000 кресел
    const total = sectors.reduce((s, x) => s + x.rows * x.seats, 0);
    const seats = new THREE.InstancedMesh(new THREE.BoxGeometry(0.46, 0.42, 0.42), new THREE.MeshStandardMaterial({ roughness: 0.6 }), total);
    const dummy = new THREE.Object3D(), col = new THREE.Color();
    let n = 0;
    sectors.forEach((sec) => {
      const taken = new Set(takenBySector[sec.id] || []);
      for (let r = 1; r <= sec.rows; r++) {
        for (let k = 1; k <= sec.seats; k++) {
          const p = seatPos(sec, r, k);
          dummy.position.set(p.x, p.y + 0.21, p.z);
          dummy.lookAt(isSide(sec) ? p.x : 0, p.y + 0.21, isSide(sec) ? 0 : p.z);
          dummy.updateMatrix();
          seats.setMatrixAt(n, dummy.matrix);
          const base = sec.kind === 'vip' ? 0x24345e : sec.kind === 'away' ? 0x7a8292 : ((r * 7 + k * 3) % 11 < 3 ? 0x9aa3ad : 0xd9dde2);
          seats.setColorAt(n, col.set(taken.has(`${r}-${k}`) ? 0x4a4f57 : base));
          n++;
        }
      }
    });
    scene.add(seats);

    // крыша-козырёк с белыми фермами
    const ry = FIRST_H + ROWS * ROW_H + 8;
    const outerR = [PL / 2 + GAP_END + DEPTH + 4, PW / 2 + GAP_SIDE + DEPTH + 4, 34];
    const innerR = [PL / 2 + GAP_END + 3, PW / 2 + GAP_SIDE + 2, 16];
    const roof = ring(outerR, innerR, 0.6, new THREE.MeshStandardMaterial({ color: 0xd9c296, roughness: 0.85, side: THREE.DoubleSide }));
    roof.position.y = ry; scene.add(roof);
    const fins = new THREE.InstancedMesh(new THREE.BoxGeometry(0.25, 3.4, 0.25), new THREE.MeshStandardMaterial({ color: 0xf6f6f2, roughness: 0.5 }), 140);
    for (let i = 0; i < 140; i++) {
      const a = (i / 140) * Math.PI * 2;
      const k = 1 / Math.max(Math.abs(Math.cos(a)) / innerR[0], Math.abs(Math.sin(a)) / innerR[1]);
      dummy.position.set(Math.cos(a) * k, ry + 1.5, Math.sin(a) * k);
      dummy.rotation.set(Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35);
      dummy.updateMatrix(); fins.setMatrixAt(i, dummy.matrix);
    }
    scene.add(fins);

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

    // табло над северной трибуной
    const bx = PL / 2 + GAP_END + DEPTH + 0.5;
    const board = new THREE.Mesh(new THREE.BoxGeometry(1, 6, 18), new THREE.MeshBasicMaterial({ color: 0x0c0d10 }));
    board.position.set(bx, ry - 4, 0); scene.add(board);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(16, 4.6), new THREE.MeshBasicMaterial({ toneMapped: false, map: canvasTex(512, 148, (g, w, h) => {
      g.fillStyle = '#05070a'; g.fillRect(0, 0, w, h); g.fillStyle = '#5fd38d'; g.font = 'bold 56px Arial'; g.textAlign = 'center';
      g.fillText('ҚАЙСАР  0 : 0', w / 2, h / 2 + 20);
    }) }));
    scr.rotation.y = -Math.PI / 2; scr.position.set(bx - 0.55, ry - 4, 0); scene.add(scr);
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
    renderer.toneMappingExposure = 0.85;
    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 2000);
    const built = build(opts.sectors, opts.taken || {});
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
  window.Stadium3D = { available: () => typeof window.THREE !== 'undefined', open, close, info, seatPos };
})();
