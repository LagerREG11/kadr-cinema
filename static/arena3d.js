/* 3D Almaty Arena: ледовая площадка 60×30, нижний ярус (A1–A4, B1–B10), ложи, верхний ярус (C1–C13),
   стальная ферменная крыша с синей подсветкой и медиакуб над льдом. Схема — по официальной карте секторов. */
(() => {
  'use strict';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const RAD = Math.PI / 180;
  // контур чаши (как в stadium.py): прямоугольник со скруглёнными углами
  const HX = 33, HZ = 18, R = 11;
  const LOW = { off: 0, d: 0.85, y0: 1.3, h: 0.45 };
  const UP = { off: 17.5, d: 0.85, y0: 12.0, h: 0.55 };
  const ROOF_Y = 30;

  function onContour(a, off) {
    const dx = Math.cos(a * RAD), dz = Math.sin(a * RAD);
    const hx = HX + off, hz = HZ + off, r = R + off;
    let lo = 0, hi = hx + hz + 10;
    for (let i = 0; i < 28; i++) {
      const t = (lo + hi) / 2;
      const ex = Math.max(Math.abs(dx * t) - (hx - r), 0), ez = Math.max(Math.abs(dz * t) - (hz - r), 0);
      if (ex * ex + ez * ez <= r * r) lo = t; else hi = t;
    }
    return { x: dx * lo, z: dz * lo };
  }
  function seatPos(sec, row, seat) {
    const g = sec.tier ? UP : LOW;
    const span = sec.a1 - sec.a0, pad = span * 0.035;
    const a = sec.a0 + pad + ((seat - 0.5) / sec.seats) * (span - 2 * pad);
    const p = onContour(a, g.off + (row - 1) * g.d);
    return { x: p.x, y: g.y0 + (row - 1) * g.h, z: p.z };
  }
  // кресло смотрит на ближайшую точку «оси» площадки
  const facing = (p) => ({ x: clamp(p.x, -(HX - R), HX - R), z: clamp(p.z, -(HZ - R), HZ - R) });
  function info(sec, row, seat) {
    const p = seatPos(sec, row, seat), f = facing(p);
    const toEdge = Math.max(1, Math.hypot(p.x - f.x, p.z - f.z) - (R - 3));
    return { dist: Math.hypot(p.x, p.z), height: p.y, toEdge, angle: Math.round(Math.atan2(p.y, toEdge) / RAD) };
  }

  function canvasTex(w, h, draw) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.anisotropy = 8; return t;
  }
  function rrect(hx, hz, r) {
    const s = new THREE.Shape();
    s.moveTo(-hx + r, -hz); s.lineTo(hx - r, -hz); s.absarc(hx - r, -hz + r, r, -Math.PI / 2, 0, false);
    s.lineTo(hx, hz - r); s.absarc(hx - r, hz - r, r, 0, Math.PI / 2, false);
    s.lineTo(-hx + r, hz); s.absarc(-hx + r, hz - r, r, Math.PI / 2, Math.PI, false);
    s.lineTo(-hx, -hz + r); s.absarc(-hx + r, -hz + r, r, Math.PI, Math.PI * 1.5, false);
    return s;
  }
  function ringWall(hx, hz, r, th, h, mat, y = 0) {
    const sh = rrect(hx + th, hz + th, r + th); sh.holes.push(rrect(hx, hz, r));
    const m = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: h, bevelEnabled: false, curveSegments: 24 }), mat);
    m.rotation.x = -Math.PI / 2; m.position.y = y; return m;
  }
  // лёд с разметкой хоккейной площадки
  function iceTexture() {
    return canvasTex(1200, 600, (g, W, H) => {
      const k = W / 60;
      g.fillStyle = '#f4f8fb'; g.fillRect(0, 0, W, H);
      const X = (m) => (m + 30) * k, Y = (m) => (m + 15) * k;
      g.fillStyle = '#c8202c'; g.fillRect(X(-0.15), 0, 0.3 * k, H);
      g.fillStyle = '#1f56b5'; g.fillRect(X(-8.9), 0, 0.3 * k, H); g.fillRect(X(8.6), 0, 0.3 * k, H);
      g.strokeStyle = '#c8202c'; g.lineWidth = 3;
      [-26, 26].forEach((x) => { g.beginPath(); g.moveTo(X(x), Y(-13)); g.lineTo(X(x), Y(13)); g.stroke(); });
      g.strokeStyle = '#1f56b5'; g.beginPath(); g.arc(X(0), Y(0), 4.5 * k, 0, Math.PI * 2); g.stroke();
      g.strokeStyle = '#c8202c'; g.fillStyle = '#c8202c';
      [[-20, -7], [-20, 7], [20, -7], [20, 7]].forEach(([x, z]) => { g.beginPath(); g.arc(X(x), Y(z), 4.5 * k, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.arc(X(x), Y(z), 0.3 * k, 0, Math.PI * 2); g.fill(); });
      [[-6, -7], [-6, 7], [6, -7], [6, 7]].forEach(([x, z]) => { g.beginPath(); g.arc(X(x), Y(z), 0.3 * k, 0, Math.PI * 2); g.fill(); });
      g.fillStyle = 'rgba(70,140,230,.35)';
      [-26, 26].forEach((x) => { g.beginPath(); g.arc(X(x), Y(0), 1.8 * k, x < 0 ? -Math.PI / 2 : Math.PI / 2, x < 0 ? Math.PI / 2 : Math.PI * 1.5); g.fill(); });
    });
  }

  function build(sectors, takenBySector) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x05070d);
    scene.fog = new THREE.Fog(0x05070d, 120, 260);
    scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x1a1c24, 0.55));
    [[-18, -8], [18, -8], [-18, 8], [18, 8], [0, 0]].forEach(([x, z]) => {
      const s = new THREE.SpotLight(0xffffff, 0.75, 80, Math.PI / 4, 0.6, 1);
      s.position.set(x, ROOF_Y - 4, z); s.target.position.set(x * 0.8, 0, z * 0.8); scene.add(s, s.target);
    });
    [[-40, 0], [40, 0], [0, -30], [0, 30]].forEach(([x, z]) => { const l = new THREE.PointLight(0xbfd3ff, 0.35, 70, 1.6); l.position.set(x, 22, z); scene.add(l); });
    const dummy = new THREE.Object3D(), col = new THREE.Color();

    // пол, лёд, борта, стекло
    const floor = new THREE.Mesh(new THREE.ShapeGeometry(rrect(HX + 40, HZ + 40, R + 40), 24), new THREE.MeshStandardMaterial({ color: 0x1b1d22, roughness: 0.9, side: THREE.DoubleSide }));
    floor.rotation.x = Math.PI / 2; floor.position.y = -0.02; scene.add(floor);
    const iceGeo = new THREE.ShapeGeometry(rrect(30, 15, 8.5), 24);
    const pos = iceGeo.attributes.position, uv = iceGeo.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + 30) / 60, (pos.getY(i) + 15) / 30);
    const ice = new THREE.Mesh(iceGeo, new THREE.MeshStandardMaterial({ map: iceTexture(), roughness: 0.15, metalness: 0.05, side: THREE.DoubleSide }));
    ice.rotation.x = Math.PI / 2; ice.position.y = 0.01; scene.add(ice);
    scene.add(ringWall(30, 15, 8.5, 0.2, 1.07, new THREE.MeshStandardMaterial({ color: 0xf2f4f6, roughness: 0.5 })));
    scene.add(ringWall(30, 15, 8.5, 0.22, 0.2, new THREE.MeshStandardMaterial({ color: 0xf2c230, roughness: 0.6 })));
    scene.add(ringWall(30.05, 15.05, 8.55, 0.05, 1.8, new THREE.MeshStandardMaterial({ color: 0xcfe6ff, transparent: true, opacity: 0.18, roughness: 0.05, depthWrite: false }), 1.07));
    // скамейки команд и штрафные боксы у борта
    const benchMat = new THREE.MeshStandardMaterial({ color: 0x2b3442, roughness: 0.7 });
    [-9, 9].forEach((x) => { const b = new THREE.Mesh(new THREE.BoxGeometry(8, 1.1, 1.6), benchMat); b.position.set(x, 0.55, -16.2); scene.add(b); });
    [-3, 3].forEach((x) => { const b = new THREE.Mesh(new THREE.BoxGeometry(3, 1.1, 1.6), benchMat); b.position.set(x, 0.55, 16.2); scene.add(b); });
    // ворота
    [-26, 26].forEach((x) => {
      const goal = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.22, 1.83), new THREE.MeshStandardMaterial({ color: 0xd8262e, wireframe: true }));
      goal.position.set(x + (x < 0 ? -0.55 : 0.55), 0.61, 0); scene.add(goal);
    });

    // кресла: сине-жёлтые с диагональными полосами (как на фото), ступени под ними
    const total = sectors.reduce((a, s) => a + s.rows * s.seats, 0);
    const seatMat = new THREE.MeshStandardMaterial({ roughness: 0.5 });
    const seats = new THREE.InstancedMesh(new THREE.BoxGeometry(0.48, 0.08, 0.42), seatMat, total);
    const backs = new THREE.InstancedMesh(new THREE.BoxGeometry(0.48, 0.42, 0.06), seatMat, total);
    const steps = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x3a3e46, roughness: 0.9 }), total);
    let n = 0;
    sectors.forEach((sec, si) => {
      const taken = new Set(takenBySector[sec.id] || []);
      const g = sec.tier ? UP : LOW;
      for (let r = 1; r <= sec.rows; r++) {
        for (let k = 1; k <= sec.seats; k++) {
          const p = seatPos(sec, r, k), f = facing(p);
          dummy.scale.set(1, 1, 1);
          dummy.position.set(p.x, p.y + 0.44, p.z); dummy.rotation.set(0, 0, 0);
          dummy.lookAt(f.x, p.y + 0.44, f.z); dummy.updateMatrix(); seats.setMatrixAt(n, dummy.matrix);
          dummy.translateZ(-0.19); dummy.translateY(0.22); dummy.rotateX(-0.1); dummy.updateMatrix(); backs.setMatrixAt(n, dummy.matrix);
          const hgt = p.y + 0.02;
          dummy.position.set(p.x, hgt / 2, p.z); dummy.rotation.set(0, 0, 0); dummy.lookAt(f.x, hgt / 2, f.z);
          dummy.translateZ(-0.12); dummy.scale.set(0.6, hgt, g.d + 0.02); dummy.updateMatrix(); steps.setMatrixAt(n, dummy.matrix);
          const band = (r * 1.0 + k * 0.45 + si * 5) % 11;
          const base = band < 2.2 ? 0xe6b012 : band < 2.8 ? 0xe8761c : 0x1f56b5;
          col.set(taken.has(`${r}-${k}`) ? 0x3a3e46 : base); seats.setColorAt(n, col); backs.setColorAt(n, col);
          n++;
        }
      }
    });
    scene.add(steps, seats, backs);

    // парапет перед первым рядом и ложи между ярусами
    scene.add(ringWall(HX - 0.6, HZ - 0.6, R - 0.6, 0.25, 1.2, new THREE.MeshStandardMaterial({ color: 0x8e1c24, roughness: 0.7 })));
    const lowTop = LOW.y0 + 14 * LOW.h;
    const boxOff = LOW.off + 15 * LOW.d + 0.3;
    scene.add(ringWall(HX + boxOff, HZ + boxOff, R + boxOff, 2.6, lowTop + 0.4, new THREE.MeshStandardMaterial({ color: 0x2a2e36, roughness: 0.8 })));
    const glassTex = canvasTex(1024, 64, (g, w) => {
      g.fillStyle = '#0d1a33'; g.fillRect(0, 0, w, 64);
      for (let x = 0; x < w; x += 32) { g.fillStyle = (x / 32) % 3 ? '#ffd28a' : '#3a5d9a'; g.fillRect(x + 3, 10, 26, 44); }
    });
    glassTex.wrapS = THREE.RepeatWrapping; glassTex.repeat.set(6, 1);
    const skyboxes = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 64, 1, true), new THREE.MeshBasicMaterial({ map: glassTex, side: THREE.DoubleSide, toneMapped: false }));
    skyboxes.scale.set(HX + boxOff + 7, 3.2, HZ + boxOff + 7); skyboxes.position.y = lowTop + 2.1; scene.add(skyboxes);
    // верхний край чаши, синяя светодиодная линия и стена
    const upTop = UP.y0 + 12 * UP.h;
    const outer = UP.off + 13 * UP.d + 0.4;
    scene.add(ringWall(HX + outer, HZ + outer, R + outer, 1.0, upTop + 3, new THREE.MeshStandardMaterial({ color: 0x1a1d24, roughness: 0.9 })));
    scene.add(ringWall(HX + outer - 0.05, HZ + outer - 0.05, R + outer - 0.05, 0.08, 0.35, new THREE.MeshBasicMaterial({ color: 0x3d7bff, toneMapped: false }), upTop + 3.2));
    // флаги над верхним ярусом
    const flagCols = ['#00afca', '#d52b1e', '#ffffff', '#0039a6', '#ffce00', '#009a44', '#e30a17', '#002d62'];
    flagCols.concat(flagCols).forEach((c, i) => {
      const fl = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 3.4), new THREE.MeshStandardMaterial({ color: c, side: THREE.DoubleSide, roughness: 0.8 }));
      fl.position.set(-17 + i * 2.3, upTop + 6, -(HZ + outer - 1.2)); scene.add(fl);
    });

    // стальная ферменная крыша: радиальные фермы и кольца
    const steel = new THREE.MeshStandardMaterial({ color: 0x3b4250, metalness: 0.6, roughness: 0.45 });
    for (let i = 0; i < 28; i++) {
      const p = onContour((i / 28) * 360, outer + 1);
      const len = Math.hypot(p.x, p.z);
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.9, len), steel);
      t.position.set(p.x / 2, ROOF_Y + 2, p.z / 2); t.lookAt(p.x, ROOF_Y - 2, p.z); scene.add(t);
    }
    [0.35, 0.6, 0.85].forEach((k) => scene.add(ringWall((HX + outer) * k, (HZ + outer) * k, (R + outer) * k, 0.4, 0.5, steel, ROOF_Y + 2.5 - k * 3)));
    const ceil = new THREE.Mesh(new THREE.ShapeGeometry(rrect(HX + outer + 1, HZ + outer + 1, R + outer + 1), 24), new THREE.MeshStandardMaterial({ color: 0x0b0e16, roughness: 1, side: THREE.DoubleSide }));
    ceil.rotation.x = Math.PI / 2; ceil.position.y = ROOF_Y + 4; scene.add(ceil);
    // синие огни по периметру крыши
    const dots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.18, 6, 6), new THREE.MeshBasicMaterial({ color: 0x6aa8ff, toneMapped: false }), 180);
    for (let i = 0; i < 180; i++) { const p = onContour(i * 2, outer + 0.5); dummy.position.set(p.x, ROOF_Y - 1, p.z); dummy.scale.set(1, 1, 1); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); dots.setMatrixAt(i, dummy.matrix); }
    scene.add(dots);

    // медиакуб над центром льда
    const cubeTex = canvasTex(512, 320, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#0b2a6b'); gr.addColorStop(1, '#05112d');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.fillStyle = '#ffffff'; g.font = 'bold 56px Arial'; g.textAlign = 'center'; g.fillText('ALMATY ARENA', w / 2, 90);
      g.fillStyle = '#f2c230'; g.font = 'bold 110px Arial'; g.fillText('0 : 0', w / 2, 220);
      g.fillStyle = '#9fc2ff'; g.font = '36px Arial'; g.fillText('1-ПЕРИОД  20:00', w / 2, 285);
    });
    const cube = new THREE.Group();
    const faceMat = new THREE.MeshBasicMaterial({ map: cubeTex, toneMapped: false });
    [[0, 0], [Math.PI / 2, 1], [Math.PI, 0], [-Math.PI / 2, 1]].forEach(([ry, narrow]) => {
      const w = narrow ? 5 : 7.5;
      const fc = new THREE.Mesh(new THREE.PlaneGeometry(w, 4.4), faceMat);
      fc.rotation.y = ry; fc.position.set(Math.sin(ry) * (narrow ? 3.75 : 2.5), 0, Math.cos(ry) * (narrow ? 3.75 : 2.5)); cube.add(fc);
    });
    const frame = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.5, 5.1), steel); frame.position.y = 2.4; cube.add(frame);
    const frame2 = frame.clone(); frame2.position.y = -2.4; cube.add(frame2);
    cube.position.set(0, 19, 0); scene.add(cube);
    for (let i = 0; i < 4; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 9, 4), steel); c.position.set(i < 2 ? -3 : 3, 25.5, i % 2 ? -2 : 2); scene.add(c); }
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
    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 600);
    const built = build(opts.sectors, opts.taken || {});
    ctx = { renderer, camera, ...built, raf: 0 };
    window.addEventListener('resize', resize);
    resize();
    canvas.addEventListener('pointerdown', (e) => { look.drag = { x: e.clientX, y: e.clientY, yaw: look.tYaw, pitch: look.tPitch }; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', (e) => {
      if (!look.drag) return;
      look.tYaw = clamp(look.drag.yaw - (e.clientX - look.drag.x) * 0.004, -1.5, 1.5);
      look.tPitch = clamp(look.drag.pitch + (e.clientY - look.drag.y) * 0.003, -0.6, 0.7);
    });
    const endDrag = () => { look.drag = null; };
    canvas.addEventListener('pointerup', endDrag); canvas.addEventListener('pointercancel', endDrag);

    const p = seatPos(opts.sector, opts.row, opts.seat), f = facing(p);
    const mark = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 0.45), new THREE.MeshStandardMaterial({ color: 0x5fd38d, emissive: 0x1d6b3e, emissiveIntensity: 0.8 }));
    mark.position.set(p.x, p.y + 0.23, p.z); ctx.scene.add(mark);
    const inward = new THREE.Vector3(f.x - p.x, 0, f.z - p.z).normalize();
    const eye = new THREE.Vector3(p.x, p.y + 1.15, p.z).addScaledVector(inward, 0.2);
    const lookEnd = new THREE.Vector3(p.x * 0.25, 0, p.z * 0.25);
    const start = new THREE.Vector3(0, 26, 0.1), center = new THREE.Vector3(0, 0, 0);
    const mid = new THREE.Vector3(p.x * 0.7, 24, p.z * 0.7);
    look.yaw = look.tYaw = look.pitch = look.tPitch = 0;
    const dur = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 3800;
    const t0 = performance.now();
    const pos = new THREE.Vector3(), tgt = new THREE.Vector3(), dir = new THREE.Vector3();
    let arrived = false;
    const frameFn = (now) => {
      if (!ctx) return;
      const t = clamp((now - t0) / dur, 0, 1), k = ease(t);
      const a = (1 - k) * (1 - k), b = 2 * (1 - k) * k, c = k * k;
      pos.set(a * start.x + b * mid.x + c * eye.x, a * start.y + b * mid.y + c * eye.y, a * start.z + b * mid.z + c * eye.z);
      tgt.lerpVectors(center, lookEnd, k);
      const hFov = ((60 + 20 * k) * Math.PI) / 180;
      camera.fov = clamp((2 * Math.atan(Math.tan(hFov / 2) / camera.aspect)) / RAD, 45, 95);
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
      ctx.raf = requestAnimationFrame(frameFn);
    };
    ctx.raf = requestAnimationFrame(frameFn);
  }
  function close() {
    if (!ctx) return;
    cancelAnimationFrame(ctx.raf);
    window.removeEventListener('resize', resize);
    ctx.scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.map) o.material.map.dispose(); });
    ctx.renderer.dispose(); ctx.renderer.forceContextLoss();
    ctx = null;
  }
  window.Arena3D = { available: () => typeof window.THREE !== 'undefined', open, close, info, seatPos, onContour };
})();
