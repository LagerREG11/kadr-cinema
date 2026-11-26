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

  // скруглённый прямоугольник → мягкая «подушка» с фаской (вместо угловатых коробок)
  function rrect(w, h, r) {
    const s = new THREE.Shape();
    const x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }
  function soft(w, h, d, r, bev) {
    const g = new THREE.ExtrudeGeometry(rrect(w - 2 * bev, h - 2 * bev, r), {
      depth: Math.max(0.001, d - 2 * bev), bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 3, curveSegments: 6,
    });
    g.center();
    return g;
  }
  function canvasTex(w, h, draw, repeat) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const tx = new THREE.CanvasTexture(c);
    if (repeat) { tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.repeat.set(repeat[0], repeat[1]); }
    tx.anisotropy = 4;
    return tx;
  }

  const MOODS = {
    day: { hemi: 1.05, spot: 2.2, fill: 0.9, wall: 0.9, sconce: 0xffe0b8, dots: 0xfff1d6, led: 0xc08a4a, exposure: 1.3, bg: 0x0d0909 },
    evening: { hemi: 0.65, spot: 2.6, fill: 0.4, wall: 0.5, sconce: 0xffc98a, dots: 0xffe2b8, led: 0xffb35c, exposure: 1.15, bg: 0x060405 },
    night: { hemi: 0.2, spot: 2.1, fill: 0.1, wall: 0.12, sconce: 0x4a2c18, dots: 0x2a1d14, led: 0xffa640, exposure: 0.95, bg: 0x030203 },
  };

  function buildScene(moodName) {
    const M = MOODS[moodName] || MOODS.evening;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(M.bg);
    scene.fog = new THREE.Fog(M.bg, 18, 38);

    // ---- экран: рамка, свечение, сцена и занавес ----
    const screenMat = new THREE.MeshBasicMaterial({ map: desertTexture(), toneMapped: false });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(SCREEN_W, SCREEN_H), screenMat);
    screen.position.set(0, SCREEN_BOTTOM + SCREEN_H / 2, 0);
    scene.add(screen);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(SCREEN_W + 0.7, SCREEN_H + 0.5, 0.12), new THREE.MeshStandardMaterial({ color: 0x050405, roughness: 1 }));
    frame.position.set(0, SCREEN_BOTTOM + SCREEN_H / 2, -0.08);
    scene.add(frame);
    const glowTex = canvasTex(256, 128, (g, w, h) => {
      const gr = g.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2);
      gr.addColorStop(0, 'rgba(255,226,200,.55)'); gr.addColorStop(1, 'rgba(255,226,200,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    });
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(SCREEN_W * 1.9, SCREEN_H * 2.2),
      new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, opacity: 0.35 }));
    glow.position.set(0, SCREEN_BOTTOM + SCREEN_H / 2, -0.2);
    scene.add(glow);
    const stage = new THREE.Mesh(new THREE.BoxGeometry(SCREEN_W + 4, 0.5, 2.2), new THREE.MeshStandardMaterial({ color: 0x0d0909, roughness: 0.9 }));
    stage.position.set(0, 0.25, 0.9);
    scene.add(stage);
    const curtainMat = new THREE.MeshStandardMaterial({ color: 0x5a0b14, roughness: 0.85 });
    const fold = new THREE.CylinderGeometry(0.13, 0.13, 7.4, 10, 1, true);
    [-1, 1].forEach((side) => {
      for (let k = 0; k < 9; k++) {
        const c = new THREE.Mesh(fold, curtainMat);
        c.position.set(side * (SCREEN_W / 2 + 0.45 + k * 0.2), 3.7, 0.25 + (k % 2) * 0.08);
        scene.add(c);
      }
    });

    // ---- свет ----
    scene.add(new THREE.HemisphereLight(0x4a2a26, 0x0a0607, M.hemi));
    const spot = new THREE.SpotLight(0xffe4cc, M.spot, 32, Math.PI / 3, 0.75, 1.3);
    spot.position.set(0, SCREEN_BOTTOM + SCREEN_H / 2, 0.8);
    spot.target.position.set(0, 0, 10);
    scene.add(spot, spot.target);
    const fill = new THREE.PointLight(0xff4a35, M.fill, 22);
    fill.position.set(0, 6, 14);
    scene.add(fill);

    // ---- пол (ковёр), ступени с подсветкой ----
    const carpet = canvasTex(128, 128, (g, w, h) => {
      g.fillStyle = '#1a0d10'; g.fillRect(0, 0, w, h);
      for (let n = 0; n < 1400; n++) {
        g.fillStyle = `rgba(${90 + Math.random() * 60},${20 + Math.random() * 15},${28 + Math.random() * 15},${0.08 + Math.random() * 0.12})`;
        g.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5);
      }
      g.strokeStyle = 'rgba(160,40,50,.12)'; g.lineWidth = 2;
      for (let k = 0; k < w; k += 32) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + 16, h); g.stroke(); }
    }, [14, 18]);
    const floorMat = new THREE.MeshStandardMaterial({ map: carpet, color: 0xb08a8a, roughness: 1 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 40), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, 10);
    scene.add(floor);
    const aisles = [(seatX(2) + seatX(3)) / 2, (seatX(10) + seatX(11)) / 2];
    const ledMat = new THREE.MeshBasicMaterial({ color: M.led, toneMapped: false });
    const ledGeo = new THREE.BoxGeometry(AISLE * 0.7, 0.025, 0.03);
    for (let r = 1; r < ROWS; r++) {
      const h = rowY(r);
      const depth = r < ROWS - 1 ? rowZ(r + 1) - rowZ(r) : 3;
      const step = new THREE.Mesh(new THREE.BoxGeometry(HALL_W + 4, h, depth), floorMat);
      step.position.set(0, h / 2, rowZ(r) - 0.45 + depth / 2);
      scene.add(step);
      aisles.forEach((ax) => {
        const led = new THREE.Mesh(ledGeo, ledMat);
        led.position.set(ax, h + 0.013, rowZ(r) - 0.44);
        scene.add(led);
      });
    }

    // ---- стены: тканевые панели и бра; потолок со светильниками ----
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x1c0a0c, roughness: 0.95 });
    const panelMat = new THREE.MeshStandardMaterial({ color: 0x2e0d12, roughness: 0.9 });
    const sconceMat = new THREE.MeshBasicMaterial({ color: M.sconce, toneMapped: false });
    const panelGeo = new THREE.BoxGeometry(0.08, 4.2, 1.35);
    const sconceGeo = new THREE.BoxGeometry(0.06, 0.32, 0.16);
    [-1, 1].forEach((side) => {
      const wx = side * (HALL_W / 2 + 2.2);
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(40, 12), wallMat);
      wall.rotation.y = -side * Math.PI / 2;
      wall.position.set(wx, 6, 10);
      scene.add(wall);
      for (let z = 2.4; z < 20; z += 1.55) {
        const p = new THREE.Mesh(panelGeo, panelMat);
        p.position.set(wx - side * 0.05, 3.1, z);
        scene.add(p);
        const sc = new THREE.Mesh(sconceGeo, sconceMat);
        sc.position.set(wx - side * 0.07, 5.6, z + 0.77);
        scene.add(sc);
      }
      [7, 14].forEach((z) => {
        const l = new THREE.PointLight(0xffb070, M.wall, 7, 2);
        l.position.set(wx - side * 0.5, 5.4, z);
        scene.add(l);
      });
    });
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(30, 40), new THREE.MeshStandardMaterial({ color: 0x0a0607, roughness: 1 }));
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(0, 9.5, 10);
    scene.add(ceil);
    const dotGeo = new THREE.CircleGeometry(0.07, 10);
    const dotMat = new THREE.MeshBasicMaterial({ color: M.dots, toneMapped: false });
    for (let x = -6; x <= 6; x += 2) {
      for (let z = 4; z <= 18; z += 2.4) {
        const d = new THREE.Mesh(dotGeo, dotMat);
        d.rotation.x = Math.PI / 2;
        d.position.set(x, 9.48, z);
        scene.add(d);
      }
    }

    // ---- кресла: красный бархат, мягкие формы, подлокотники с подстаканниками ----
    const mats = {
      seat: new THREE.MeshStandardMaterial({ color: 0xa3141f, roughness: 0.92 }),
      side: new THREE.MeshStandardMaterial({ color: 0x5c0a10, roughness: 0.9 }),
      plastic: new THREE.MeshStandardMaterial({ color: 0x171214, roughness: 0.45, metalness: 0.2 }),
      sel: new THREE.MeshStandardMaterial({ color: 0x5fd38d, roughness: 0.6, emissive: 0x1d6b3e, emissiveIntensity: 0.55 }),
    };
    const geo = {
      cushion: soft(0.5, 0.48, 0.15, 0.07, 0.045),
      back: soft(0.54, 0.72, 0.14, 0.1, 0.04),
      backShell: soft(0.58, 0.76, 0.05, 0.1, 0.015),
      arm: soft(0.085, 0.5, 0.06, 0.03, 0.015),
      armPost: new THREE.BoxGeometry(0.05, 0.4, 0.34),
      cup: new THREE.TorusGeometry(0.035, 0.011, 6, 14),
      base: new THREE.BoxGeometry(0.34, 0.36, 0.3),
    };
    const seats = new Map();
    for (let r = 0; r < ROWS; r++) {
      for (let i = 0; i < SEATS; i++) {
        const g = new THREE.Group();
        const cushion = new THREE.Mesh(geo.cushion, mats.seat);
        cushion.rotation.x = -Math.PI / 2;
        cushion.position.set(0, 0.46, -0.01);
        const back = new THREE.Mesh(geo.back, mats.seat);
        back.position.set(0, 0.82, 0.24);
        back.rotation.x = -0.14;
        const shell = new THREE.Mesh(geo.backShell, mats.side);
        shell.position.set(0, 0.81, 0.33);
        shell.rotation.x = -0.14;
        const base = new THREE.Mesh(geo.base, mats.plastic);
        base.position.set(0, 0.18, 0.06);
        g.add(cushion, back, shell, base);
        [-1, 1].forEach((sd) => {
          const arm = new THREE.Mesh(geo.arm, mats.plastic);
          arm.rotation.x = -Math.PI / 2;
          arm.position.set(sd * 0.3, 0.67, 0.03);
          const post = new THREE.Mesh(geo.armPost, mats.side);
          post.position.set(sd * 0.3, 0.45, 0.06);
          const cup = new THREE.Mesh(geo.cup, mats.plastic);
          cup.rotation.x = -Math.PI / 2;
          cup.position.set(sd * 0.3, 0.7, -0.17);
          g.add(arm, post, cup);
        });
        g.scale.setScalar(VIP.has(r) ? 1.12 : 1);
        g.position.set(seatX(i), rowY(r), rowZ(r));
        g.userData.parts = [cushion, back];
        scene.add(g);
        seats.set(`${r}-${i}`, g);
      }
    }
    return { scene, seats, mats, screen, screenMat, exposure: M.exposure };
  }

  let ctx = null;
  const look = { yaw: 0, pitch: 0, tYaw: 0, tPitch: 0, drag: null };

  function resize() {
    if (!ctx) return;
    const c = ctx.renderer.domElement;
    const w = c.clientWidth, h = c.clientHeight;
    if (!w || !h) return;
    ctx.renderer.setSize(w, h, false);
    if (ctx.css) ctx.css.renderer.setSize(w, h);
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
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const camera = new THREE.PerspectiveCamera(55, 1, 0.05, 80);
    const built = buildScene(opts.mood);
    renderer.toneMappingExposure = built.exposure;
    ctx = { renderer, camera, ...built, raf: 0, css: null };
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
    const eye = new THREE.Vector3(x, y + 1.22 * scale, z + 0.1);
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
      if (ctx.css) ctx.css.renderer.render(ctx.css.scene, camera);
      ctx.raf = requestAnimationFrame(frame);
    };
    ctx.raf = requestAnimationFrame(frame);
  }

  // ---- трейлер на экране зала: iframe YouTube в CSS3D-слое под прозрачным «окном» в WebGL ----
  const canTrailer = () => typeof window.THREE !== 'undefined' && !!THREE.CSS3DRenderer;
  function setTrailer(key) {
    if (!ctx || !canTrailer()) return;
    const canvas = ctx.renderer.domElement;
    if (ctx.css) {
      ctx.css.renderer.domElement.remove();
      ctx.css = null;
    }
    if (!key || !/^[\w-]{11}$/.test(key)) {
      ctx.screen.material = ctx.screenMat;
      return;
    }
    const W = 1280, H = Math.round(W * SCREEN_H / SCREEN_W);
    const el = document.createElement('div');
    el.style.width = W + 'px';
    el.style.height = H + 'px';
    el.style.background = '#000';
    const frame = document.createElement('iframe');
    frame.src = `https://www.youtube-nocookie.com/embed/${key}?autoplay=1&mute=1&controls=0&loop=1&playlist=${key}&playsinline=1&rel=0&modestbranding=1`;
    frame.allow = 'autoplay; encrypted-media';
    // YouTube требует адрес сайта-источника (иначе «ошибка настройки плеера»)
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    frame.style.cssText = `width:${W}px;height:${H}px;border:0;display:block`;
    el.appendChild(frame);
    const obj = new THREE.CSS3DObject(el);
    obj.position.copy(ctx.screen.position);
    obj.scale.setScalar(SCREEN_W / W);
    const scene = new THREE.Scene();
    scene.add(obj);
    const renderer = new THREE.CSS3DRenderer();
    renderer.domElement.className = 'css3d-layer';
    canvas.parentElement.insertBefore(renderer.domElement, canvas);
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    ctx.css = { renderer, scene };
    // «окно» в экране: прозрачные пиксели, сквозь которые виден трейлер; кресла перед экраном по-прежнему рисуются поверх
    if (!ctx.holeMat) ctx.holeMat = new THREE.MeshBasicMaterial({ color: 0x000000, opacity: 0, transparent: false, blending: THREE.NoBlending, fog: false });
    ctx.screen.material = ctx.holeMat;
  }

  function close() {
    if (!ctx) return;
    if (ctx.css) { ctx.css.renderer.domElement.remove(); ctx.css = null; }
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
    open, close, info, setTrailer, canTrailer,
  };
})();
