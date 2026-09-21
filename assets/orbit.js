/* No tracking, dependencies, or network requests: an explorable research metaphor. */
(() => {
  'use strict';
  const atlas = document.querySelector('.latent-atlas');
  if (!atlas) return;
  const stage = atlas.querySelector('.latent-stage');
  const planets = [...atlas.querySelectorAll('.latent-planet')];
  const traveler = atlas.querySelector('.latent-traveler');
  const trail = atlas.querySelector('.latent-flight');
  const trails = atlas.querySelector('.latent-trails');
  const destination = atlas.querySelector('.latent-destination');
  const description = atlas.querySelector('.latent-description');
  const related = atlas.querySelector('.latent-related');
  const autoButton = atlas.querySelector('.latent-auto');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const worlds = {
    ecg: ['ECG / READING THE HEART', 'Learning representations of the heart, from diagnosis to ECG foundation models.', 'Explore ECG research'],
    vision: ['VISION / BEYOND WHAT WE SEE', 'Finding physiological signals in facial video through contrastive learning.', 'Explore remote heart rate estimation'],
    audio: ['AUDIO / LISTENING IN CONTEXT', 'Understanding emotion by connecting speech with language and visual cues.', 'Explore multimodal emotion recognition'],
    text: ['TEXT / MEANING IN CONVERSATION', 'Connecting language and dialogue context with the other signals of emotion.', 'Explore inter-dialog learning'],
    wearables: ['WEARABLES / SIGNALS IN EVERYDAY LIFE', 'Exploring multimodal physiological markers from wearable biosignals.', 'Explore wearable physiomarkers']
  };
  let position = { x: 240, y: 319.2 };
  let animation = 0;
  let timer = 0;
  let automatic = false;
  let selected = -1;
  let inView = true;
  let finishFlight = null;

  function place(point) {
    position = point;
    traveler.style.left = `${point.x / 4.8}%`;
    traveler.style.top = `${point.y / 3.8}%`;
  }
  function travel(target) {
    cancelAnimationFrame(animation);
    finishFlight = null;
    const start = { ...position };
    const control = { x: (start.x + target.x) / 2 + (target.y - start.y) * .24, y: (start.y + target.y) / 2 - (target.x - start.x) * .24 };
    const path = `M${start.x} ${start.y} Q${control.x} ${control.y} ${target.x} ${target.y}`;
    trail.setAttribute('d', path);
    const length = trail.getTotalLength();
    trail.style.strokeDasharray = String(length);
    trail.style.strokeDashoffset = String(length);
    const finish = () => {
      cancelAnimationFrame(animation);
      place(target);
      const memory = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      memory.setAttribute('d', path);
      trails.append(memory);
      while (trails.children.length > 3) trails.firstElementChild.remove();
      trail.setAttribute('d', '');
      finishFlight = null;
    };
    finishFlight = finish;
    if (reduced.matches || document.hidden || !inView) { finish(); return; }
    const started = performance.now();
    function frame(now) {
      const elapsed = Math.min((now - started) / 1100, 1);
      const t = elapsed < .5 ? 4 * elapsed ** 3 : 1 - (-2 * elapsed + 2) ** 3 / 2;
      place({ x: (1 - t) ** 2 * start.x + 2 * (1 - t) * t * control.x + t ** 2 * target.x,
        y: (1 - t) ** 2 * start.y + 2 * (1 - t) * t * control.y + t ** 2 * target.y });
      trail.style.strokeDashoffset = String(length * (1 - t));
      if (elapsed < 1) animation = requestAnimationFrame(frame); else finish();
    }
    animation = requestAnimationFrame(frame);
  }
  function stopAuto() {
    automatic = false;
    clearTimeout(timer);
    autoButton.setAttribute('aria-pressed', 'false');
    autoButton.innerHTML = 'Auto explore <span aria-hidden="true">↗</span>';
  }
  function select(index, manual = true) {
    if (manual) stopAuto();
    selected = index;
    const planet = planets[index];
    const [title, summary, label] = worlds[planet.dataset.world];
    planets.forEach((item, i) => item.setAttribute('aria-pressed', String(i === index)));
    destination.textContent = title;
    description.textContent = summary;
    related.href = planet.href;
    related.replaceChildren(document.createTextNode(`${label} ↗`));
    const x = parseFloat(planet.style.getPropertyValue('--x')) * 4.8;
    const y = parseFloat(planet.style.getPropertyValue('--y')) * 3.8;
    // Dock beside the planet rather than covering its label or touch target.
    travel({ x: x + (x > 240 ? -43 : 43), y: y - 24 });
  }
  planets.forEach((planet, index) => {
    // Without JS these are normal links to the same research destinations.
    planet.setAttribute('role', 'button');
    planet.setAttribute('aria-pressed', 'false');
    planet.addEventListener('click', event => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      select(index);
    });
    planet.addEventListener('keydown', event => {
      if (event.key === ' ') { event.preventDefault(); select(index); }
      if (['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? planets.length - 1 :
          (index + (['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : -1) + planets.length) % planets.length;
        planets[next].focus();
        select(next);
      }
    });
  });
  stage.addEventListener('click', event => {
    if (event.target.closest('.latent-planet') || event.detail === 0) return;
    stopAuto();
    planets.forEach(planet => planet.setAttribute('aria-pressed', 'false'));
    const bounds = stage.getBoundingClientRect();
    const x = Math.max(30, Math.min(450, (event.clientX - bounds.left) / bounds.width * 480));
    const y = Math.max(28, Math.min(340, (event.clientY - bounds.top) / bounds.height * 380));
    destination.textContent = 'BETWEEN MODALITIES';
    description.textContent = 'Following curiosity across signals, looking for shared representations.';
    related.href = '#selected-work';
    related.textContent = 'Discover the connections ↗';
    travel({ x, y });
  });
  function nextStop() {
    if (!automatic || document.hidden || !inView) { stopAuto(); return; }
    select((selected + 1) % planets.length, false);
    timer = window.setTimeout(nextStop, 4200);
  }
  autoButton.addEventListener('click', () => {
    if (automatic) { stopAuto(); finishFlight?.(); return; }
    automatic = true;
    autoButton.setAttribute('aria-pressed', 'true');
    autoButton.innerHTML = 'Pause journey <span aria-hidden="true">Ⅱ</span>';
    nextStop();
  });
  atlas.addEventListener('keydown', event => {
    if (event.key === 'Escape') { stopAuto(); finishFlight?.(); }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { stopAuto(); finishFlight?.(); }
  });
  reduced.addEventListener('change', () => { stopAuto(); finishFlight?.(); });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      inView = entries[0].isIntersecting;
      if (!inView) { stopAuto(); finishFlight?.(); }
    }).observe(atlas);
  }
  autoButton.hidden = false;
  atlas.classList.add('is-interactive');
})();
