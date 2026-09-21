/* An accessible space environment: decorative motion never blocks the content. */
(() => {
  'use strict';
  const hero = document.querySelector('.space-hero');
  const motion = document.querySelector('.space-motion');
  const previousSections = {'#research':'research.html', '#selected-work':'research.html#selected-work', '#background':'cv.html#background', '#contact':'contact.html#contact'};
  if (hero && previousSections[location.hash]) location.replace(previousSections[location.hash]);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const coarse = window.matchMedia('(pointer: coarse)');
  let paused = reduced.matches;
  let frameId = 0;
  let previous = 0, lastPaint = 0;
  let visible = !document.hidden;
  let heroVisible = true;
  let camera = { x: 0, y: 0 };
  let pointer = { x: 0, y: 0 };
  let sceneTime = 0;
  const planetRenderer = hero && window.createLatentPlanet?.(hero);
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
    planetRenderer?.resize();
    measureOrbit();
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
    const delta = Math.min(now - previous, 50); previous = now;
    const smoothing = 1 - Math.exp(-delta / 240);
    camera.x += (pointer.x - camera.x) * smoothing;
    camera.y += (pointer.y - camera.y) * smoothing;
    if (hero && heroVisible) {
      sceneTime += delta / 1000;
      // Orbital controls run every display frame, independently of the GPU budget.
      updateOrbit(delta);
      hero.style.setProperty('--camera-x', `${camera.x}px`);
      hero.style.setProperty('--camera-y', `${camera.y}px`);
    }
    if (now - lastPaint >= 32) {
      const paintDelta = Math.min(now-lastPaint,64); lastPaint=now;
      if (hero && heroVisible) planetRenderer?.draw(sceneTime);
      paint(paintDelta);
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
  const globes = worlds.map(world => world.querySelector('.world-globe'));
  const voyager = system?.querySelector('.space-voyager');
  const trail = system?.querySelector('.space-flight');
  const memories = system?.querySelector('.space-memories');
  const cruise = hero?.querySelector('.space-cruise');
  const announcement = hero?.querySelector('.space-announcement');
  const consolePanel = hero?.querySelector('.ship-console');
  const consoleLink = hero?.querySelector('.console-link');
  const consoleClose = hero?.querySelector('.console-close');
  let position = { x: 620, y: 620 };
  let flightId = 0, timer = 0, selected = -1;
  let automatic = false, finishFlight = null;
  let orbitTime = 0, docked = -1, hoveredConsole = false, shipDepth = 3;
  let orbitLayout = null, consoleSize = { width: 260, height: 210 }, positioned = false;
  const phases = worlds.map((_, index) => Math.PI * 1.15 + index * Math.PI * 2 / worlds.length);
  const descriptions = {
    introduction: ['Introduction', 'Meet the researcher exploring connections across signals.', 'Meet Dong-Hyuk Lee'],
    cv: ['CV', 'Experience, education, and the tools behind the research.', 'View curriculum vitae'],
    publications: ['Publication', 'Papers, manuscripts, and ideas at every stage.', 'Browse publications'],
    research: ['Research', 'Contrastive learning, multimodal foundation models, and transferable representations.', 'Explore research'],
    contact: ['Contact', 'Start a conversation about research and collaboration.', 'Get in touch']
  };
  function measureOrbit() {
    if (!system) return;
    const rect = system.getBoundingClientRect();
    orbitLayout = { width: rect.width, height: rect.height,
      shipWidth:voyager.offsetWidth, shipHeight:voyager.offsetHeight, radius: globes.map(globe => globe.offsetWidth / 2) };
    if (!positioned) {
      place({ x: window.innerWidth <= 800 ? 180 : 545, y: 690 * .76 }); positioned = true;
    }
    if (consolePanel && !consolePanel.hidden) measureConsole();
    updateOrbit(0); drawOrbitTrack();
    if (finishFlight) finishFlight();
  }
  function planetPosition(index) {
    const point = planetRenderer?.project(phases[index] + orbitTime);
    if (point) return { ...point, x: point.x / orbitLayout.width * 1000, y: point.y / orbitLayout.height * 700 };
    const angle = phases[index] + orbitTime;
    return { x: 700 + Math.cos(angle) * 225, y: 350 + Math.sin(angle) * 140, z: 0, scale: 1, occluded: false };
  }
  function dockingPosition(index) {
    const point = planetPosition(index), radius = orbitLayout.radius[index] * point.scale;
    return { x: point.x - radius * .10 / orbitLayout.width * 1000,
      y: point.y - radius * .82 / orbitLayout.height * 700 };
  }
  function updateOrbit(delta) {
    if (!orbitLayout) return;
    orbitTime += delta * .000055;
    worlds.forEach((world, index) => {
      const point = planetPosition(index), x = point.x / 1000 * orbitLayout.width;
      world.style.left = '0px'; world.style.top = '0px';
      world.style.transform = `translate3d(${x}px,${point.y/700*orbitLayout.height}px,0) translate(-50%,-50%)`;
      world.style.setProperty('--caption-x', `${Math.max(62, Math.min(orbitLayout.width-62,x))-x}px`);
      globes[index].style.transform = `scale(${point.scale})`;
      maskPlanet(globes[index], point, orbitLayout.radius[index]);
      world.classList.toggle('is-behind', point.z < 0);
      world.style.zIndex = point.z > 0 ? '4' : '2';
    });
    if (docked >= 0 && !finishFlight) { shipDepth=planetPosition(docked).z; place(dockingPosition(docked)); positionConsole(); }
  }
  function applyOcclusion(element, x, y, depth, width, height, scale = 1) {
    const scene=planetRenderer?.getScene();
    if (!scene || depth>=0) { element.style.maskImage='none'; element.style.webkitMaskImage='none'; element.dataset.occlusion='visible'; return; }
    const cx=width/2+(scene.cx-x)/scale, cy=height/2+(scene.cy-y)/scale;
    const radius=scene.scale/scale, distance=Math.hypot(x-scene.cx,y-scene.cy);
    const extent=Math.max(width,height)*scale/2;
    if (distance-extent>=scene.scale) { element.style.maskImage='none'; element.style.webkitMaskImage='none'; element.dataset.occlusion='visible'; return; }
    const mask=`radial-gradient(circle ${radius}px at ${cx}px ${cy}px, transparent ${radius-.65}px, #000 ${radius+.65}px)`;
    element.style.maskImage=mask; element.style.webkitMaskImage=mask;
    element.dataset.occlusion=distance+extent<scene.scale?'hidden':'partial';
  }
  function maskPlanet(globe, point, radius) {
    applyOcclusion(globe,point.x/1000*orbitLayout.width,point.y/700*orbitLayout.height,point.z,radius*2,radius*2,point.scale);
  }
  function drawOrbitTrack() {
    const route = system.querySelector('.space-orbit-track');
    if (planetRenderer && route) {
      let path = '', pen = false;
      for (let i=0; i<=96; i++) {
        const point = planetRenderer.project(i/96*Math.PI*2);
        if (point.occluded) { pen=false; continue; }
        path += `${pen?'L':'M'}${(point.x/orbitLayout.width*1000).toFixed(2)} ${(point.y/orbitLayout.height*700).toFixed(2)} `;
        pen=true;
      }
      route.setAttribute('d',path);
    }
  }
  function place(point) {
    position = point;
    voyager.style.left = `${point.x / 10}%`; voyager.style.top = `${point.y / 7}%`;
    if (orbitLayout) applyOcclusion(voyager,point.x/1000*orbitLayout.width,point.y/700*orbitLayout.height,shipDepth,orbitLayout.shipWidth,orbitLayout.shipHeight);
  }
  function measureConsole() {
    consoleSize = { width: consolePanel.offsetWidth, height: consolePanel.offsetHeight };
  }
  function positionConsole() {
    if (!consolePanel || consolePanel.hidden || hoveredConsole || consolePanel.contains(document.activeElement)) return;
    const x=position.x/1000*orbitLayout.width, y=position.y/700*orbitLayout.height;
    const left=Math.max(12,Math.min(orbitLayout.width-consoleSize.width-12,x-consoleSize.width/2));
    let top=y+46;
    if (top+consoleSize.height>orbitLayout.height-8) top=y-consoleSize.height-45;
    consolePanel.style.left=`${left}px`; consolePanel.style.top=`${Math.max(8,top)}px`;
  }
  function hideConsole() { hoveredConsole=false; if (consolePanel) consolePanel.hidden=true; }
  function openConsole(index, keyboard) {
    const [title,text,label]=descriptions[worlds[index].dataset.world];
    hero.querySelector('.console-title').textContent=title;
    hero.querySelector('.console-description').textContent=text;
    consoleLink.href=worlds[index].href;
    consoleLink.innerHTML=''; consoleLink.append(document.createTextNode(label+' '));
    const arrow=document.createElement('span');arrow.setAttribute('aria-hidden','true');arrow.textContent='↗';consoleLink.append(arrow);
    consolePanel.hidden=false; measureConsole(); positionConsole();
    announcement.textContent=`Landed on ${title}. ${label} is available in the landing message.`;
    if (keyboard) consoleLink.focus({preventScroll:true});
  }
  // A single 3D curve controls both projection and depth. Interpolating direction
  // and radius separately keeps the entire hull outside the planet's sphere.
  function createFlightPath(from, initialTarget, clearance) {
    const unit = vector => { const length=Math.hypot(...vector); return vector.map(v=>v/length); };
    const startRadius=Math.hypot(...from), a=unit(from), b=unit(initialTarget);
    const sum=a.map((v,i)=>v+b[i]);
    // Fix the turning side at launch, including nearly opposite destinations.
    // A moving destination must never flip the route through the planet's core.
    const control=Math.hypot(...sum)>.35 ? unit(sum) :
      unit(Math.hypot(a[0],a[1])>.1 ? [-a[1],a[0],0] : [1,0,0]);
    return (progress, target=initialTarget) => {
      const t=Math.max(0,Math.min(1,progress)), endRadius=Math.hypot(...target), end=unit(target);
      const direction=unit(a.map((v,i)=>(1-t)**2*v+2*(1-t)*t*control[i]+t*t*end[i]));
      const radius=Math.max(clearance,(1-t)*startRadius+t*endRadius)+.14*Math.sin(Math.PI*t)**2;
      return direction.map(v=>v*radius);
    };
  }
  function travel(target, dockIndex = -1, keyboard = false) {
    const fromDepth=shipDepth;
    docked = -1; hideConsole();
    voyager.dataset.state='flying';
    cancelAnimationFrame(flightId); finishFlight = null;
    const scene=planetRenderer?.getScene() || {cx:orbitLayout.width*.7,cy:orbitLayout.height*.5,scale:orbitLayout.width*.13};
    const toSpace=(point,depth)=>[(point.x/1000*orbitLayout.width-scene.cx)/scene.scale,
      (scene.cy-point.y/700*orbitLayout.height)/scene.scale,depth];
    const toScreen=point=>({x:(scene.cx+point[0]*scene.scale)/orbitLayout.width*1000,
      y:(scene.cy-point[1]*scene.scale)/orbitLayout.height*700});
    const destination=()=>toSpace(dockIndex>=0?dockingPosition(dockIndex):target,dockIndex>=0?planetPosition(dockIndex).z:3);
    const clearance=1+Math.hypot(orbitLayout.shipWidth,orbitLayout.shipHeight)/2/scene.scale+.12;
    const route=createFlightPath(toSpace(position,fromDepth),destination(),clearance);
    let path='';
    trail.style.strokeDasharray='none'; trail.style.strokeDashoffset='0';
    function drawFlight(progress,end) {
      let pen=false; path='';
      const steps=Math.max(1,Math.ceil(progress*96));
      for(let i=0;i<=steps;i++) {
        const point=route(progress*i/steps,end), projected=toScreen(point);
        // Far-side trails are hidden too; they cannot draw through the surface.
        if(point[2]<0 && Math.hypot(point[0],point[1])<1.03){pen=false;continue;}
        path+=`${pen?'L':'M'}${projected.x.toFixed(2)} ${projected.y.toFixed(2)} `; pen=true;
      }
      trail.setAttribute('d',path);
    }
    function finish() {
      cancelAnimationFrame(flightId); flightId=0;
      shipDepth=dockIndex>=0?planetPosition(dockIndex).z:3;
      place(dockIndex>=0 ? dockingPosition(dockIndex) : target); docked = dockIndex;
      voyager.dataset.state=dockIndex>=0?'landed':'idle';
      if (dockIndex>=0) voyager.style.setProperty('--heading','-12deg');
      const memory = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      memory.setAttribute('d', path); memories.append(memory);
      while (memories.children.length > 2) memories.firstElementChild.remove();
      trail.setAttribute('d', ''); finishFlight = null;
      if (dockIndex>=0) {
        const name=descriptions[worlds[dockIndex].dataset.world][0];
        hero.querySelector('.space-destination').textContent=`DH–01 / LANDED ON ${name.toUpperCase()}`;
        hero.querySelector('.space-description').textContent='Surface link established. Continue from the ship’s message.';
        openConsole(dockIndex,keyboard);
      }
    }
    finishFlight = finish;
    if (paused || reduced.matches || !visible || !heroVisible) { finish(); return; }
    const start = performance.now();
    function fly(now) {
      const progress = Math.min((now - start) / 1900, 1);
      const t = progress < .5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
      // Recompute the intercept continuously; the destination never stops orbiting.
      const end=destination(), point=route(t,end);
      shipDepth=point[2]; place(toScreen(point));
      const behind=route(Math.max(0,t-.001),end), ahead=route(Math.min(1,t+.001),end);
      const dx=ahead[0]-behind[0], dy=behind[1]-ahead[1];
      const heading=Math.atan2(dx,-dy)*180/Math.PI;
      voyager.style.setProperty('--heading',`${heading}deg`);
      drawFlight(t,end);
      if (progress<1) flightId=requestAnimationFrame(fly); else finish();
    }
    flightId=requestAnimationFrame(fly);
  }
  function stopJourney() {
    automatic = false; clearTimeout(timer);
    if (cruise) { cruise.setAttribute('aria-pressed', 'false'); cruise.textContent = 'Start journey ↗'; }
  }
  function showWorld(index, manual = true, keyboard = false) {
    if (manual) stopJourney();
    selected=index;
    if(docked===index&&!finishFlight){openConsole(index,keyboard);return;}
    const world=worlds[index], [title]=descriptions[world.dataset.world];
    worlds.forEach((item,i)=>item.setAttribute('aria-pressed',String(index===i)));
    hero.querySelector('.space-destination').textContent=`DH–01 / APPROACHING ${title.toUpperCase()}`;
    hero.querySelector('.space-description').textContent='Approach vector confirmed. Preparing for touchdown.';
    hero.querySelector('.space-related').hidden=true;
    if(manual)announcement.textContent=`Flying to ${title}.`;
    travel(dockingPosition(index),index,keyboard);
  }
  worlds.forEach((world,index)=>{
    world.setAttribute('role','button');world.setAttribute('aria-pressed','false');
    world.addEventListener('click',event=>{
      if(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
      event.preventDefault();showWorld(index,true,event.detail===0);
    });
    world.addEventListener('keydown',event=>{
      if(event.key===' '){event.preventDefault();showWorld(index,true,true);}
      if(['ArrowRight','ArrowDown','ArrowLeft','ArrowUp','Home','End'].includes(event.key)){
        event.preventDefault();
        const next=event.key==='Home'?0:event.key==='End'?worlds.length-1:(index+(['ArrowRight','ArrowDown'].includes(event.key)?1:-1)+worlds.length)%worlds.length;
        worlds[next].focus();
      }
    });
  });
  function dismissConsole() {
    const returnIndex=docked;
    hideConsole();
    if(docked>=0)hero.querySelector('.space-description').textContent='Click space to lift off, or choose another destination.';
    if(document.activeElement?.closest('.ship-console')&&returnIndex>=0)worlds[returnIndex].focus({preventScroll:true});
  }
  consoleClose?.addEventListener('click',()=>{stopJourney();dismissConsole();});
  consolePanel?.addEventListener('pointerenter',()=>{hoveredConsole=true;});
  consolePanel?.addEventListener('pointerleave',()=>{hoveredConsole=false;});
  system?.addEventListener('click',event=>{
    if(event.target.closest('.space-world,.ship-console')||event.detail===0)return;
    stopJourney();selected=-1;docked=-1;worlds.forEach(world=>world.setAttribute('aria-pressed','false'));
    if(document.activeElement?.closest('.space-world,.ship-console'))document.activeElement.blur();
    const rect=system.getBoundingClientRect();
    travel({x:Math.max(35,Math.min(965,(event.clientX-rect.left)/rect.width*1000)),y:Math.max(30,Math.min(660,(event.clientY-rect.top)/rect.height*700))});
    hero.querySelector('.space-destination').textContent='DH–01 / FREE FLIGHT';
    hero.querySelector('.space-description').textContent='Following curiosity across my research universe. Choose a section to explore.';
    hero.querySelector('.space-related').hidden=true;
    announcement.textContent='Flying to a new position.';
  });
  function nextWorld() {
    if (!automatic || !visible || !heroVisible) { stopJourney(); return; }
    showWorld((selected + 1) % worlds.length, false); timer = window.setTimeout(nextWorld, 6200);
  }
  cruise?.addEventListener('click', () => {
    if (automatic) { stopJourney(); finishFlight?.(); return; }
    automatic = true; cruise.setAttribute('aria-pressed', 'true'); cruise.textContent = 'Pause journey Ⅱ'; nextWorld();
  });
  hero?.addEventListener('keydown', event => { if (event.key === 'Escape') { stopJourney(); finishFlight?.(); dismissConsole(); } });
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
