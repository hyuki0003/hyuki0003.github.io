/* An accessible space environment: decorative motion never blocks the content. */
(() => {
  'use strict';
  const hero = document.querySelector('.space-hero');
  const motion = document.querySelector('.space-motion');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const coarse = window.matchMedia('(pointer: coarse)');
  let paused = reduced.matches;
  let frameId = 0;
  let previous = 0;
  let visible = !document.hidden;
  let heroVisible = true;
  let camera = { x: 0, y: 0 };
  let pointer = { x: 0, y: 0 };
  const canvas = document.createElement('canvas');
  canvas.id = 'space-stars';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.prepend(canvas);
  const ctx = canvas.getContext('2d');
  let width = 0, height = 0;
  const stars = Array.from({ length: coarse.matches ? 60 : 140 }, () => ({
    x: Math.random(), y: Math.random(), depth: .2 + Math.random() * .8,
    size: .3 + Math.random() * 1.1, alpha: .15 + Math.random() * .55
  }));
  function resize() {
    width = window.innerWidth; height = window.innerHeight;
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    canvas.style.width = `${width}px`; canvas.style.height = `${height}px`;
    ctx?.setTransform(ratio, 0, 0, ratio, 0, 0);
    paint(0);
  }
  function paint(delta) {
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    for (const star of stars) {
      star.y = (star.y - delta * .000003 * star.depth + 1) % 1;
      const x = (star.x * width + camera.x * star.depth + width) % width;
      const y = (star.y * height + camera.y * star.depth + height) % height;
      ctx.beginPath(); ctx.arc(x, y, star.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(188,220,226,${star.alpha})`; ctx.fill();
    }
  }
  function render(now) {
    if (paused || !visible) { frameId = 0; return; }
    if (now - previous > 32) {
      const delta = Math.min(now - previous, 64); previous = now;
      camera.x += (pointer.x - camera.x) * .06;
      camera.y += (pointer.y - camera.y) * .06;
      if (hero && heroVisible) {
        hero.style.setProperty('--camera-x', `${camera.x}px`);
        hero.style.setProperty('--camera-y', `${camera.y}px`);
      }
      paint(delta);
    }
    frameId = requestAnimationFrame(render);
  }
  function startRendering() {
    if (!frameId && !paused && visible) { previous = performance.now(); frameId = requestAnimationFrame(render); }
  }
  function syncMotion() {
    document.body.classList.toggle('motion-paused', paused);
    motion?.setAttribute('aria-pressed', String(paused));
    motion?.setAttribute('aria-label', paused ? 'Resume space motion' : 'Pause space motion');
    if (motion) { motion.textContent = paused ? '▷' : 'Ⅱ'; motion.hidden = false; }
    cancelAnimationFrame(frameId); frameId = 0;
    if (paused) { stopJourney(); finishFlight?.(); pointer = { x: 0, y: 0 }; }
    startRendering();
  }
  window.addEventListener('resize', resize, { passive: true });
  hero?.addEventListener('pointermove', event => {
    if (paused || reduced.matches || coarse.matches) return;
    const rect = hero.getBoundingClientRect();
    pointer.x = (event.clientX / rect.width - .5) * -15;
    pointer.y = ((event.clientY - rect.top) / rect.height - .5) * -10;
  }, { passive: true });
  hero?.addEventListener('pointerleave', () => { pointer = { x: 0, y: 0 }; });

  const system = hero?.querySelector('.space-system');
  const worlds = system ? [...system.querySelectorAll('.space-world')] : [];
  const voyager = system?.querySelector('.space-voyager');
  const trail = system?.querySelector('.space-flight');
  const memories = system?.querySelector('.space-memories');
  const cruise = hero?.querySelector('.space-cruise');
  const announcement = hero?.querySelector('.space-announcement');
  let position = { x: 730, y: 343 };
  let flightId = 0, timer = 0, selected = -1;
  let automatic = false;
  let finishFlight = null;
  const descriptions = {
    ecg: ['ECG / BIOSIGNALS', 'Learning representations of the heart, from diagnosis to ECG foundation models.', 'Explore ECG research'],
    vision: ['VISION / PERCEPTION', 'Finding physiological signals in facial video through contrastive learning.', 'Explore remote heart rate estimation'],
    audio: ['AUDIO / RESONANCE', 'Connecting speech, language, and visual cues to understand emotion.', 'Explore multimodal emotion recognition'],
    text: ['TEXT / LANGUAGE', 'Exploring dialogue context and the shared representations of emotion.', 'Explore inter-dialog learning'],
    wearables: ['WEARABLES / PHYSIOLOGY', 'Exploring multimodal physiological markers from wearable biosignals.', 'Explore wearable physiomarkers']
  };
  function place(point) {
    position = point;
    voyager.style.left = `${point.x / 10}%`; voyager.style.top = `${point.y / 7}%`;
  }
  function travel(target) {
    cancelAnimationFrame(flightId); finishFlight = null;
    const from = { ...position };
    const control = { x: (from.x + target.x) / 2 + (target.y - from.y) * .24,
      y: (from.y + target.y) / 2 - (target.x - from.x) * .24 };
    const path = `M${from.x} ${from.y} Q${control.x} ${control.y} ${target.x} ${target.y}`;
    trail.setAttribute('d', path);
    const length = trail.getTotalLength();
    trail.style.strokeDasharray = String(length); trail.style.strokeDashoffset = String(length);
    function finish() {
      cancelAnimationFrame(flightId); place(target);
      const memory = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      memory.setAttribute('d', path); memories.append(memory);
      while (memories.children.length > 3) memories.firstElementChild.remove();
      trail.setAttribute('d', ''); finishFlight = null;
    }
    finishFlight = finish;
    if (paused || reduced.matches || !visible || !heroVisible) { finish(); return; }
    const start = performance.now();
    function fly(now) {
      const progress = Math.min((now - start) / 1600, 1);
      const t = progress < .5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
      place({ x: (1 - t) ** 2 * from.x + 2 * (1 - t) * t * control.x + t ** 2 * target.x,
        y: (1 - t) ** 2 * from.y + 2 * (1 - t) * t * control.y + t ** 2 * target.y });
      trail.style.strokeDashoffset = String(length * (1 - t));
      if (progress < 1) flightId = requestAnimationFrame(fly); else finish();
    }
    flightId = requestAnimationFrame(fly);
  }
  function stopJourney() {
    automatic = false; clearTimeout(timer);
    if (cruise) { cruise.setAttribute('aria-pressed', 'false'); cruise.textContent = 'Start journey ↗'; }
  }
  function showWorld(index, manual = true) {
    if (manual) stopJourney();
    selected = index;
    const world = worlds[index];
    const [title, text, label] = descriptions[world.dataset.world];
    worlds.forEach((item, i) => item.setAttribute('aria-pressed', String(index === i)));
    hero.querySelector('.space-destination').textContent = title;
    hero.querySelector('.space-description').textContent = text;
    const link = hero.querySelector('.space-related'); link.href = world.href; link.textContent = `${label} ↗`;
    if (manual) announcement.textContent = `${title}. ${text}`;
    const rect = system.getBoundingClientRect();
    const planet = world.querySelector('.world-globe').getBoundingClientRect();
    const x = (planet.left + planet.width / 2 - rect.left) / rect.width * 1000;
    const y = (planet.top + planet.height / 2 - rect.top) / rect.height * 700;
    travel({ x: Math.max(40, Math.min(940, x - 25)), y: Math.max(30, y - 65) });
  }
  worlds.forEach((world, index) => {
    world.setAttribute('role', 'button'); world.setAttribute('aria-pressed', 'false');
    world.addEventListener('click', event => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault(); showWorld(index);
    });
    world.addEventListener('keydown', event => {
      if (event.key === ' ') { event.preventDefault(); showWorld(index); }
      if (['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        const indexTo = event.key === 'Home' ? 0 : event.key === 'End' ? worlds.length - 1 :
          (index + (['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : -1) + worlds.length) % worlds.length;
        worlds[indexTo].focus(); showWorld(indexTo);
      }
    });
  });
  system?.addEventListener('click', event => {
    if (event.target.closest('.space-world') || event.detail === 0) return;
    stopJourney(); worlds.forEach(world => world.setAttribute('aria-pressed', 'false'));
    const rect = system.getBoundingClientRect();
    travel({ x: Math.max(35, Math.min(940, (event.clientX - rect.left) / rect.width * 1000)),
      y: Math.max(30, Math.min(650, (event.clientY - rect.top) / rect.height * 700)) });
    hero.querySelector('.space-destination').textContent = 'BETWEEN WORLDS / EXPLORING';
    hero.querySelector('.space-description').textContent = 'Following curiosity across signals, looking for shared representations.';
    const link = hero.querySelector('.space-related'); link.href = '#selected-work'; link.textContent = 'Discover the connections ↗';
    announcement.textContent = 'Exploring the space between modalities.';
  });
  function nextWorld() {
    if (!automatic || !visible || !heroVisible) { stopJourney(); return; }
    showWorld((selected + 1) % worlds.length, false); timer = window.setTimeout(nextWorld, 6200);
  }
  cruise?.addEventListener('click', () => {
    if (automatic) { stopJourney(); finishFlight?.(); return; }
    automatic = true; cruise.setAttribute('aria-pressed', 'true'); cruise.textContent = 'Pause journey Ⅱ'; nextWorld();
  });
  hero?.addEventListener('keydown', event => { if (event.key === 'Escape') { stopJourney(); finishFlight?.(); } });
  motion?.addEventListener('click', () => { paused = !paused; syncMotion(); });
  reduced.addEventListener('change', event => { paused = event.matches; syncMotion(); });
  document.addEventListener('visibilitychange', () => {
    visible = !document.hidden;
    if (!visible) { cancelAnimationFrame(frameId); frameId = 0; stopJourney(); finishFlight?.(); } else startRendering();
  });
  if ('IntersectionObserver' in window) {
    if (hero) new IntersectionObserver(entries => {
      heroVisible = entries[0].isIntersecting;
      if (!heroVisible) { stopJourney(); finishFlight?.(); }
    }).observe(hero);
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.remove('is-pending'); observer.unobserve(entry.target); }
    }), { threshold: .06 });
    if (!reduced.matches) document.querySelectorAll('.space-mission, .section-heading, .research-card, .work-card, .background-grid').forEach(element => {
      // Content is only hidden when the observer is running; no-JS stays readable.
      if (element.getBoundingClientRect().top > window.innerHeight) { element.classList.add('space-reveal', 'is-pending'); observer.observe(element); }
    });
  }
  if (cruise) cruise.hidden = false;
  system?.classList.add('is-interactive');
  resize(); syncMotion();
})();
