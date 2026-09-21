/* A small, local landing simulator. No storage, network, or background game loop. */
window.createLandingSimulation = function createLandingSimulation() {
  const ground=212, pad=200, stepSize=1/120;
  let state, accumulated=0;
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  function reset() {
    accumulated=0;
    state={phase:'ready',x:158,y:38,vx:7,vy:7,angle:0,targetAngle:0,throttle:.4,time:0,reason:'',impact:null};
  }
  function feet(s=state) {
    const c=Math.cos(s.angle),n=Math.sin(s.angle);
    return [-9,9].map(x=>({x:s.x+x*c-12*n,y:s.y+x*n+12*c}));
  }
  function adjust(control) {
    if(state.phase!=='flying')return;
    if(control==='left'||control==='right')state.targetAngle=clamp(state.targetAngle+(control==='left'?-1:1)*Math.PI/45,-.85,.85);
    if(control==='up'||control==='down')state.throttle=clamp(state.throttle+(control==='up'?1:-1)*.06,0,1);
  }
  function integrate(dt,input) {
    const old={...state},oldFeet=feet();
    state.targetAngle=clamp(state.targetAngle+(input.tilt||0)*.9*dt,-.85,.85);
    state.angle+=(state.targetAngle-state.angle)*(1-Math.exp(-dt/.14));
    state.throttle=clamp(state.throttle+(input.thrust||0)*.5*dt,0,1);
    state.vx=(state.vx+Math.sin(state.angle)*60*state.throttle*dt)*Math.exp(-.10*dt);
    state.vy=(state.vy+(30-Math.cos(state.angle)*60*state.throttle)*dt)*Math.exp(-.025*dt);
    state.x+=state.vx*dt;state.y+=state.vy*dt;state.time+=dt;
    const points=feet(),bottom=Math.max(...points.map(p=>p.y));
    if(bottom>=ground) {
      const previous=Math.max(...oldFeet.map(p=>p.y));
      const t=clamp((ground-previous)/Math.max(.0001,bottom-previous),0,1);
      for(const key of ['x','y','vx','vy','angle'])state[key]=old[key]+(state[key]-old[key])*t;
      const legs=feet();
      state.impact={x:state.x,vx:state.vx,vy:state.vy,angle:state.angle};
      const centered=Math.abs(state.x-pad)<=24&&legs.every(p=>p.x>=162&&p.x<=238);
      const level=Math.abs(state.angle)<=8*Math.PI/180;
      const slow=state.vy>=0&&state.vy<=18,steady=Math.abs(state.vx)<=10;
      state.phase=centered&&level&&slow&&steady?'landed':'crashed';
      state.reason=!centered?'Missed the pad. Steer toward the center.':!level?'Level the ship before touchdown.':!slow?'Too fast. Add thrust earlier.':!steady?'Reduce sideways drift before landing.':'Perfect touchdown. Welcome home, Dong-Hyuk.';
      state.throttle=0;
    } else if(state.x<-16||state.x>416||state.y<-35) {
      state.phase='crashed';state.reason='Outside the approach corridor. Try a gentler correction.';state.throttle=0;
    }
  }
  reset();
  return {
    get state(){return state;},reset,feet,adjust,
    start(){if(state.phase==='ready')state.phase='flying';},
    step(dt,input={}){
      if(state.phase!=='flying')return;
      accumulated+=clamp(dt,0,.05);
      while(accumulated>=stepSize&&state.phase==='flying'){integrate(stepSize,input);accumulated-=stepSize;}
    }
  };
};

