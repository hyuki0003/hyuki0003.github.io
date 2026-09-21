/* Analytic ray/sphere and ray/ring intersections. No external 3D dependency. */
window.createLatentPlanet = function createLatentPlanet(hero) {
  const surface = hero.querySelector('.space-planet-stage');
  if (!surface) return null;
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  const gl = canvas.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: false, powerPreference: 'low-power' });
  if (!gl) return null;
  const vertex = `attribute vec2 position; void main(){gl_Position=vec4(position,0.,1.);}`;
  const fragment = `
    precision highp float;
    uniform vec2 resolution;
    uniform vec2 center;
    uniform float clock;
    const float R=1.18;
    float hash(vec3 p){p=fract(p*.3183099+vec3(.11,.17,.13));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
    float noise(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);
      return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
      mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
    float fbm(vec3 p){float sum=0.,a=.5;for(int i=0;i<5;i++){sum+=a*noise(p);p=p*2.04+vec3(13.1,7.7,3.2);a*=.5;}return sum;}
    float sphere(vec3 ro,vec3 rd,float radius){float b=dot(ro,rd),c=dot(ro,ro)-radius*radius,h=b*b-c;if(h<0.)return 10000.;return -b-sqrt(h);}
    mat2 turn(float a){return mat2(cos(a),-sin(a),sin(a),cos(a));}
    void main(){
      vec2 uv=(gl_FragCoord.xy-resolution*center)/resolution.y;
      vec3 ro=vec3(0.,0.,4.8),rd=normalize(vec3(uv*2.2,-3.5));
      vec3 light=normalize(vec3(-1.1,.75,.55));
      float hit=sphere(ro,rd,R);
      vec3 color=vec3(0.);float alpha=0.;
      if(hit<1000.){
        vec3 p=ro+rd*hit,n=p/R,q=n;
        q.xz=turn(clock*.055)*q.xz;
        q.xy=turn(-.23)*q.xy;
        float turbulence=fbm(q*4.);
        float bands=sin(q.y*38.+turbulence*10.+fbm(q*14.)*2.8);
        float wisps=fbm(q*32.+vec3(turbulence*5.,0.,0.));
        float cloud=smoothstep(-.7,.95,bands*.6+(wisps-.5)*1.5);
        vec3 dark=vec3(.018,.064,.077),teal=vec3(.09,.23,.25),cream=vec3(.29,.42,.40);
        vec3 albedo=mix(dark,teal,cloud);
        albedo=mix(albedo,cream,pow(cloud,5.)*.56);
        float diffuse=max(dot(n,light),0.);
        float rim=pow(1.-max(dot(n,-rd),0.),3.5);
        color=albedo*(.045+1.2*pow(diffuse,1.15))+vec3(.26,.58,.64)*rim*pow(diffuse,.55)*.55;
        color+=vec3(.42,.55,.52)*pow(max(dot(reflect(-light,n),-rd),0.),32.)*.08;
        alpha=1.;
      }
      // A slowly precessing, inclined ring plane; particles move around the planet.
      vec3 normal=normalize(vec3(-.38+.02*sin(clock*.08),.87,.24+.025*sin(clock*.065)));
      float denominator=dot(rd,normal);
      if(abs(denominator)>.0001){
        float ringHit=-dot(ro,normal)/denominator;
        vec3 p=ro+rd*ringHit;float radius=length(p);
        if(ringHit>0.&&ringHit<hit&&radius>1.47&&radius<2.46){
          vec3 axis=normalize(cross(normal,vec3(0.,0.,1.))),other=cross(normal,axis);
          float angle=atan(dot(p,other),dot(p,axis));
          float grain=noise(vec3(radius*145.,cos(angle-clock*.085)*14.,sin(angle-clock*.085)*14.));
          float lines=.5+.5*sin(radius*390.+noise(vec3(radius*38.))*4.);
          float density=.30+.38*grain+.22*lines;
          density*=smoothstep(1.47,1.53,radius)*(1.-smoothstep(2.34,2.46,radius));
          density*=1.-.85*exp(-pow((radius-1.87)*37.,2.));
          density*=1.-.50*exp(-pow((radius-2.18)*65.,2.));
          float shadow=sphere(p+light*.01,light,R);
          float lit=shadow>0.&&shadow<1000.?.15:1.;
          vec3 ringColor=mix(vec3(.19,.26,.27),vec3(.64,.56,.40),grain*.65+lines*.35);
          ringColor*=lit*(.65+.25*abs(dot(normal,light)));
          float spark=pow(max(0.,sin(angle*43.-clock*.55+radius*55.)),40.)*.12*grain;
          ringColor+=vec3(.4,.65,.63)*spark;
          float a=density*.70;
          color=(ringColor*a+color*alpha*(1.-a))/max(.001,a+alpha*(1.-a));alpha=a+alpha*(1.-a);
        }
      }
      float distanceToRay=length(ro-rd*dot(ro,rd));
      if(hit>1000.&&distanceToRay>R){
        float glow=exp(-(distanceToRay-R)*37.)*.16;
        vec3 glowColor=vec3(.21,.48,.55);
        color=(color*alpha+glowColor*glow*(1.-alpha))/max(.001,alpha+glow*(1.-alpha));alpha+=glow*(1.-alpha);
      }
      gl_FragColor=vec4(pow(max(color,vec3(0.)),vec3(.87)),alpha);
    }`;
  let program, buffer, locations, alive = false, lastTime = 0;
  function shader(type, source) {
    const result = gl.createShader(type); gl.shaderSource(result, source); gl.compileShader(result);
    if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(result); gl.deleteShader(result); throw new Error(message);
    }
    return result;
  }
  function initialize() {
    try {
      const vs = shader(gl.VERTEX_SHADER, vertex), fs = shader(gl.FRAGMENT_SHADER, fragment);
      program = gl.createProgram(); gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program);
      gl.deleteShader(vs); gl.deleteShader(fs);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
      gl.useProgram(program); buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
      const attribute = gl.getAttribLocation(program, 'position'); gl.enableVertexAttribArray(attribute); gl.vertexAttribPointer(attribute, 2, gl.FLOAT, false, 0, 0);
      locations = Object.fromEntries(['resolution','center','clock'].map(name => [name,gl.getUniformLocation(program,name)]));
      alive = true; resize(); hero.classList.add('has-live-planet'); canvas.dataset.renderer = 'webgl';
    } catch (error) {
      alive = false; hero.classList.remove('has-live-planet'); canvas.dataset.renderer = 'fallback';
      console.warn('Using the static Latent planet fallback.', error.message);
    }
  }
  function draw(seconds) {
    lastTime = seconds;
    if (!alive || gl.isContextLost()) return;
    gl.useProgram(program); gl.uniform2f(locations.resolution, canvas.width, canvas.height);
    gl.uniform2f(locations.center, window.innerWidth <= 800 ? .54 : .76, .51);
    gl.uniform1f(locations.clock, seconds); gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
  function resize() {
    const rect = surface.getBoundingClientRect();
    const scale = Math.min(window.devicePixelRatio || 1, 1.25, 1100 / Math.max(1,rect.width));
    canvas.width = Math.max(1,Math.round(rect.width*scale)); canvas.height = Math.max(1,Math.round(rect.height*scale));
    gl.viewport(0,0,canvas.width,canvas.height); draw(lastTime);
  }
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault(); alive = false; hero.classList.remove('has-live-planet'); canvas.dataset.renderer = 'fallback';
  });
  canvas.addEventListener('webglcontextrestored', initialize);
  surface.append(canvas); initialize();
  return { draw, resize };
};
