// Docs clips: muted loops that play while on screen and pause off it.
// With prefers-reduced-motion they never start by themselves: each shows a
// still of its last frame, with controls to play it. A clip you pause stays
// paused. Hand-written; tools/build_docs.py leaves this file alone.
(function () {
  const clips = Array.from(document.querySelectorAll('video.clip-video'));
  if (!clips.length) return;
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const still = () => motion.matches;

  function wake(v) {
    if (!v.poster && v.dataset.poster) v.poster = v.dataset.poster;
  }
  function start(v) {
    if (still() || v.dataset.userPaused) return;
    v.preload = 'auto';
    const p = v.play();
    if (p && p.catch) p.catch(() => {});
  }

  clips.forEach(v => {
    // a pause that isn't ours (we pause only off screen) is the reader's
    v.addEventListener('pause', () => { if (!v.dataset.offscreen && !v.ended) v.dataset.userPaused = '1'; });
    v.addEventListener('play', () => { delete v.dataset.userPaused; });
  });

  if (!('IntersectionObserver' in window)) {
    clips.forEach(v => { wake(v); start(v); });
    return;
  }
  const near = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { wake(e.target); near.unobserve(e.target); } });
  }, { rootMargin: '600px 0px' });
  const seen = new IntersectionObserver(entries => {
    entries.forEach(e => {
      const v = e.target;
      if (e.isIntersecting) { delete v.dataset.offscreen; start(v); }
      else if (!v.paused) { v.dataset.offscreen = '1'; v.pause(); }
      else v.dataset.offscreen = '1';
    });
  }, { threshold: 0.35 });
  clips.forEach(v => { near.observe(v); seen.observe(v); });

  motion.addEventListener && motion.addEventListener('change', () => {
    if (still()) clips.forEach(v => { v.dataset.offscreen = '1'; v.pause(); delete v.dataset.offscreen; });
  });
})();
