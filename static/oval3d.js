/* 3D Центрального стадиона (Алматы): овальная чаша вокруг беговой дорожки, 60 секторов,
   два яруса на Западной и Восточной трибунах, навес над Западной. Схема — по официальной карте секторов. */
(() => {
  'use strict';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const RAD = Math.PI / 180;
  // «стадион» (прямоугольник со скруглёнными торцами): полупрямая L по оси x (север +x), радиус R
  const L = 42.2, TRACK_IN = 36.5, TRACK_OUT = 46.3;
  const LOW = { r0: 50.3, y0: 1.0, d: 0.8, h: 0.42 };
  const UP = { r0: 70.4, y0: 10.5, d: 0.8, h: 0.5 };
  const WALL_R = 84;

  // точка на контуре радиуса R в направлении угла a (0° — север, 90° — восток)
  function onContour(a, R) {
    const dx = Math.cos(a * RAD), dz = Math.sin(a * RAD);
    let lo = 0, hi = R + L + 5;
    for (let i = 0; i < 28; i++) {
      const t = (lo + hi) / 2, x = dx * t, z = dz * t, ex = Math.max(Math.abs(x) - L, 0);
      if (ex * ex + z * z <= R * R) lo = t; else hi = t;
    }
    return { x: dx * lo, z: dz * lo };
  }
  function seatPos(sec, row, seat) {
    const g = sec.tier ? UP : LOW;
    const span = sec.a1 - sec.a0, pad = span * 0.04;
    const a = sec.a0 + pad + ((seat - 0.5) / sec.seats) * (span - 2 * pad);
    const p = onContour(a, g.r0 + (row - 1) * g.d);
    return { x: p.x, y: g.y0 + (row - 1) * g.h, z: p.z };
  }
  // точка на оси поля, к которой «смотрит» кресло (нормаль к контуру)
  const facing = (p) => ({ x: clamp(p.x, -L, L), z: 0 });
  function info(sec, row, seat) {
    const p = seatPos(sec, row, seat);
    const f = facing(p), toEdge = Math.max(1, Math.hypot(p.x - f.x, p.z) - TRACK_OUT);
    return { dist: Math.hypot(p.x, p.z), height: p.y, toEdge, angle: Math.round(Math.atan2(p.y, toEdge) / RAD) };
  }

  function canvasTex(w, h, draw) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.anisotropy = 8; return t;
  }
  function discShape(R) {
    const s = new THREE.Shape();
    s.moveTo(-L, -R); s.lineTo(L, -R); s.absarc(L, 0, R, -Math.PI / 2, Math.PI / 2, false);
    s.lineTo(-L, R); s.absarc(-L, 0, R, Math.PI / 2, Math.PI * 1.5, false);
    return s;
  }
  function ringMesh(rIn, rOut, mat, y) {
    const sh = discShape(rOut); sh.holes.push(discShape(rIn));
    const m = new THREE.Mesh(new THREE.ShapeGeometry(sh, 48), mat);
    m.rotation.x = Math.PI / 2; m.position.y = y; return m;
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
      });
    });
  }
  const COLORS = { yellow: 0xe6b012, green: 0x2a9a55, blue: 0x1f56b5, darkBlue: 0x163f8c, red: 0xa3151f, orange: 0xd9741c };
  function sectorColor(sec) {
    const n = Number(sec.id);
    if (sec.kind === 'vip') return COLORS.red;
    if (sec.kind === 'lodge') return COLORS.orange;
    if (sec.stand === 'W') return sec.tier ? COLORS.yellow : (n % 2 ? COLORS.yellow : COLORS.blue);
    if (sec.stand === 'E') return sec.kind === 'center' ? COLORS.darkBlue : (sec.tier ? COLORS.blue : (n % 2 ? COLORS.green : COLORS.yellow));
    return n % 2 ? COLORS.green : COLORS.yellow;
  }

  function build(sectors, takenBySector, match) {
    const scene = new THREE.Scene();
    const { el } = window.Stadium3D.addSky(scene, match, { lat: 43.24, lon: 76.92 }); // Алматы
    const flood = THREE.MathUtils.lerp(0.25, 0.9, clamp(1 - el / 6, 0, 1));
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
      const sp = new THREE.SpotLight(0xffffff, flood, 300, Math.PI / 3.4, 0.5, 1);
      sp.position.set(sx * 92, 46, sz * 78); sp.target.position.set(sx * 18, 0, sz * 10); scene.add(sp, sp.target);
    });
    const dummy = new THREE.Object3D(), col = new THREE.Color();

    // земля, поле, беговая дорожка
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), new THREE.MeshStandardMaterial({ color: 0x4a5a3a, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.05; scene.add(ground);
    const inner = new THREE.Mesh(new THREE.ShapeGeometry(discShape(TRACK_IN), 48), new THREE.MeshStandardMaterial({ color: 0x23722f, roughness: 1, side: THREE.DoubleSide }));
    inner.rotation.x = Math.PI / 2; inner.position.y = 0.005; scene.add(inner);
    const pitch = new THREE.Mesh(new THREE.PlaneGeometry(120, 80), new THREE.MeshStandardMaterial({ map: pitchTexture(), roughness: 0.95 }));
    pitch.rotation.x = -Math.PI / 2; pitch.position.y = 0.01; scene.add(pitch);
    scene.add(ringMesh(TRACK_IN, TRACK_OUT, new THREE.MeshStandardMaterial({ color: 0x2a5fc4, roughness: 0.9, side: THREE.DoubleSide }), 0.02));
    const laneMat = new THREE.MeshBasicMaterial({ color: 0xf2f4f8, side: THREE.DoubleSide });
    for (let k = 0; k <= 8; k++) { const r = TRACK_IN + k * 1.22; scene.add(ringMesh(r, r + 0.06, laneMat, 0.03)); }
    scene.add(ringMesh(TRACK_OUT, LOW.r0 - 0.4, new THREE.MeshStandardMaterial({ color: 0x9aa3ad, roughness: 0.9, side: THREE.DoubleSide }), 0.02));
    const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
    [-1, 1].forEach((s) => {
      [-3.66, 3.66].forEach((z) => { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.44, 8), white); p.position.set(s * 52.5, 1.22, z); scene.add(p); });
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 7.32, 8), white);
      bar.rotation.x = Math.PI / 2; bar.position.set(s * 52.5, 2.44, 0); scene.add(bar);
    });

    // кресла, ступени-основания, спинки
    const total = sectors.reduce((a, s) => a + s.rows * s.seats, 0);
    const seatMat = new THREE.MeshStandardMaterial({ roughness: 0.55 });
    const seats = new THREE.InstancedMesh(new THREE.BoxGeometry(0.44, 0.07, 0.38), seatMat, total);
    const backs = new THREE.InstancedMesh(new THREE.BoxGeometry(0.44, 0.36, 0.05), seatMat, total);
    const steps = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xb8bcc2, roughness: 0.95 }), total);
    let n = 0;
    sectors.forEach((sec) => {
      const taken = new Set(takenBySector[sec.id] || []);
      const base = sectorColor(sec);
      const g = sec.tier ? UP : LOW;
      for (let r = 1; r <= sec.rows; r++) {
        for (let k = 1; k <= sec.seats; k++) {
          const p = seatPos(sec, r, k), f = facing(p);
          dummy.scale.set(1, 1, 1);
          dummy.position.set(p.x, p.y + 0.42, p.z); dummy.rotation.set(0, 0, 0);
          dummy.lookAt(f.x, p.y + 0.42, f.z); dummy.updateMatrix(); seats.setMatrixAt(n, dummy.matrix);
          dummy.translateZ(-0.17); dummy.translateY(0.2); dummy.rotateX(-0.12); dummy.updateMatrix(); backs.setMatrixAt(n, dummy.matrix);
          const hgt = p.y + 0.02;
          dummy.position.set(p.x, hgt / 2, p.z); dummy.rotation.set(0, 0, 0); dummy.lookAt(f.x, hgt / 2, f.z);
          dummy.translateZ(-0.12); dummy.scale.set(0.62, hgt, g.d + 0.02); dummy.updateMatrix(); steps.setMatrixAt(n, dummy.matrix);
          col.set(taken.has(`${r}-${k}`) ? 0x3d4148 : base); seats.setColorAt(n, col); backs.setColorAt(n, col);
          n++;
        }
      }
    });
    scene.add(steps, seats, backs);

    // парапет перед первым рядом
    const parapet = new THREE.Mesh(new THREE.ExtrudeGeometry((() => { const s = discShape(LOW.r0 - 0.35); s.holes.push(discShape(LOW.r0 - 0.6)); return s; })(), { depth: 1.0, bevelEnabled: false, curveSegments: 48 }),
      new THREE.MeshStandardMaterial({ color: 0xf2f2f0, roughness: 0.8 }));
    parapet.rotation.x = -Math.PI / 2; scene.add(parapet);
    // галерея между ярусами на длинных трибунах
    const concrete = new THREE.MeshStandardMaterial({ color: 0xd9dbde, roughness: 0.9, side: THREE.DoubleSide });
    [-1, 1].forEach((sz) => {
      const gal = new THREE.Mesh(new THREE.BoxGeometry(2 * L + 30, 0.4, 2.6), concrete);
      gal.position.set(0, LOW.y0 + 21 * LOW.h + 0.6, sz * (LOW.r0 + 22 * LOW.d + 0.8)); scene.add(gal);
    });
    // белая наружная стена с рядом окон
    const winTex = canvasTex(1024, 64, (g, w) => {
      g.fillStyle = '#f4f4f2'; g.fillRect(0, 0, w, 64);
      g.fillStyle = '#5d6b78'; for (let x = 6; x < w; x += 22) g.fillRect(x, 20, 10, 26);
    });
    winTex.wrapS = THREE.RepeatWrapping; winTex.repeat.set(10, 1);
    const wall = new THREE.Mesh(new THREE.ExtrudeGeometry((() => { const s = discShape(WALL_R); s.holes.push(discShape(WALL_R - 1.2)); return s; })(), { depth: 9, bevelEnabled: false, curveSegments: 64 }),
      new THREE.MeshStandardMaterial({ color: 0xf1f1ef, roughness: 0.85 }));
    wall.rotation.x = -Math.PI / 2; scene.add(wall);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 96, 1, true), new THREE.MeshStandardMaterial({ map: winTex, roughness: 0.8, side: THREE.DoubleSide }));
    band.scale.set(WALL_R + L + 0.7, 3.2, WALL_R + 0.7); band.position.y = 4.5; scene.add(band);
    scene.add(ringMesh(LOW.r0 + 22 * LOW.d, WALL_R, new THREE.MeshStandardMaterial({ color: 0xa8acb2, roughness: 1, side: THREE.DoubleSide }), 0.01));

    // навес над Западной трибуной: белые фермы и козырёк
    const roofMat = new THREE.MeshStandardMaterial({ color: 0xf4f5f7, roughness: 0.5, side: THREE.DoubleSide, transparent: true, opacity: 0.92 });
    const roof = new THREE.Mesh(new THREE.PlaneGeometry(92, 22), roofMat);
    roof.rotation.x = -Math.PI / 2 + 0.22; roof.position.set(-4, 26, -(UP.r0 + 5)); scene.add(roof);
    const trussMat = new THREE.MeshStandardMaterial({ color: 0xe9ecef, metalness: 0.4, roughness: 0.4 });
    for (let x = -48; x <= 40; x += 8) {
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 24), trussMat); t.rotation.x = 0.22; t.position.set(x, 26.6, -(UP.r0 + 5)); scene.add(t);
      const c2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 26, 0.5), trussMat); c2.position.set(x, 13, -(UP.r0 + 15)); scene.add(c2);
    }
    // мачты освещения
    const mastMat = new THREE.MeshStandardMaterial({ color: 0x6f747a, metalness: 0.5, roughness: 0.5 });
    const lampMat = new THREE.MeshBasicMaterial({ color: el < 8 ? 0xffffff : 0xdfe4ea, toneMapped: el >= 8 });
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 46, 8), mastMat); m.position.set(sx * 92, 23, sz * 78); scene.add(m);
      const panel = new THREE.Mesh(new THREE.BoxGeometry(7, 4, 0.6), lampMat); panel.position.set(sx * 92, 46, sz * 78); panel.lookAt(0, 40, 0); scene.add(panel);
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
    canvas.addEventListener('pointerdown', (e) => { look.drag = { x: e.clientX, y: e.clientY, yaw: look.tYaw, pitch: look.tPitch }; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', (e) => {
      if (!look.drag) return;
      look.tYaw = clamp(look.drag.yaw - (e.clientX - look.drag.x) * 0.004, -1.4, 1.4);
      look.tPitch = clamp(look.drag.pitch + (e.clientY - look.drag.y) * 0.003, -0.5, 0.5);
    });
    const endDrag = () => { look.drag = null; };
    canvas.addEventListener('pointerup', endDrag); canvas.addEventListener('pointercancel', endDrag);

    const p = seatPos(opts.sector, opts.row, opts.seat), f = facing(p);
    const mark = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 0.45), new THREE.MeshStandardMaterial({ color: 0x5fd38d, emissive: 0x1d6b3e, emissiveIntensity: 0.7 }));
    mark.position.set(p.x, p.y + 0.23, p.z); ctx.scene.add(mark);
    const inward = new THREE.Vector3(f.x - p.x, 0, f.z - p.z).normalize();
    const eye = new THREE.Vector3(p.x, p.y + 1.15, p.z).addScaledVector(inward, 0.2);
    const lookEnd = new THREE.Vector3(p.x * 0.3, 0, p.z * 0.15);
    const start = new THREE.Vector3(170, 190, 210), center = new THREE.Vector3();
    const mid = new THREE.Vector3(p.x * 1.5 - inward.x * 30, 60, p.z * 1.5 - inward.z * 30);
    look.yaw = look.tYaw = look.pitch = look.tPitch = 0;
    const dur = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 4200;
    const t0 = performance.now();
    const pos = new THREE.Vector3(), tgt = new THREE.Vector3(), dir = new THREE.Vector3();
    let arrived = false;
    const frame = (now) => {
      if (!ctx) return;
      const t = clamp((now - t0) / dur, 0, 1), k = ease(t);
      const a = (1 - k) * (1 - k), b = 2 * (1 - k) * k, c = k * k;
      pos.set(a * start.x + b * mid.x + c * eye.x, a * start.y + b * mid.y + c * eye.y, a * start.z + b * mid.z + c * eye.z);
      tgt.lerpVectors(center, lookEnd, k);
      const hFov = ((50 + 24 * k) * Math.PI) / 180;
      camera.fov = clamp((2 * Math.atan(Math.tan(hFov / 2) / camera.aspect)) / RAD, 40, 95);
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
  window.Oval3D = { available: () => typeof window.THREE !== 'undefined', open, close, info, seatPos, onContour, L, LOW, UP };
})();
