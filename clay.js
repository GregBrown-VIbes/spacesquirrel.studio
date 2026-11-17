// A tiny Kneady: hover the clay to reveal its control, click the button to
// change its shape, drag sideways to widen it, up or down to change its height.
(function () {
  const stage = document.querySelector('.clay-stage');
  if (!stage) return;
  const svg = stage.querySelector('svg');
  const clay = svg.querySelector('#clay');
  const btn = svg.querySelector('#clayButton');
  const btnIcon = svg.querySelector('#clayButtonIcon');
  const hint = stage.querySelector('.clay-hint');
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const N = 72, CX = 250, CY = 235, R = 120;
  const TAU = Math.PI * 2;
  // each shape is a radius for every angle, so any two can be blended
  const shapes = [
    { name: 'lump',    r: a => R * (1 + 0.07 * Math.sin(a * 3 + 0.6) + 0.04 * Math.cos(a * 5)) },
    { name: 'block',   r: a => { const n = 5, c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a)); return R * 0.95 / Math.pow(Math.pow(c, n) + Math.pow(s, n), 1 / n); } },
    { name: 'star',    r: a => R * (0.82 + 0.26 * Math.cos(a * 5 - Math.PI / 2)) },
    { name: 'capsule', r: a => { const c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a)); return R * 0.8 / Math.pow(Math.pow(c / 1.25, 4) + Math.pow(s / 0.85, 4), 0.25); } },
  ];
  const sample = s => Array.from({ length: N }, (_, i) => s.r((i / N) * TAU - Math.PI / 2));
  let shapeIdx = 0, radii = sample(shapes[0]);
  let sx = 1, sy = 1;

  function pts(rs, w, h, cx = CX, cy = CY) {
    return rs.map((r, i) => { const a = (i / N) * TAU - Math.PI / 2; return [cx + Math.cos(a) * r * w, cy + Math.sin(a) * r * h]; });
  }
  function pathFrom(P) {
    let d = '';
    for (let i = 0; i < N; i++) {
      const p0 = P[(i - 1 + N) % N], p1 = P[i], p2 = P[(i + 1) % N], p3 = P[(i + 2) % N];
      if (i === 0) d += `M${p1[0].toFixed(1)},${p1[1].toFixed(1)}`;
      d += `C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)},${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)},${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
    }
    return d + 'Z';
  }
  function draw() { clay.setAttribute('d', pathFrom(pts(radii, sx, sy))); }
  // the button previews the shape you'll get next
  function drawIcon() {
    const next = sample(shapes[(shapeIdx + 1) % shapes.length]);
    btnIcon.setAttribute('d', pathFrom(pts(next, 0.085, 0.085, 0, 0)));
  }

  // ----- hover state -----
  let active = false, hideTimer = 0, touched = false;
  function setActive(on) {
    clearTimeout(hideTimer);
    if (on === active) return;
    active = on;
    stage.classList.toggle('is-active', on);
    if (on && hint) hint.textContent = 'Drag sideways or up and down. Click the button to change shape.';
  }
  function overClay(e) {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    return el === clay || btn.contains(el);
  }

  // ----- dragging: one direction per drag, like Kneady -----
  let drag = null;
  function toSvg(e) { const b = svg.getBoundingClientRect(); return { x: (e.clientX - b.left) / b.width * 500, y: (e.clientY - b.top) / b.height * 500 }; }
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  stage.addEventListener('pointermove', e => {
    if (drag) {
      const m = toSvg(e), dx = m.x - drag.x, dy = m.y - drag.y;
      if (!drag.axis && Math.hypot(dx, dy) > 6) drag.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if (drag.axis === 'x') sx = clamp(drag.sx * Math.exp(dx / 180), 0.45, 1.75);
      if (drag.axis === 'y') sy = clamp(drag.sy * Math.exp(-dy / 180), 0.45, 1.45);
      stage.dataset.axis = drag.axis || '';
      draw();
      return;
    }
    if (e.pointerType === 'mouse') setActive(overClay(e));
  });
  stage.addEventListener('pointerleave', () => { if (!drag) hideTimer = setTimeout(() => setActive(false), 120); });

  stage.addEventListener('pointerdown', e => {
    if (btn.contains(e.target)) return;           // the button handles its own click
    if (e.target !== clay) { if (e.pointerType !== 'mouse') setActive(false); return; }
    if (e.pointerType !== 'mouse' && !active) { touched = true; setActive(true); }
    const m = toSvg(e);
    drag = { x: m.x, y: m.y, sx, sy, axis: null };
    stage.setPointerCapture(e.pointerId);
    stage.classList.add('is-dragging');
  });
  function endDrag(e) {
    if (!drag) return;
    drag = null; stage.dataset.axis = '';
    stage.classList.remove('is-dragging');
    if (e && e.pointerType === 'mouse') setActive(overClay(e));
  }
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);

  // ----- the button: morph to the next shape -----
  let anim = 0;
  function nextShape() {
    const from = radii.slice();
    shapeIdx = (shapeIdx + 1) % shapes.length;
    const to = sample(shapes[shapeIdx]);
    drawIcon();
    cancelAnimationFrame(anim);
    if (still) { radii = to; draw(); return; }
    const t0 = performance.now(), dur = 380;
    const step = now => {
      const t = Math.min(1, (now - t0) / dur), k = 1 - Math.pow(1 - t, 3);
      radii = from.map((r, i) => r + (to[i] - r) * k);
      draw();
      if (t < 1) anim = requestAnimationFrame(step);
    };
    anim = requestAnimationFrame(step);
  }
  btn.addEventListener('pointerdown', e => { e.stopPropagation(); });
  btn.addEventListener('click', e => { e.stopPropagation(); nextShape(); });

  // ----- keyboard: arrows resize, Enter or Space changes shape -----
  stage.addEventListener('focus', () => setActive(true));
  stage.addEventListener('blur', () => setActive(false));
  stage.addEventListener('keydown', e => {
    const k = e.key; let used = true;
    if (k === 'ArrowRight') sx = clamp(sx * 1.08, 0.45, 1.75);
    else if (k === 'ArrowLeft') sx = clamp(sx / 1.08, 0.45, 1.75);
    else if (k === 'ArrowUp') sy = clamp(sy * 1.08, 0.45, 1.45);
    else if (k === 'ArrowDown') sy = clamp(sy / 1.08, 0.45, 1.45);
    else if (k === 'Enter' || k === ' ') nextShape();
    else used = false;
    if (used) { e.preventDefault(); draw(); }
  });

  draw(); drawIcon();
})();
