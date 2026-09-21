/* The renderer and all satellites share this orthographic 3D scene. */
window.createLatentPlanet = function createLatentPlanet(hero) {
  const surface = hero.querySelector('.space-planet-stage');
  if (!surface) return null;
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  surface.append(canvas);
  const gl = canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: false });
  const normalize = v => { const length = Math.hypot(...v); return v.map(n => n / length); };
  const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
  let scene, lastTime = 0, ready = false, textureReady = false;
  let program, locations, texture, ringTexture;
  function updateScene(seconds) {
    const normal = normalize([-.35, .84, .40]);
    scene.normal = normal;
    scene.axis = normalize([normal[1], -normal[0], 0]);
    scene.other = cross(normal, scene.axis);
  }
  function project(angle, radius = 2.12) {
    const point = scene.axis.map((v, i) => radius*(v*Math.cos(angle) + scene.other[i]*Math.sin(angle)));
    const disk = point[0]*point[0]+point[1]*point[1];
    return { x: scene.cx+point[0]*scene.scale, y: scene.cy-point[1]*scene.scale,
      z: point[2], occluded: disk < .99 && point[2] < Math.sqrt(1-disk),
      scale: .92 + point[2]*.07 };
  }
  const vertex = 'attribute vec2 position;void main(){gl_Position=vec4(position,0.,1.);}';
  const fragment = `
    precision highp float;
    uniform vec2 resolution, center;
    uniform float pixelsPerUnit, clock, hasTexture;
    uniform vec3 ringNormal, ringAxis, ringOther;
    uniform sampler2D clouds, ringProfile;
    const float PI=3.14159265359;
    float hash(float x){return fract(sin(x*127.1)*43758.5453);}
    float noise(float x){float i=floor(x),f=fract(x);return mix(hash(i),hash(i+1.),f*f*(3.-2.*f));}
    float ringDensity(float radius){
      return texture2D(ringProfile,vec2(clamp((radius-1.28)/1.14,0.,1.),.5)).a;
    }
    vec3 tonemap(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}
    void main(){
      vec2 p=(gl_FragCoord.xy-center)/pixelsPerUnit;
      vec3 light=normalize(vec3(-.85,.65,.72));
      float disk=dot(p,p),pixel=1./pixelsPerUnit;
      vec3 color=vec3(0.);float alpha=0.,front=-100.;
      if(disk<1.){
        front=sqrt(1.-disk);vec3 n=vec3(p,front);
        float latitude=asin(clamp(dot(n,ringNormal),-1.,1.));
        float longitude=atan(dot(n,ringOther),dot(n,ringAxis));
        // Differential winds shear cloud bands while small eddies evolve locally.
        float wind=.0105+.0035*sin(latitude*8.);
        float drift=clock*wind;
        float eddy=.004*sin(longitude*11.-clock*.19)*cos(latitude*17.+clock*.07);
        vec2 uv=vec2(fract(longitude/(2.*PI)+.5+drift+eddy),latitude/PI+.5);
        uv.y+=.0025*sin(longitude*9.+clock*.12)*cos(latitude*13.-clock*.06);
        vec3 tex=mix(texture2D(clouds,vec2(fract(uv.x+.5),uv.y)).rgb,texture2D(clouds,uv).rgb,smoothstep(0.,.08,min(uv.x,1.-uv.x)));
        float fallback=.5+.2*sin(latitude*47.+noise(longitude*8.)*.8);
        tex=mix(mix(vec3(.12,.25,.28),vec3(.52,.61,.59),fallback),tex,hasTexture);
        vec3 albedo=pow(tex,vec3(2.2));
        float diffuse=max(dot(n,light),0.);
        float shadow=1.;
        float t=-dot(n,ringNormal)/dot(light,ringNormal);
        float shadowRadius=length(n+light*t);
        if(t>.015&&shadowRadius>1.28&&shadowRadius<2.42)shadow=1.-.72*ringDensity(shadowRadius);
        float limb=pow(1.-front,3.4);
        color=albedo*(.018+diffuse*1.2*shadow);
        color+=vec3(.045,.17,.21)*limb*pow(diffuse,.5);
        alpha=1.-smoothstep(1.-pixel*1.3,1.,sqrt(disk));
      }
      float z=-(p.x*ringNormal.x+p.y*ringNormal.y)/ringNormal.z;
      vec3 ringPoint=vec3(p,z);float radius=length(ringPoint);
      if(radius>1.28&&radius<2.42&&(disk>=1.||z>front)){
        float angle=atan(dot(ringPoint,ringOther),dot(ringPoint,ringAxis));
        float dust=.94+.06*noise(angle*160.+radius*730.-clock*.18);
        float density=ringDensity(radius)*dust;
        density*=smoothstep(1.28,1.28+pixel*3.,radius)*(1.-smoothstep(2.42-pixel*3.,2.42,radius));
        float b=dot(ringPoint,light),c=dot(ringPoint,ringPoint)-1.;
        float penumbra=smoothstep(.95,1.05,sqrt(max(0.,dot(ringPoint,ringPoint)-b*b)));
        float shadow=b<0.?mix(.08,1.,penumbra):1.;
        vec3 ice=texture2D(ringProfile,vec2((radius-1.28)/1.14,.5)).rgb;
        vec3 ringColor=pow(ice,vec3(2.2))*(.70+.48*abs(dot(ringNormal,light)))*shadow;
        ringColor+=vec3(.018,.04,.045)*pow(max(0.,sin(angle*157.-clock*.5+radius*531.)),28.)*shadow;
        float a=density*.9;
        color=(ringColor*a+color*alpha*(1.-a))/max(.001,a+alpha*(1.-a));alpha=a+alpha*(1.-a);
      }
      if(disk>1.){
        float glow=exp(-(sqrt(disk)-1.)*90.)*.34;
        float sun=max(0.,dot(normalize(vec3(p,.25)),light));
        glow*=sun;
        color=(color*alpha+vec3(.10,.34,.40)*glow*(1.-alpha))/max(.001,alpha+glow*(1.-alpha));alpha+=glow*(1.-alpha);
      }
      gl_FragColor=vec4(pow(tonemap(color),vec3(1./2.2)),alpha);
    }`;
  function compile(type, source) {
    const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader));
    return shader;
  }
  const cloudImage = new Image();
  function uploadTexture() {
    if(!ready||!cloudImage.complete||!cloudImage.naturalWidth)return;
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,cloudImage);
    gl.generateMipmap(gl.TEXTURE_2D);textureReady=true;
    canvas.dataset.texture='loaded';draw(lastTime);
  }
  function initialize() {
    if(!gl)return;
    try {
      const vs=compile(gl.VERTEX_SHADER,vertex),fs=compile(gl.FRAGMENT_SHADER,fragment);
      program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);
      gl.deleteShader(vs);gl.deleteShader(fs);
      if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
      gl.useProgram(program);
      const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
      gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
      const position=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
      locations=Object.fromEntries(['resolution','center','pixelsPerUnit','clock','hasTexture','ringNormal','ringAxis','ringOther','clouds','ringProfile'].map(name=>[name,gl.getUniformLocation(program,name)]));
      texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,1,1,0,gl.RGB,gl.UNSIGNED_BYTE,new Uint8Array([80,110,115]));
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.generateMipmap(gl.TEXTURE_2D);
      const anisotropic=gl.getExtension('EXT_texture_filter_anisotropic');
      if(anisotropic)gl.texParameterf(gl.TEXTURE_2D,anisotropic.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(8,gl.getParameter(anisotropic.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
      // A mipmapped radial optical-depth map keeps narrow ring bands free of shimmer.
      ringTexture=gl.createTexture();gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,ringTexture);
      const ringPixels=new Uint8Array(4096*4);
      const fract=n=>n-Math.floor(n), hash=n=>fract(Math.sin(n*127.1+71.7)*43758.5453);
      const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
      const noise=x=>{const i=Math.floor(x),f=fract(x);return hash(i)+(hash(i+1)-hash(i))*f*f*(3-2*f);};
      for(let i=0;i<4096;i++){
        const r=1.28+i/4095*1.14;
        const detail=.40*noise(r*71)+.24*noise(r*233)+.17*noise(r*701)+.09*noise(r*1709);
        const fine=.5+.5*Math.sin(r*911+noise(r*53)*7);
        let density=(.32+detail*.52+fine*.08)*smooth(1.28,1.33,r)*(1-smooth(2.37,2.42,r));
        density*=.30+.70*smooth(1.48,1.62,r);
        density*=1-.98*Math.exp(-Math.pow((r-1.96)*52,2));
        density*=1-.72*Math.exp(-Math.pow((r-2.27)*100,2));
        density*=1-.33*Math.exp(-Math.pow((r-2.13)*130,2));
        const warmth=noise(r*17), value=.43+detail*.25+fine*.035;
        ringPixels[i*4]=Math.round(255*value*(.91+.06*warmth));
        ringPixels[i*4+1]=Math.round(255*value*(.93-.04*warmth));
        ringPixels[i*4+2]=Math.round(255*value*(.88-.11*warmth));
        ringPixels[i*4+3]=Math.round(255*Math.min(1,density));
      }
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,4096,1,0,gl.RGBA,gl.UNSIGNED_BYTE,ringPixels);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.generateMipmap(gl.TEXTURE_2D);
      gl.activeTexture(gl.TEXTURE0);
      ready=true;textureReady=false;uploadTexture();resize();
      hero.classList.add('has-live-planet');canvas.dataset.renderer='webgl';
    }catch(error){ready=false;canvas.dataset.renderer='fallback';hero.classList.remove('has-live-planet');console.warn('Using the static Latent planet.',error.message);}
  }
  function draw(seconds) {
    lastTime=seconds;updateScene(seconds);
    if(!ready||gl.isContextLost())return;
    gl.useProgram(program);gl.uniform2f(locations.resolution,canvas.width,canvas.height);
    gl.uniform2f(locations.center,scene.cx*scene.ratio,(scene.height-scene.cy)*scene.ratio);
    gl.uniform1f(locations.pixelsPerUnit,scene.scale*scene.ratio);
    gl.uniform1f(locations.clock,seconds);gl.uniform1f(locations.hasTexture,textureReady?1:0);
    gl.uniform3fv(locations.ringNormal,scene.normal);gl.uniform3fv(locations.ringAxis,scene.axis);gl.uniform3fv(locations.ringOther,scene.other);
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);gl.uniform1i(locations.clouds,0);
    gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,ringTexture);gl.uniform1i(locations.ringProfile,1);
    gl.activeTexture(gl.TEXTURE0);gl.drawArrays(gl.TRIANGLES,0,3);
  }
  function resize() {
    const bounds=surface.getBoundingClientRect(),compact=window.innerWidth<=800;
    const ratio=Math.min(window.devicePixelRatio||1,1.75,2400/Math.max(1,bounds.width),Math.sqrt(2800000/Math.max(1,bounds.width*bounds.height)));
    scene={width:bounds.width,height:bounds.height,ratio,cx:bounds.width*(compact?.5:.705),cy:bounds.height*(compact?.46:.50),
      scale:Math.min(bounds.width*(compact?.205:.132),bounds.height*.37)};
    updateScene(lastTime);
    canvas.width=Math.max(1,Math.round(bounds.width*ratio));canvas.height=Math.max(1,Math.round(bounds.height*ratio));
    if(gl)gl.viewport(0,0,canvas.width,canvas.height);draw(lastTime);
  }
  cloudImage.onload=uploadTexture;
  cloudImage.src=new URL('space/latent-atmosphere.webp',document.currentScript?.src||new URL('assets/planet.js',document.baseURI)).href;
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();ready=false;hero.classList.remove('has-live-planet');canvas.dataset.renderer='fallback';});
  canvas.addEventListener('webglcontextrestored',initialize);
  resize();initialize();
  return {draw,resize,project,getScene:()=>scene};
};
