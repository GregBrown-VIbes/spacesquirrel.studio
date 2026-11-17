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

  const N = 80, CX = 250, CY = 235, R = 120;   // 80 samples: star tips, notches and square corners all land on one
  const TAU = Math.PI * 2;
  const ang = i => (i / N) * TAU - Math.PI / 2;
  // radius where a ray from the centre meets a closed polygon
  function polyR(poly) {
    return a => {
      const dx = Math.cos(a), dy = Math.sin(a); let best = Infinity;
      for (let i = 0; i < poly.length; i++) {
        const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % poly.length];
        const ex = x2 - x1, ey = y2 - y1, den = dx * ey - dy * ex;
        if (Math.abs(den) < 1e-9) continue;
        const t = (x1 * ey - y1 * ex) / den, u = (x1 * dy - y1 * dx) / den;
        if (t > 0 && u >= -1e-9 && u <= 1 + 1e-9) best = Math.min(best, t);
      }
      return best;
    };
  }
  const starPoly = Array.from({ length: 10 }, (_, k) => { const a = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? R * 0.5 : R * 1.22; return [Math.cos(a) * r, Math.sin(a) * r]; });
  const sq = R * 0.86, squarePoly = [[-sq, -sq], [sq, -sq], [sq, sq], [-sq, sq]];
  // smooth: 1 draws flowing curves, 0 draws straight edges and sharp corners
  const shapes = [
    { name: 'lump',   smooth: 1, r: a => R * (1 + 0.07 * Math.sin(a * 3 + 0.6) + 0.04 * Math.cos(a * 5)) },
    { name: 'square', smooth: 0, r: polyR(squarePoly) },
    { name: 'circle', smooth: 1, r: () => R * 0.98 },
    { name: 'star',   smooth: 0, r: polyR(starPoly) },
  ];
  const sample = sh => Array.from({ length: N }, (_, i) => sh.r(ang(i)));
  let shapeIdx = 0, radii = sample(shapes[0]), smooth = 1;
  let sx = 1, sy = 1;

  function pts(rs, w, h, cx = CX, cy = CY) {
    return rs.map((r, i) => { const a = ang(i); return [cx + Math.cos(a) * r * w, cy + Math.sin(a) * r * h]; });
  }
  function pathFrom(P, k = 1) {
    let d = '';
    for (let i = 0; i < N; i++) {
      const p0 = P[(i - 1 + N) % N], p1 = P[i], p2 = P[(i + 1) % N], p3 = P[(i + 2) % N];
      if (i === 0) d += `M${p1[0].toFixed(1)},${p1[1].toFixed(1)}`;
      d += `C${(p1[0] + (p2[0] - p0[0]) * k / 6).toFixed(1)},${(p1[1] + (p2[1] - p0[1]) * k / 6).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) * k / 6).toFixed(1)},${(p2[1] - (p3[1] - p1[1]) * k / 6).toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
    }
    return d + 'Z';
  }
  // ----- the palette: a ring of shape buttons around the main one -----
  const NS = 'http://www.w3.org/2000/svg';
  const palette = document.createElementNS(NS, 'g');
  palette.setAttribute('id', 'clayPalette');
  svg.appendChild(palette);
  const RING = 84;
  const ringBtns = shapes.map((sh, i) => {
    const a = -Math.PI / 2 + i * TAU / shapes.length;            // first at the top, then clockwise
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('class', 'ring-btn');
    g.setAttribute('role', 'button');
    g.setAttribute('aria-label', sh.name);
    g.style.setProperty('--tx', (Math.cos(a) * RING).toFixed(1) + 'px');
    g.style.setProperty('--ty', (Math.sin(a) * RING).toFixed(1) + 'px');
    const c = document.createElementNS(NS, 'circle'); c.setAttribute('r', 25);
    const p = document.createElementNS(NS, 'path'); p.setAttribute('d', pathFrom(pts(sample(sh), 0.1, 0.1, 0, 0), sh.smooth));
    g.append(c, p); palette.appendChild(g);
    g.dataset.idx = i;
    return g;
  });
  palette.setAttribute('transform', `translate(${CX},${CY})`);
  let paletteOpen = false;
  function setPalette(on) {
    paletteOpen = on;
    stage.classList.toggle('palette-open', on);
    ringBtns.forEach((g, i) => g.classList.toggle('current', i === shapeIdx));
  }

  function draw() { clay.setAttribute('d', pathFrom(pts(radii, sx, sy), smooth)); clay.setAttribute('stroke-linejoin', smooth < 0.5 ? 'miter' : 'round'); }
  // the button previews the shape you'll get next
  function drawIcon() {
    const cur = shapes[shapeIdx];
    btnIcon.setAttribute('d', pathFrom(pts(sample(cur), 0.12, 0.12, 0, 0), cur.smooth));
  }

  // ----- hover state -----
  let active = false, hideTimer = 0, touched = false;
  function setActive(on) {
    clearTimeout(hideTimer);
    if (on === active) return;
    active = on;
    stage.classList.toggle('is-active', on);
    if (!on) setPalette(false);
    if (on && hint) hint.textContent = 'Drag left/right or up/down to squash and stretch. Click the button to change base shape.';
  }
  function overClay(e) {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    return el === clay || btn.contains(el) || (paletteOpen && palette.contains(el));
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
    const onBtn = btn.contains(e.target);
    const ring = paletteOpen ? ringBtns.find(g => g.contains(e.target)) : null;
    if (!onBtn && !ring && e.target !== clay) { if (e.pointerType !== 'mouse') setActive(false); else setPalette(false); return; }
    if (e.pointerType !== 'mouse' && !active) { touched = true; setActive(true); }
    const m = toSvg(e);
    drag = { x: m.x, y: m.y, sx, sy, axis: null, onBtn, ring: ring ? +ring.dataset.idx : -1 };
    stage.setPointerCapture(e.pointerId);
    stage.classList.add('is-dragging');
  });
  function endDrag(e) {
    if (!drag) return;
    const tap = !drag.axis && e && e.type === 'pointerup';
    const wasBtn = drag.onBtn, ringIdx = drag.ring;
    drag = null; stage.dataset.axis = '';
    if (tap && wasBtn) setPalette(!paletteOpen);                       // the button opens its palette
    else if (tap && ringIdx >= 0) { setShape(ringIdx); setPalette(false); }
    else if (tap && paletteOpen) setPalette(false);                    // a click on the clay closes it
    stage.classList.remove('is-dragging');
    // a pick from the palette keeps the clay selected; otherwise follow the mouse
    if (e && e.pointerType === 'mouse' && !(tap && ringIdx >= 0)) setActive(overClay(e));
  }
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);

  // ----- the button: morph to the next shape -----
  let anim = 0;
  function nextShape() { setShape((shapeIdx + 1) % shapes.length); }
  function setShape(idx) {
    const from = radii.slice(), fromSmooth = smooth;
    shapeIdx = idx;
    ringBtns.forEach((g, i) => g.classList.toggle('current', i === shapeIdx));
    const to = sample(shapes[shapeIdx]), toSmooth = shapes[shapeIdx].smooth;
    drawIcon();
    cancelAnimationFrame(anim);
    if (still) { radii = to; smooth = toSmooth; draw(); return; }
    const t0 = performance.now(), dur = 380;
    const step = now => {
      const t = Math.min(1, (now - t0) / dur), k = 1 - Math.pow(1 - t, 3);
      radii = from.map((r, i) => r + (to[i] - r) * k); smooth = fromSmooth + (toSmooth - fromSmooth) * k;
      draw();
      if (t < 1) anim = requestAnimationFrame(step);
    };
    anim = requestAnimationFrame(step);
  }

  // ----- keyboard: arrows resize, Enter or Space changes shape -----
  stage.addEventListener('focus', () => setActive(true));
  stage.addEventListener('blur', () => setActive(false));
  stage.addEventListener('keydown', e => {
    const k = e.key; let used = true;
    if (k === 'ArrowRight') sx = clamp(sx * 1.08, 0.45, 1.75);
    else if (k === 'ArrowLeft') sx = clamp(sx / 1.08, 0.45, 1.75);
    else if (k === 'ArrowUp') sy = clamp(sy * 1.08, 0.45, 1.45);
    else if (k === 'ArrowDown') sy = clamp(sy / 1.08, 0.45, 1.45);
    else if (k === 'Enter' || k === ' ') setPalette(!paletteOpen);
    else if (k === 'Escape') setPalette(false);
    else if (/^[1-4]$/.test(k)) { setShape(+k - 1); setPalette(false); }
    else used = false;
    if (used) { e.preventDefault(); draw(); }
  });

  draw(); drawIcon();
})();