window.createLandingGame = function createLandingGame(hero,onWin) {
  const panel=hero.querySelector('.lander-console');
  if(!panel)return null;
  const canvas=panel.querySelector('canvas'),ctx=canvas.getContext('2d');
  if(!ctx)return null;
  const sim=window.createLandingSimulation(),keys=new Set(),touches=new Set();
  const startButton=panel.querySelector('.lander-start'),pauseButton=panel.querySelector('.lander-pause');
  const status=panel.querySelector('.lander-status'),overlay=panel.querySelector('.lander-overlay');
  const controls=[...panel.querySelectorAll('[data-control]')];
  const readouts=Object.fromEntries([...panel.querySelectorAll('[data-readout]')].map(e=>[e.dataset.readout,e]));
  const keyMap={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down'};
  let frame=0,last=0,paused=false,previousFocus=null,winSent=false,trail=[];
  const stars=Array.from({length:38},(_,i)=>({x:(i*97+23)%400,y:(i*47+11)%180,r:i%4===0?1:.55}));
  function paint() {
    const s=sim.state;
    ctx.setTransform(2,0,0,2,0,0);ctx.clearRect(0,0,400,240);
    const sky=ctx.createLinearGradient(0,0,0,240);sky.addColorStop(0,'#060f1b');sky.addColorStop(1,'#112b35');ctx.fillStyle=sky;ctx.fillRect(0,0,400,240);
    ctx.fillStyle='#b7d9dc66';for(const star of stars){ctx.beginPath();ctx.arc(star.x,star.y,star.r,0,Math.PI*2);ctx.fill();}
    ctx.strokeStyle='#8bb6bd13';ctx.lineWidth=.6;
    for(let x=0;x<=400;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,212);ctx.stroke();}
    for(let y=32;y<212;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(400,y);ctx.stroke();}
    ctx.setLineDash([2,5]);ctx.strokeStyle='#a8dfce45';ctx.beginPath();ctx.moveTo(200,42);ctx.lineTo(200,202);ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle='#0a1720';ctx.beginPath();ctx.moveTo(0,212);ctx.lineTo(40,202);ctx.lineTo(76,211);ctx.lineTo(129,207);ctx.lineTo(159,212);ctx.lineTo(241,212);ctx.lineTo(285,201);ctx.lineTo(340,208);ctx.lineTo(377,197);ctx.lineTo(400,207);ctx.lineTo(400,240);ctx.lineTo(0,240);ctx.fill();
    const success=s.phase==='landed';ctx.shadowColor=success?'#a8ffe0':'#84c5c3';ctx.shadowBlur=success?16:8;
    ctx.fillStyle=success?'#c7ffdf':'#89bdb7';ctx.beginPath();ctx.ellipse(200,214,39,4,0,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
    ctx.fillStyle='#d6f2e2';ctx.fillRect(180,210,40,2);ctx.fillStyle='#71978e';ctx.fillRect(163,211,4,2);ctx.fillRect(233,211,4,2);
    ctx.fillStyle='#81a8ad';ctx.font='7px monospace';ctx.textAlign='center';ctx.fillText('HOME / 00',200,233);
    if(trail.length>1){ctx.strokeStyle='#a6dfe333';ctx.lineWidth=1;ctx.beginPath();trail.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();}
    ctx.save();ctx.translate(s.x,s.y);ctx.rotate(s.angle);
    if(s.phase==='flying'&&s.throttle>0){ctx.fillStyle='#9feae8';ctx.globalAlpha=.65;ctx.beginPath();ctx.moveTo(-3,10);ctx.quadraticCurveTo(-6,18,0,14+s.throttle*18+(Math.sin(s.time*32)+1)*2);ctx.quadraticCurveTo(6,18,3,10);ctx.fill();ctx.globalAlpha=1;}
    const metal=ctx.createLinearGradient(-8,-10,10,14);metal.addColorStop(0,'#ebf5eb');metal.addColorStop(.5,'#9db6be');metal.addColorStop(1,'#3c6377');
    ctx.fillStyle=metal;ctx.strokeStyle='#bde0e1';ctx.lineWidth=.8;
    ctx.beginPath();ctx.moveTo(0,-16);ctx.bezierCurveTo(-6,-8,-6,4,-5,9);ctx.lineTo(5,9);ctx.bezierCurveTo(6,4,6,-8,0,-16);ctx.fill();ctx.stroke();
    ctx.fillStyle='#597e8c';ctx.beginPath();ctx.moveTo(-4,0);ctx.lineTo(-13,8);ctx.lineTo(-13,11);ctx.lineTo(-4,7);ctx.moveTo(4,0);ctx.lineTo(13,8);ctx.lineTo(13,11);ctx.lineTo(4,7);ctx.fill();ctx.stroke();
    ctx.fillStyle='#12394d';ctx.strokeStyle='#a5f0ef';ctx.beginPath();ctx.ellipse(0,-5,2.8,5,0,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.strokeStyle='#c9e6de';ctx.beginPath();ctx.moveTo(-5,8);ctx.lineTo(-9,12);ctx.moveTo(5,8);ctx.lineTo(9,12);ctx.stroke();ctx.restore();
    if(s.phase==='crashed'){ctx.strokeStyle='#dba28b88';ctx.lineWidth=1;for(let i=0;i<8;i++){const a=i*Math.PI/4;ctx.beginPath();ctx.moveTo(s.x+Math.cos(a)*20,s.y+Math.sin(a)*20);ctx.lineTo(s.x+Math.cos(a)*28,s.y+Math.sin(a)*28);ctx.stroke();}}
    const altitude=Math.max(0,(212-Math.max(...sim.feet().map(p=>p.y)))/10);
    readouts.altitude.textContent=altitude.toFixed(1)+' m';
    readouts.speed.textContent=(Math.max(0,s.vy)/10).toFixed(1)+' m/s';
    readouts.tilt.textContent=Math.round(s.angle*180/Math.PI)+'°';
    readouts.thrust.textContent=Math.round(s.throttle*100)+'%';
    readouts.speed.dataset.warning=String(s.vy>18);readouts.tilt.dataset.warning=String(Math.abs(s.angle)>8*Math.PI/180);
    panel.querySelector('.lander-throttle b').style.width=`${s.throttle*100}%`;
  }
  function clearInput(){keys.clear();touches.clear();controls.forEach(b=>b.classList.remove('is-held'));}
  function sync() {
    const phase=sim.state.phase;panel.dataset.state=paused?'paused':phase;
    overlay.hidden=phase==='flying'&&!paused;
    overlay.querySelector('span').textContent=paused?'FLIGHT PAUSED':phase==='ready'?'BRING IT HOME':phase==='landed'?'TOUCHDOWN CONFIRMED':'APPROACH INTERRUPTED';
    overlay.querySelector('p').textContent=paused?'Your ship is holding position.':phase==='ready'?'Center. Level. Gently.':phase==='landed'?'A little signal, just for you.':'One more attempt?';
    status.textContent=paused?'Paused. Resume when you are ready.':phase==='flying'?'Hold ↑ to brake. Use ↓ to descend; keep the ship level.':phase==='ready'?'Touch down centered, with tilt ≤ 8° and descent ≤ 1.8 m/s.':sim.state.reason;
    startButton.hidden=phase==='flying'&&!paused;
    startButton.textContent=paused?'Resume flight ↗':phase==='ready'?'Begin descent ↘':phase==='landed'?'Fly again ↗':'Retry landing ↗';
    pauseButton.hidden=phase!=='flying'||paused;
    controls.forEach(b=>b.disabled=phase==='crashed'||phase==='landed');
    paint();
  }
  function stopFrame(){cancelAnimationFrame(frame);frame=0;clearInput();}
  function tick(now) {
    frame=0;if(!panel.open||paused||sim.state.phase!=='flying')return;
    const held=action=>keys.has(action)||touches.has(action);
    sim.step(Math.min((now-last)/1000,.05),{tilt:Number(held('right'))-Number(held('left')),thrust:Number(held('up'))-Number(held('down'))});last=now;
    trail.push({x:sim.state.x,y:sim.state.y});if(trail.length>28)trail.shift();paint();
    if(sim.state.phase==='flying')frame=requestAnimationFrame(tick);
    else {stopFrame();sync();startButton.focus({preventScroll:true});if(sim.state.phase==='landed'&&!winSent){winSent=true;onWin();}}
  }
  function run() {if(!frame&&panel.open&&!paused&&sim.state.phase==='flying'){last=performance.now();frame=requestAnimationFrame(tick);}}
  function begin() {
    if(!panel.open)return;
    if(!paused){sim.reset();sim.start();trail=[];winSent=false;}
    paused=false;sync();pauseButton.focus({preventScroll:true});run();
  }
  function pause() {if(panel.open&&sim.state.phase==='flying'&&!paused){paused=true;stopFrame();sync();startButton.focus({preventScroll:true});}}
  function nudge(action) {
    if(sim.state.phase==='ready'||paused)begin();
    sim.adjust(action);paint();
  }
  function close() {if(!panel.open)return;stopFrame();panel.close();paused=false;previousFocus?.focus({preventScroll:true});}
  startButton.addEventListener('click',begin);pauseButton.addEventListener('click',pause);
  panel.querySelector('.lander-close').addEventListener('click',close);
  panel.addEventListener('cancel',event=>{event.preventDefault();close();});
  panel.addEventListener('close',stopFrame);
  panel.addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.stopPropagation();return;}
    const action=keyMap[event.key];
    if(action){event.preventDefault();event.stopPropagation();if(!event.repeat&&!keys.has(action)){nudge(action);keys.add(action);controls.find(b=>b.dataset.control===action)?.classList.add('is-held');}return;}
    if(event.code==='Space'&&event.target===startButton){event.preventDefault();if(!event.repeat)begin();}
  });
  panel.addEventListener('keyup',event=>{const action=keyMap[event.key];if(action){event.preventDefault();keys.delete(action);controls.find(b=>b.dataset.control===action)?.classList.remove('is-held');}});
  controls.forEach(button=>{
    const action=button.dataset.control;
    button.addEventListener('pointerdown',event=>{event.preventDefault();button.focus({preventScroll:true});button.setPointerCapture(event.pointerId);nudge(action);touches.add(action);button.classList.add('is-held');});
    const release=()=>{touches.delete(action);button.classList.remove('is-held');};
    button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',release);
    button.addEventListener('click',event=>{if(event.detail===0)nudge(action);});
  });
  window.addEventListener('blur',pause);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
  return {open(){if(panel.open)return;previousFocus=document.activeElement;stopFrame();sim.reset();trail=[];winSent=false;paused=false;panel.showModal();sync();startButton.focus({preventScroll:true});},close,get isOpen(){return panel.open;}};
};
