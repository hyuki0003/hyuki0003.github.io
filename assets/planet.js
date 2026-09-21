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
  let program, locations, texture;
  function updateScene(seconds) {
    const normal = normalize([-.35 + .008*Math.sin(seconds*.055), .84, .415 + .008*Math.sin(seconds*.04)]);
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
    uniform sampler2D clouds;
    const float PI=3.14159265359;
    float hash(float x){return fract(sin(x*127.1)*43758.5453);}
    float noise(float x){float i=floor(x),f=fract(x);return mix(hash(i),hash(i+1.),f*f*(3.-2.*f));}
    float ringDensity(float radius){
      float radial=.32+.25*noise(radius*53.)+.20*noise(radius*137.)+.15*noise(radius*389.);
      float aa=1./pixelsPerUnit;
      radial+=.12*sin(radius*740.)*clamp(1.-aa*170.,0.,1.);
      radial*=smoothstep(1.28,1.33,radius)*(1.-smoothstep(2.31,2.42,radius));
      radial*=1.-.94*exp(-pow((radius-1.96)*52.,2.));
      radial*=1.-.65*exp(-pow((radius-2.27)*85.,2.));
      return radial;
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
        vec2 uv=vec2(fract(longitude/(2.*PI)+.5+clock*.004),latitude/PI+.5);
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
        float dust=.94+.06*sin(angle*93.-clock*.22+radius*130.);
        float density=ringDensity(radius)*dust;
        float b=dot(ringPoint,light),c=dot(ringPoint,ringPoint)-1.;
        float shadow=(b<0.&&b*b>c)? .11:1.;
        float band=noise(radius*95.)*.5+noise(radius*32.)*.5;
        vec3 ice=mix(vec3(.24,.32,.34),vec3(.63,.58,.47),band);
        vec3 ringColor=pow(ice,vec3(2.2))*(.65+.55*abs(dot(ringNormal,light)))*shadow;
        ringColor+=vec3(.035,.08,.085)*pow(max(0.,sin(angle*157.-clock*.5+radius*531.)),28.)*shadow;
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
    gl.bindTexture(gl.TEXTURE_2D,texture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
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
      locations=Object.fromEntries(['resolution','center','pixelsPerUnit','clock','hasTexture','ringNormal','ringAxis','ringOther','clouds'].map(name=>[name,gl.getUniformLocation(program,name)]));
      texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,1,1,0,gl.RGB,gl.UNSIGNED_BYTE,new Uint8Array([80,110,115]));
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.generateMipmap(gl.TEXTURE_2D);
      const anisotropic=gl.getExtension('EXT_texture_filter_anisotropic');
      if(anisotropic)gl.texParameterf(gl.TEXTURE_2D,anisotropic.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(8,gl.getParameter(anisotropic.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
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
    gl.drawArrays(gl.TRIANGLES,0,3);
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
