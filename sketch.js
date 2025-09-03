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

// ---------- Fragment shader (black bg + clean lines + bluer Wii + arcade accent) ----------
const fragShader = `#ifdef GL_ES
precision highp float;
#endif
uniform vec2 iResolution;
uniform float iTime;

// THEME KNOBS
uniform float uTheme;   // 0=PS4, 1=Wii (bluer), 2=Xbox, 3=Steam, 4=Arcade
uniform float uSat;     // 0.7..1.3 typical
uniform float uHue;     // small phase nudge (-0.05..0.05)

// ARCADE ACCENT (new)
uniform float uAccent;  // 0.0 = off, 0.15 subtle, 0.30 stronger

varying vec2 vTexCoord;

// ---------------- Palette: themeable console colors (IQ cosine style) ----------------
vec3 palette(float t){
    // PS4: deep navy + electric blue
    vec3 a0 = vec3(0.02, 0.04, 0.08), b0 = vec3(0.06, 0.18, 0.60), d0 = vec3(0.18, 0.32, 0.46);
    // Wii (BLUER): airy light-blue, reduced green
    vec3 a1 = vec3(0.00, 0.00, 0.00);
    vec3 b1 = vec3(0.06, 0.18, 1.00);   // ↓G, ↑B  (less green, more light blue)
    vec3 d1 = vec3(0.12, 0.32, 0.54);   // phase nudged toward blue
    // Xbox: teal-leaning blue/green
    vec3 a2 = vec3(0.00, 0.02, 0.02), b2 = vec3(0.05, 0.70, 0.45), d2 = vec3(0.18, 0.35, 0.30);
    // Steam/PC: desaturated blue-gray
    vec3 a3 = vec3(0.02, 0.03, 0.06), b3 = vec3(0.10, 0.18, 0.30), d3 = vec3(0.20, 0.32, 0.42);
    // Arcade (tasteful): blue with a hint of violet
    vec3 a4 = vec3(0.02, 0.00, 0.06), b4 = vec3(0.35, 0.10, 0.70), d4 = vec3(0.18, 0.38, 0.60);

    vec3 a = a0, b = b0, d = d0; // default PS4
    if(uTheme > 0.5 && uTheme < 1.5){ a=a1; b=b1; d=d1; }
    else if(uTheme >= 1.5 && uTheme < 2.5){ a=a2; b=b2; d=d2; }
    else if(uTheme >= 2.5 && uTheme < 3.5){ a=a3; b=b3; d=d3; }
    else if(uTheme >= 3.5){ a=a4; b=b4; d=d4; }

    // tiny hue nudge (phase shift)
    d += vec3(uHue);

    // cosine palette
    vec3 c = vec3(0.50, 0.72, 1.00);
    vec3 col = a + b * cos(6.28318*(c*t + d));

    // saturation control toward luminance
    float L = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col = mix(vec3(L), col, clamp(uSat, 0.0, 2.0));

    // ---- subtle arcade magenta accent in bright parts only (NEW) ----
    // breathe slowly to feel alive, not Tron
    float breath = 0.85 + 0.15 * sin(t * 0.25);
    float L2 = dot(col, vec3(0.2126, 0.7152, 0.0722));
    float hi = smoothstep(0.72, 0.98, L2); // only highlights
    vec3 ARCADE = vec3(0.95, 0.18, 0.55);  // magenta/purple accent
    col = mix(col, ARCADE, hi * clamp(uAccent, 0.0, 1.0) * breath);

    return col;
}

// ---------------- (Original helpers kept for completeness) ----------------
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
  vec2 uv = vTexCoord * 2.0 - 1.0;                     // [-1,1]
  const float scale = 1.0;
  uv.x *= scale * iResolution.x / iResolution.y;       // aspect
  uv.y *= scale;

  vec2 uv0 = uv;
  vec3 finalColor = vec3(0.0);                         // stays black unless lit

  // slower motion for elegance
  float t = iTime * 0.22;

  for (float i = 0.0; i < 4.0; i++) {
    uv = fract(uv * 1.5) - 0.5;
    float d = length(uv) * exp(-length(uv0));

    // THEMED colors (bluer Wii + subtle arcade accent)
    vec3 col = palette(length(uv0) + i*0.40 + t*0.35);

    // same modulation as the original
    d = sin(d*8.0 + t) / 8.0;
    d = abs(d) / 0.40;

    // CLEAN, SHARP LINES: original tan look, but safe (no NaNs)
    float td = tan(d);
    float inten = pow(0.01 / max(abs(td), 1e-3), 1.20);

    // remove haze so the background remains truly black
    inten = max(inten - 0.015, 0.0); // tweak 0.010–0.025 for crispness

    finalColor += col * inten; // additive only -> bg stays black
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

  // Core uniforms
  theShader.setUniform("iResolution", [width, height]);
  theShader.setUniform("iTime", millis() / 1000.0);

  // THEME CONTROLS — Wii bluer base
  theShader.setUniform("uTheme", 1.0);  // 0=PS4, 1=Wii, 2=Xbox, 3=Steam, 4=Arcade
  theShader.setUniform("uSat",   1.10);
  theShader.setUniform("uHue",  -0.03);

  // NEW: subtle red/purple arcade accent
  theShader.setUniform("uAccent", 0.18); // try 0.10..0.25

  rect(-width/2, -height/2, width, height);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

