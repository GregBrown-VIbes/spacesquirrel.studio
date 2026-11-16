// A lump of clay you can pull: grab near the edge, drag, let go.
(function () {
  const stage = document.querySelector('.clay-stage');
  if (!stage) return;
  const svg = stage.querySelector('svg');
  const path = svg.querySelector('#clay');
  const glow = svg.querySelector('#glowStop');
  const grad = svg.querySelector('#clayLight');
  const hint = stage.querySelector('.clay-hint');
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const N = 56, CX = 250, CY = 250, R = 150;
  const pts = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    // a slightly lumpy, hand-made rest shape
    const r = R * (1 + 0.05 * Math.sin(a * 3 + 0.6) + 0.03 * Math.cos(a * 5));
    pts.push({ a, r, dx: 0, dy: 0, vx: 0, vy: 0, gx: 0, gy: 0 });
  }

  function toSvg(e) {
    const b = svg.getBoundingClientRect();
    return { x: (e.clientX - b.left) / b.width * 500, y: (e.clientY - b.top) / b.height * 500 };
  }
  function pos(p) {
    return [CX + Math.cos(p.a) * p.r + p.dx, CY + Math.sin(p.a) * p.r + p.dy];
  }
  function draw() {
    const P = pts.map(pos);
    let d = '';
    for (let i = 0; i < N; i++) {
      const p0 = P[(i - 1 + N) % N], p1 = P[i], p2 = P[(i + 1) % N], p3 = P[(i + 2) % N];
      if (i === 0) d += `M${p1[0].toFixed(1)},${p1[1].toFixed(1)}`;
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += `C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
    }
    path.setAttribute('d', d + 'Z');
  }

  let grab = null, raf = 0;
  function angleDist(a, b) {
    let d = Math.abs(a - b) % (Math.PI * 2);
    return d > Math.PI ? Math.PI * 2 - d : d;
  }
  stage.addEventListener('pointerdown', e => {
    const m = toSvg(e);
    const a = Math.atan2(m.y - CY, m.x - CX);
    const dist = Math.hypot(m.x - CX, m.y - CY);
    if (dist > R * 1.6) return;
    stage.setPointerCapture(e.pointerId);
    pts.forEach(p => {
      // a region: the closer to where you grabbed, the more it follows
      const w = Math.exp(-Math.pow(angleDist(p.a, a), 2) / (2 * 0.42 * 0.42));
      p.w = w; p.gx = p.dx; p.gy = p.dy;
    });
    grab = { x: m.x, y: m.y };
    hint && hint.classList.add('gone');
  });
  stage.addEventListener('pointermove', e => {
    const m = toSvg(e);
    grad.setAttribute('cx', (m.x / 500).toFixed(3));
    grad.setAttribute('cy', (m.y / 500).toFixed(3));
    if (!grab) return;
    let mx = m.x - grab.x, my = m.y - grab.y;
    const len = Math.hypot(mx, my), cap = 170;
    if (len > cap) { mx *= cap / len; my *= cap / len; }
    pts.forEach(p => { p.dx = p.gx + mx * p.w; p.dy = p.gy + my * p.w; });
    draw();
  });
  function release() {
    if (!grab) return;
    grab = null;
    if (still) { pts.forEach(p => { p.dx = p.dy = 0; }); draw(); return; }
    cancelAnimationFrame(raf);
    const step = () => {
      let moving = false;
      pts.forEach(p => {
        // clay is slow: a soft spring with plenty of damping
        p.vx = (p.vx - p.dx * 0.045) * 0.86; p.vy = (p.vy - p.dy * 0.045) * 0.86;
        p.dx += p.vx; p.dy += p.vy;
        if (Math.abs(p.dx) + Math.abs(p.dy) + Math.abs(p.vx) + Math.abs(p.vy) > 0.05) moving = true;
      });
      draw();
      if (moving && !grab) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }
  stage.addEventListener('pointerup', release);
  stage.addEventListener('pointercancel', release);
  draw();
})();
