/* 3D-зал (three.js): пролёт камеры к выбранному месту и вид на экран. */
(() => {
  'use strict';

  const ROWS = 9, SEATS = 14;
  const BLOCKS = [3, 8, 3];
  const VIP = new Set([7, 8]); // ряды H, I
  const SCREEN_W = 11.5, SCREEN_H = 4.8, SCREEN_BOTTOM = 1.3;
  const PITCH = 0.62, AISLE = 1.1;
  const HALL_W = SEATS * PITCH + (BLOCKS.length - 1) * AISLE;

  const seatX = (i) => {
    const block = i < BLOCKS[0] ? 0 : i < BLOCKS[0] + BLOCKS[1] ? 1 : 2;
    return -HALL_W / 2 + i * PITCH + block * AISLE + PITCH / 2;
  };
  const rowZ = (r) => (r <= 6 ? 5.4 + r * 0.9 : 10.8 + (r - 6) * 1.25);
  const rowY = (r) => r * 0.2 + (r > 6 ? (r - 6) * 0.12 : 0);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  function info(r, i) {
    const dist = rowZ(r);
    const fov = Math.round((2 * Math.atan(SCREEN_W / 2 / dist) * 180) / Math.PI);
    const off = seatX(i);
    const kind = dist < 7 ? 'up_close' : dist > 11 ? 'full_picture' : 'sweet_spot';
    return { dist, fov, off, kind };
  }

  function desertTexture() {
    const c = document.createElement('canvas');
    c.width = 1200; c.height = 500;
    const g = c.getContext('2d');
    const W = c.width, H = c.height;
    const sky = g.createLinearGradient(0, 0, 0, H * 0.65);
    sky.addColorStop(0, '#c9a690'); sky.addColorStop(1, '#ead6c3');
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    const sun = g.createRadialGradient(W * 0.62, H * 0.3, 10, W * 0.62, H * 0.3, W * 0.45);
    sun.addColorStop(0, 'rgba(255,248,236,.55)'); sun.addColorStop(1, 'rgba(255,248,236,0)');
    g.fillStyle = sun; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(200,160,128,.55)';
    g.beginPath(); g.moveTo(0, H * 0.56);
    g.bezierCurveTo(W * 0.2, H * 0.5, W * 0.35, H * 0.55, W * 0.5, H * 0.52);
    g.bezierCurveTo(W * 0.7, H * 0.48, W * 0.85, H * 0.54, W, H * 0.5);
    g.lineTo(W, H); g.lineTo(0, H); g.fill();
    const mid = g.createLinearGradient(0, H * 0.5, 0, H);
    mid.addColorStop(0, '#d2a27a'); mid.addColorStop(1, '#b07a52');
    g.fillStyle = mid;
    g.beginPath(); g.moveTo(0, H * 0.7);
    g.bezierCurveTo(W * 0.15, H * 0.62, W * 0.3, H * 0.6, W * 0.45, H * 0.6);
    g.bezierCurveTo(W * 0.6, H * 0.6, W * 0.8, H * 0.66, W, H * 0.62);
    g.lineTo(W, H); g.lineTo(0, H); g.fill();
    g.fillStyle = '#e1b48a';
    g.beginPath(); g.moveTo(0, H);
    g.bezierCurveTo(W * 0.25, H * 0.85, W * 0.5, H * 0.7, W * 0.68, H * 0.62);
    g.bezierCurveTo(W * 0.8, H * 0.58, W * 0.9, H * 0.62, W, H * 0.66);
    g.lineTo(W, H); g.fill();
    const shade = g.createLinearGradient(W * 0.6, 0, W, 0);
    shade.addColorStop(0, 'rgba(120,72,44,.75)'); shade.addColorStop(1, 'rgba(150,95,60,.45)');
    g.fillStyle = shade;
    g.beginPath(); g.moveTo(W * 0.68, H * 0.62);
    g.bezierCurveTo(W * 0.62, H * 0.75, W * 0.55, H * 0.9, W * 0.5, H);
    g.lineTo(W, H); g.lineTo(W, H * 0.66);
    g.bezierCurveTo(W * 0.9, H * 0.62, W * 0.8, H * 0.58, W * 0.68, H * 0.62);
    g.fill();
    g.fillStyle = '#2a1a12';
    g.fillRect(W * 0.505, H * 0.555, 3, 12);
    g.beginPath(); g.arc(W * 0.505 + 1.5, H * 0.55, 2.4, 0, Math.PI * 2); g.fill();
    const tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 4;
    return tex;
  }

  function buildScene() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050405);
    scene.fog = new THREE.Fog(0x050405, 16, 34);

    const screen = new THREE.Mesh(new THREE.PlaneGeometry(SCREEN_W, SCREEN_H), new THREE.MeshBasicMaterial({ map: desertTexture() }));
    screen.position.set(0, SCREEN_BOTTOM + SCREEN_H / 2, 0);
    scene.add(screen);

    scene.add(new THREE.HemisphereLight(0x3a2622, 0x080506, 0.7));
    const spot = new THREE.SpotLight(0xffe4cc, 2.4, 30, Math.PI / 3, 0.7, 1.4);
    spot.position.set(0, SCREEN_BOTTOM + SCREEN_H / 2, 0.6);
    spot.target.position.set(0, 0, 10);
    scene.add(spot, spot.target);
    const fill = new THREE.PointLight(0xff3a2a, 0.35, 20);
    fill.position.set(0, 5, 14);
    scene.add(fill);

    const darkMat = new THREE.MeshStandardMaterial({ color: 0x120c0d, roughness: 1 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 40), darkMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, 10);
    scene.add(floor);
    for (let r = 1; r < ROWS; r++) {
      const h = rowY(r);
      const depth = r < ROWS - 1 ? rowZ(r + 1) - rowZ(r) : 3;
      const step = new THREE.Mesh(new THREE.BoxGeometry(HALL_W + 4, h, depth), darkMat);
      step.position.set(0, h / 2, rowZ(r) - 0.45 + depth / 2);
      scene.add(step);
    }
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x1a0809, roughness: 0.95 });
    [-1, 1].forEach((side) => {
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(40, 12), wallMat);
      wall.rotation.y = -side * Math.PI / 2;
      wall.position.set(side * (HALL_W / 2 + 2.2), 6, 10);
      scene.add(wall);
    });

    const mats = {
      seat: new THREE.MeshStandardMaterial({ color: 0x8e1219, roughness: 0.8 }),
      dark: new THREE.MeshStandardMaterial({ color: 0x5c0a10, roughness: 0.85 }),
      sel: new THREE.MeshStandardMaterial({ color: 0x5fd38d, roughness: 0.6, emissive: 0x1d6b3e, emissiveIntensity: 0.5 }),
    };
    const geo = {
      cushion: new THREE.BoxGeometry(0.52, 0.14, 0.5),
      back: new THREE.BoxGeometry(0.54, 0.68, 0.12),
      arm: new THREE.BoxGeometry(0.06, 0.22, 0.52),
      base: new THREE.BoxGeometry(0.3, 0.38, 0.3),
    };
    const seats = new Map();
    for (let r = 0; r < ROWS; r++) {
      for (let i = 0; i < SEATS; i++) {
        const g = new THREE.Group();
        const cushion = new THREE.Mesh(geo.cushion, mats.seat);
        cushion.position.set(0, 0.45, 0);
        const back = new THREE.Mesh(geo.back, mats.seat);
        back.position.set(0, 0.82, 0.24);
        back.rotation.x = -0.12;
        const base = new THREE.Mesh(geo.base, mats.dark);
        base.position.set(0, 0.19, 0.05);
        const armL = new THREE.Mesh(geo.arm, mats.dark);
        armL.position.set(-0.29, 0.6, 0.02);
        const armR = armL.clone();
        armR.position.x = 0.29;
        g.add(cushion, back, base, armL, armR);
        g.scale.setScalar(VIP.has(r) ? 1.12 : 1);
        g.position.set(seatX(i), rowY(r), rowZ(r));
        g.userData.parts = [cushion, back];
        scene.add(g);
        seats.set(`${r}-${i}`, g);
      }
    }
    return { scene, seats, mats };
  }

  let ctx = null;
  const look = { yaw: 0, pitch: 0, tYaw: 0, tPitch: 0, drag: null };

  function resize() {
    if (!ctx) return;
    const c = ctx.renderer.domElement;
    const w = c.clientWidth, h = c.clientHeight;
    if (!w || !h) return;
    ctx.renderer.setSize(w, h, false);
    ctx.camera.aspect = w / h;
    ctx.camera.updateProjectionMatrix();
  }

  function bindDrag(canvas, onDrag) {
    canvas.addEventListener('pointerdown', (e) => {
      look.drag = { x: e.clientX, y: e.clientY, yaw: look.tYaw, pitch: look.tPitch };
      canvas.setPointerCapture(e.pointerId);
      onDrag && onDrag();
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!look.drag) return;
      look.tYaw = clamp(look.drag.yaw - (e.clientX - look.drag.x) * 0.004, -0.9, 0.9);
      look.tPitch = clamp(look.drag.pitch + (e.clientY - look.drag.y) * 0.003, -0.35, 0.35);
    });
    const end = () => { look.drag = null; };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
  }

  /**
   * Открыть сцену в canvas.
   * opts: { selected: [{r,i}], target: {r,i}, onArrive(), onDrag() }
   */
  function open(canvas, opts) {
    close();
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    const camera = new THREE.PerspectiveCamera(55, 1, 0.05, 80);
    const built = buildScene();
    ctx = { renderer, camera, ...built, raf: 0 };
    window.addEventListener('resize', resize);
    bindDrag(canvas, opts.onDrag);
    resize();

    opts.selected.forEach(({ r, i }) => {
      const g = built.seats.get(`${r}-${i}`);
      if (g) g.userData.parts.forEach((p) => { p.material = built.mats.sel; });
    });

    const { r, i } = opts.target;
    const x = seatX(i), y = rowY(r), z = rowZ(r);
    const scale = VIP.has(r) ? 1.12 : 1;
    const eye = new THREE.Vector3(x, y + 1.15 * scale, z + 0.08);
    const pitchToScreen = Math.atan2(SCREEN_BOTTOM + SCREEN_H / 2 - eye.y, z);
    const lookEnd = new THREE.Vector3(x * 0.2, eye.y + Math.tan(pitchToScreen - 0.32) * z, 0);
    const startPos = new THREE.Vector3(x * 0.4, y + 13, z + 4.5);
    const startLook = new THREE.Vector3(x, y, z - 0.5);
    const midPos = new THREE.Vector3(x, y + 4.5, z + 3.2);

    look.yaw = look.tYaw = look.pitch = look.tPitch = 0;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dur = reduce ? 1 : 3400;
    const t0 = performance.now();
    const pos = new THREE.Vector3(), tgt = new THREE.Vector3(), dir = new THREE.Vector3();
    let arrived = false;

    const frame = (now) => {
      if (!ctx) return;
      const t = clamp((now - t0) / dur, 0, 1);
      const k = ease(t);
      const a = (1 - k) * (1 - k), b = 2 * (1 - k) * k, c = k * k;
      pos.set(
        a * startPos.x + b * midPos.x + c * eye.x,
        a * startPos.y + b * midPos.y + c * eye.y,
        a * startPos.z + b * midPos.z + c * eye.z
      );
      tgt.lerpVectors(startLook, lookEnd, ease(clamp(t * 1.15 - 0.1, 0, 1)));
      const hFov = ((40 + 18 * k) * Math.PI) / 180;
      const vFov = 2 * Math.atan(Math.tan(hFov / 2) / camera.aspect);
      camera.fov = clamp((vFov * 180) / Math.PI, 35, 100);
      camera.updateProjectionMatrix();
      camera.position.copy(pos);

      if (t >= 1) {
        look.yaw += (look.tYaw - look.yaw) * 0.12;
        look.pitch += (look.tPitch - look.pitch) * 0.12;
        const breathe = Math.sin(now / 1800) * 0.006;
        dir.subVectors(lookEnd, eye).normalize();
        const yaw = Math.atan2(dir.x, -dir.z) + look.yaw;
        const pitch = Math.asin(dir.y) + look.pitch + breathe;
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
    ctx.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material && o.material.map) o.material.map.dispose();
    });
    ctx.renderer.dispose();
    ctx.renderer.forceContextLoss(); // освобождаем WebGL-контекст (браузер даёт ~16 штук)
    ctx = null;
  }

  window.Hall3D = {
    available: () => typeof window.THREE !== 'undefined',
    open, close, info,
  };
})();
