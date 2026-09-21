/* A small, local landing simulator. No storage, network, or background game loop. */
window.createLandingSimulation = function createLandingSimulation(random=Math.random) {
  const stepSize=1/120,gravity=22,engine=52;
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  let state,level,accumulated=0;
  function makeLevel() {
    const pad={x:126+random()*148,y:199+random()*14,half:38};
    pad.left=pad.x-pad.half;pad.right=pad.x+pad.half;
    const side=(outer,inner)=>{
      const span=inner-outer;
      return [0,.17,.34,.51,.69,.86,1].map((t,i)=>({x:outer+span*t,
        y:i===6?pad.y:pad.y-([16,52,89,37,66,18][i])*(.7+random()*.6)}));
    };
    const terrain=[...side(0,pad.left),...side(400,pad.right).reverse()];
    return {pad,terrain,sector:Math.floor(random()*65536).toString(16).padStart(4,'0').toUpperCase()};
  }
  function reset() {
    accumulated=0;level=makeLevel();
    const offset=(random()<.5?-1:1)*(25+random()*15);
    state={phase:'ready',x:level.pad.x+offset,y:32,vx:0,vy:3,angle:0,targetAngle:0,throttle:0,time:0,reason:'',impact:null};
  }
  function transform(points,s=state) {
    const c=Math.cos(s.angle),n=Math.sin(s.angle);
    return points.map(([x,y])=>({x:s.x+x*c-y*n,y:s.y+x*n+y*c}));
  }
  function feet(s=state){return transform([[-9,12],[9,12]],s);}
  function hull(s=state){return transform([[0,-16],[-5,-7],[-5,0],[-13,8],[-13,11],[-9,12],[-5,9],[5,9],[9,12],[13,11],[13,8],[5,0],[5,-7]],s);}
  function groundAt(x) {
    const points=level.terrain;
    if(x<=0)return points[0].y;
    for(let i=1;i<points.length;i++)if(x<=points[i].x){const a=points[i-1],b=points[i];return a.y+(b.y-a.y)*(x-a.x)/(b.x-a.x);}
    return points[points.length-1].y;
  }
  function clearance(s=state) {
    const body=hull(s);
    let gap=Math.min(...body.map(p=>groundAt(p.x)-p.y));
    // For two linear edges their smallest gap occurs at an endpoint. Include
    // terrain vertices under every hull edge, so narrow peaks cannot slip through.
    body.forEach((a,i)=>{
      const b=body[(i+1)%body.length];
      if(Math.abs(a.x-b.x)<1e-9)return;
      for(const p of level.terrain)if(p.x>Math.min(a.x,b.x)&&p.x<Math.max(a.x,b.x)){
        const y=a.y+(b.y-a.y)*(p.x-a.x)/(b.x-a.x);gap=Math.min(gap,p.y-y);
      }
    });
    return gap;
  }
  function setThrust(active){state.throttle=state.phase==='flying'&&active?1:0;}
  function adjust(control) {
    if(state.phase==='flying'&&(control==='left'||control==='right'))state.targetAngle=clamp(state.targetAngle+(control==='left'?-1:1)*Math.PI/45,-.85,.85);
  }
  function integrate(dt,input) {
    const old={...state};
    state.targetAngle=clamp(state.targetAngle+(input.tilt||0)*.9*dt,-.85,.85);
    state.angle+=(state.targetAngle-state.angle)*(1-Math.exp(-dt/.14));
    state.vx=(state.vx+Math.sin(state.angle)*engine*state.throttle*dt)*Math.exp(-.10*dt);
    state.vy=(state.vy+(gravity-Math.cos(state.angle)*engine*state.throttle)*dt)*Math.exp(-.025*dt);
    state.x+=state.vx*dt;state.y+=state.vy*dt;state.time+=dt;
    if(clearance()<=0) {
      const end={...state},interpolate=t=>{
        for(const key of ['x','y','vx','vy','angle'])state[key]=old[key]+(end[key]-old[key])*t;
      };
      let lo=0,hi=1;
      for(let i=0;i<14;i++){const t=(lo+hi)/2;interpolate(t);if(clearance()>0)lo=t;else hi=t;}
      interpolate(hi);
      const pad=level.pad,legs=feet();
      state.impact={x:state.x,vx:state.vx,vy:state.vy,angle:state.angle};
      const onPad=legs.every(p=>p.x>=pad.left+2&&p.x<=pad.right-2)&&Math.max(...legs.map(p=>p.y))>=pad.y-.02;
      const centered=Math.abs(state.x-pad.x)<=24;
      const levelled=Math.abs(state.angle)<=8*Math.PI/180;
      const slow=state.vy>=0&&state.vy<=18,steady=Math.abs(state.vx)<=10;
      state.phase=onPad&&centered&&levelled&&slow&&steady?'landed':'crashed';
      state.reason=!onPad?'Terrain impact. Stay clear of the ridges.':!centered?'Aim for the center of the landing pad.':!levelled?'Level the ship before touchdown.':!slow?'Too fast. Hold ↑ to brake earlier.':!steady?'Reduce sideways drift before landing.':'Perfect touchdown. Welcome home, Dong-Hyuk.';
      setThrust(false);
    } else if(state.x<-16||state.x>416||state.y<-35) {
      state.phase='crashed';state.reason='Outside the approach corridor. Try a gentler correction.';setThrust(false);
    }
  }
  reset();
  return {
    get state(){return state;},get level(){return level;},reset,feet,hull,groundAt,clearance,adjust,setThrust,
    start(){if(state.phase==='ready')state.phase='flying';},
    step(dt,input={}){
      if(state.phase!=='flying')return;
      setThrust(input.thrust===true);
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
  const sim=window.createLandingSimulation(),keys=new Map(),touches=new Map();
  const startButton=panel.querySelector('.lander-start'),pauseButton=panel.querySelector('.lander-pause');
  const status=panel.querySelector('.lander-status'),overlay=panel.querySelector('.lander-overlay');
  const controls=[...panel.querySelectorAll('[data-control]')];
  const readouts=Object.fromEntries([...panel.querySelectorAll('[data-readout]')].map(e=>[e.dataset.readout,e]));
  const keyMap={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up'};
  let frame=0,last=0,paused=false,previousFocus=null,winSent=false,trail=[];
  const stars=Array.from({length:38},(_,i)=>({x:(i*97+23)%400,y:(i*47+11)%180,r:i%4===0?1:.55}));
  function paint() {
    const s=sim.state,{pad,terrain,sector}=sim.level;
    ctx.setTransform(2,0,0,2,0,0);ctx.clearRect(0,0,400,240);
    const sky=ctx.createLinearGradient(0,0,0,240);sky.addColorStop(0,'#060f1b');sky.addColorStop(1,'#112b35');ctx.fillStyle=sky;ctx.fillRect(0,0,400,240);
    ctx.fillStyle='#b7d9dc66';for(const star of stars){ctx.beginPath();ctx.arc(star.x,star.y,star.r,0,Math.PI*2);ctx.fill();}
    ctx.strokeStyle='#8bb6bd13';ctx.lineWidth=.6;
    for(let x=0;x<=400;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,212);ctx.stroke();}
    for(let y=32;y<212;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(400,y);ctx.stroke();}
    ctx.setLineDash([2,5]);ctx.strokeStyle='#a8dfce45';ctx.beginPath();ctx.moveTo(pad.x,42);ctx.lineTo(pad.x,pad.y-10);ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle='#81a8ad';ctx.font='7px monospace';ctx.textAlign='left';ctx.fillText('SECTOR / '+sector,12,17);
    const rock=ctx.createLinearGradient(0,100,0,240);rock.addColorStop(0,'#4a626b');rock.addColorStop(.45,'#253d48');rock.addColorStop(1,'#0a1720');
    ctx.fillStyle=rock;ctx.beginPath();ctx.moveTo(0,240);for(const p of terrain)ctx.lineTo(p.x,p.y);ctx.lineTo(400,240);ctx.closePath();ctx.fill();
    // The illuminated skyline is the exact collision surface, including rock faces.
    ctx.strokeStyle='#a6b8b578';ctx.lineWidth=.8;ctx.beginPath();terrain.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();
    for(let i=1;i<terrain.length-1;i++){
      const p=terrain[i],a=terrain[i-1],b=terrain[i+1];
      if(p.y<a.y&&p.y<b.y){ctx.fillStyle='#b9c8c114';ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(b.x,b.y);ctx.lineTo(p.x+4,240);ctx.closePath();ctx.fill();ctx.strokeStyle='#bed1c421';ctx.beginPath();ctx.moveTo(p.x,p.y+4);ctx.lineTo(p.x-5,p.y+20);ctx.lineTo(p.x+3,p.y+32);ctx.stroke();}
    }
    const success=s.phase==='landed';ctx.shadowColor=success?'#a8ffe0':'#84c5c3';ctx.shadowBlur=success?16:8;
    ctx.fillStyle=success?'#c7ffdf':'#89bdb7';ctx.beginPath();ctx.ellipse(pad.x,pad.y+2,pad.half,4,0,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
    ctx.fillStyle='#d6f2e2';ctx.fillRect(pad.x-20,pad.y-2,40,2);ctx.fillStyle='#71978e';ctx.fillRect(pad.left+1,pad.y-1,4,2);ctx.fillRect(pad.right-5,pad.y-1,4,2);
    ctx.fillStyle='#81a8ad';ctx.font='7px monospace';ctx.textAlign='center';ctx.fillText('HOME / 00',pad.x,pad.y+18);
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
    const altitude=Math.max(0,sim.clearance()/10);
    readouts.altitude.textContent=altitude.toFixed(1)+' m';
    readouts.speed.textContent=(Math.max(0,s.vy)/10).toFixed(1)+' m/s';
    readouts.tilt.textContent=Math.round(s.angle*180/Math.PI)+'°';
    readouts.thrust.textContent=s.throttle?'ON':'OFF';
    panel.querySelector('.lander-engine-state').textContent=s.throttle?'ON':'OFF';
    readouts.speed.dataset.warning=String(s.vy>18);readouts.tilt.dataset.warning=String(Math.abs(s.angle)>8*Math.PI/180);
    panel.querySelector('.lander-throttle b').style.width=`${s.throttle*100}%`;
  }
  const held=action=>[...keys.values(),...touches.values()].includes(action);
  function updateInput(){sim.setThrust(held('up'));controls.forEach(b=>b.classList.toggle('is-held',held(b.dataset.control)));paint();}
  function clearInput(){keys.clear();touches.clear();updateInput();}
  function sync() {
    const phase=sim.state.phase;panel.dataset.state=paused?'paused':phase;
    canvas.setAttribute('aria-label',`Rocky landing field, sector ${sim.level.sector}. Landing pad at ${Math.round(sim.level.pad.x/4)}% from the left.`);
    overlay.hidden=phase==='flying'&&!paused;
    overlay.querySelector('span').textContent=paused?'FLIGHT PAUSED':phase==='ready'?'BRING IT HOME':phase==='landed'?'TOUCHDOWN CONFIRMED':'APPROACH INTERRUPTED';
    overlay.querySelector('p').textContent=paused?'Your ship is holding position.':phase==='ready'?'Center. Level. Gently.':phase==='landed'?'A little signal, just for you.':'One more attempt?';
    status.textContent=paused?'Paused. Resume when you are ready.':phase==='flying'?'Avoid the ridges. Hold ↑ to thrust; release to coast.':phase==='ready'?'Clear the terrain. Land centered: tilt ≤ 8°, descent ≤ 1.8 m/s.':sim.state.reason;
    startButton.hidden=phase==='flying'&&!paused;
    startButton.textContent=paused?'Resume flight ↗':phase==='ready'?'Begin descent ↘':phase==='landed'?'Fly again ↗':'Retry landing ↗';
    pauseButton.hidden=phase!=='flying'||paused;
    controls.forEach(b=>b.disabled=phase==='crashed'||phase==='landed');
    paint();
  }
  function stopFrame(){cancelAnimationFrame(frame);frame=0;clearInput();}
  function tick(now) {
    frame=0;if(!panel.open||paused||sim.state.phase!=='flying')return;
    sim.step(Math.min((now-last)/1000,.05),{tilt:Number(held('right'))-Number(held('left')),thrust:held('up')});last=now;
    trail.push({x:sim.state.x,y:sim.state.y});if(trail.length>28)trail.shift();paint();
    if(sim.state.phase==='flying')frame=requestAnimationFrame(tick);
    else {stopFrame();sync();startButton.focus({preventScroll:true});if(sim.state.phase==='landed'&&!winSent){winSent=true;onWin();}}
  }
  function run() {if(!frame&&panel.open&&!paused&&sim.state.phase==='flying'){last=performance.now();frame=requestAnimationFrame(tick);}}
  function begin() {
    if(!panel.open)return;
    if(!paused){if(sim.state.phase!=='ready')sim.reset();sim.start();trail=[];winSent=false;}
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
    if(event.key==='ArrowDown'){event.preventDefault();event.stopPropagation();return;}
    const code=event.code||event.key;
    const action=keyMap[event.key]||(['Space','Enter'].includes(code)?event.target.dataset.control:null);
    if(action){event.preventDefault();event.stopPropagation();if(!event.repeat&&!keys.has(code)){nudge(action);keys.set(code,action);updateInput();}return;}
    if(code==='Space'&&event.target===startButton){event.preventDefault();if(!event.repeat)begin();}
  });
  panel.addEventListener('keyup',event=>{const code=event.code||event.key;if(keys.has(code)){event.preventDefault();keys.delete(code);updateInput();}});
  controls.forEach(button=>{
    const action=button.dataset.control;
    button.addEventListener('pointerdown',event=>{
      if(event.button!==0||button.disabled)return;
      event.preventDefault();button.focus({preventScroll:true});button.setPointerCapture(event.pointerId);
      nudge(action);touches.set(event.pointerId,action);updateInput();
    });
    const release=event=>{touches.delete(event.pointerId);updateInput();};
    button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',release);
    button.addEventListener('click',event=>{if(event.detail===0&&action!=='up')nudge(action);});
  });
  window.addEventListener('blur',pause);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
  return {open(){if(panel.open)return;previousFocus=document.activeElement;stopFrame();sim.reset();trail=[];winSent=false;paused=false;panel.showModal();sync();startButton.focus({preventScroll:true});},close,get isOpen(){return panel.open;}};
};
