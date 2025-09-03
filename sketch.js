// ---------- Vertex shader (unchanged) ----------
const vertShader = `#ifdef GL_ES
precision highp float;
#endif
attribute vec3 aPosition;
attribute vec2 aTexCoord;
varying vec2 vTexCoord;
void main() {
  vTexCoord = aTexCoord;                             // pass-through
  vec4 positionVec4 = vec4(aPosition, 1.0);          // to vec4
  positionVec4.xy = positionVec4.xy * 2.0 - 1.0;     // NDC
  gl_Position = positionVec4;                        // draw
}`;

// ---------- Fragment shader (black bg + clean lines + bluer Wii + arcade accent + edge-ease) ----------
const fragShader = `#ifdef GL_ES
precision highp float;
#endif
uniform vec2 iResolution;
uniform float iTime;

// THEME KNOBS
uniform float uTheme;   // 0=PS4, 1=Wii (bluer), 2=Xbox, 3=Steam, 4=Arcade
uniform float uSat;     // 0.7..1.3 typical
uniform float uHue;     // small phase nudge (-0.05..0.05)

// ARCADE ACCENT
uniform float uAccent;  // 0.0 = off, 0.15 subtle, 0.30 stronger

varying vec2 vTexCoord;

// ---------------- Palette ----------------
vec3 palette(float t){
    // PS4
    vec3 a0 = vec3(0.02, 0.04, 0.08), b0 = vec3(0.06, 0.18, 0.60), d0 = vec3(0.18, 0.32, 0.46);
    // Wii (bluer)
    vec3 a1 = vec3(0.00, 0.00, 0.00), b1 = vec3(0.06, 0.18, 1.00), d1 = vec3(0.12, 0.32, 0.54);
    // Xbox
    vec3 a2 = vec3(0.00, 0.02, 0.02), b2 = vec3(0.05, 0.70, 0.45), d2 = vec3(0.18, 0.35, 0.30);
    // Steam/PC
    vec3 a3 = vec3(0.02, 0.03, 0.06), b3 = vec3(0.10, 0.18, 0.30), d3 = vec3(0.20, 0.32, 0.42);
    // Arcade (blue→violet)
    vec3 a4 = vec3(0.02, 0.00, 0.06), b4 = vec3(0.35, 0.10, 0.70), d4 = vec3(0.18, 0.38, 0.60);

    vec3 a=a0, b=b0, d=d0;
    if(uTheme > 0.5 && uTheme < 1.5){ a=a1; b=b1; d=d1; }
    else if(uTheme >= 1.5 && uTheme < 2.5){ a=a2; b=b2; d=d2; }
    else if(uTheme >= 2.5 && uTheme < 3.5){ a=a3; b=b3; d=d3; }
    else if(uTheme >= 3.5){ a=a4; b=b4; d=d4; }

    d += vec3(uHue);
    vec3 c = vec3(0.50, 0.72, 1.00);
    vec3 col = a + b * cos(6.28318*(c*t + d));

    // saturation toward luminance
    float L = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col = mix(vec3(L), col, clamp(uSat, 0.0, 2.0));

    // subtle magenta accent only in highlights
    float breath = 0.85 + 0.15 * sin(t * 0.25);
    float hi = smoothstep(0.72, 0.98, L);
    vec3 ARCADE = vec3(0.95, 0.18, 0.55);
    col = mix(col, ARCADE, hi * clamp(uAccent, 0.0, 1.0) * breath);

    return col;
}

// (helpers retained)
float ndot(vec2 a, vec2 b ){ return a.x*b.x - a.y*b.y; }
float sdRhombus( in vec2 p, in vec2 b ){
  p = abs(p);
  float h = clamp( ndot(b-2.0*p,b)/dot(b,b), -1.0, 1.0 );
  float d = length( p-0.5*b*vec2(1.0-h,1.0+h) );
  return d * sign( p.x*b.y + p.y*b.x - b.x*b.y );
}
float sdHexagram( in vec2 p, in float r ){
  const vec4 k = vec4(-0.5,0.8660254,0.5773503,1.7320508);
  p = abs(p);
  p -= 2.0*min(dot(k.xy,p),0.0)*k.xy;
  p -= 2.0*min(dot(k.yx,p),0.0)*k.yx;
  p -= vec2(clamp(p.x,r*k.z,r*k.w),r);
  return length(p)*sign(p.y);
}
float sdCircle( vec2 p, float r ){ return length(p) - r; }

// ---------------- Main ----------------
void main() {
  vec2 uv = vTexCoord * 2.0 - 1.0;   // [-1,1]
  uv.x *= iResolution.x / iResolution.y;

  vec2 uv0 = uv;
  vec3 finalColor = vec3(0.0);

  // base time
  float t = iTime * 0.22;

  // === Edge-ease phase: slow motion near the perimeter to avoid "speed-up" look ===
  float r = length(uv0);
  // starts easing around ~0.55 radius and reaches ~65% speed by the edges
  float edgeEase = mix(1.0, 0.65, smoothstep(0.55, 1.25, r));
  float phase = t * edgeEase;

  vec2 w = uv;
  for (float i = 0.0; i < 4.0; i++) {
    w = fract(w * 1.5) - 0.5;
    float d = length(w) * exp(-length(uv0));

    vec3 col = palette(length(uv0) + i*0.40 + phase*0.35);

    d = sin(d*8.0 + phase) / 8.0;   // <<< use eased phase
    d = abs(d) / 0.40;

    float td = tan(d);
    float inten = pow(0.01 / max(abs(td), 1e-3), 1.20);
    inten = max(inten - 0.015, 0.0);

    finalColor += col * inten;      // background stays black where inten==0
  }

  gl_FragColor = vec4(clamp(finalColor, 0.0, 1.0), 1.0);
}
`;

// ---------- p5.js ----------
let theShader;

function setup() {
  createCanvas(windowWidth, windowHeight, WEBGL);
  pixelDensity(1);
  noStroke();
  theShader = createShader(vertShader, fragShader);
}

function draw() {
  shader(theShader);

  theShader.setUniform("iResolution", [width, height]);
  theShader.setUniform("iTime", millis() / 1000.0);

  // Wii bluer base + subtle arcade accent
  theShader.setUniform("uTheme", 1.0);
  theShader.setUniform("uSat",   1.10);
  theShader.setUniform("uHue",  -0.03);
  theShader.setUniform("uAccent", 0.18);

  rect(-width/2, -height/2, width, height);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}


