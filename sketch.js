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

// ---------- Fragment shader (BLACK bg + clean lines + Wii bluer + accent + AA) ----------
const fragShader = `#ifdef GL_ES
precision highp float;
#endif
// Enable smooth derivatives for anti-aliased lines (WebGL1)
#ifdef GL_OES_standard_derivatives
#extension GL_OES_standard_derivatives : enable
#endif

uniform vec2  iResolution;
uniform float iTime;

// THEME KNOBS
uniform float uTheme;   // 0=PS4, 1=Wii (bluer), 2=Xbox, 3=Steam, 4=Arcade
uniform float uSat;     // 0.7..1.3 typical
uniform float uHue;     // tiny phase nudge (-0.05..0.05)

// ACCENT (subtle red/purple in highlights)
uniform float uAccent;  // 0.0 = off, 0.10..0.25 tasteful

varying vec2 vTexCoord;

// ---------------- Palette: console-ish (IQ cosine style) ----------------
vec3 palette(float t){
    vec3 a0 = vec3(0.02, 0.04, 0.08), b0 = vec3(0.06, 0.18, 0.60), d0 = vec3(0.18, 0.32, 0.46); // PS4
    vec3 a1 = vec3(0.00, 0.00, 0.00), b1 = vec3(0.06, 0.18, 1.00), d1 = vec3(0.12, 0.32, 0.54); // Wii (bluer)
    vec3 a2 = vec3(0.00, 0.02, 0.02), b2 = vec3(0.05, 0.70, 0.45), d2 = vec3(0.18, 0.35, 0.30); // Xbox
    vec3 a3 = vec3(0.02, 0.03, 0.06), b3 = vec3(0.10, 0.18, 0.30), d3 = vec3(0.20, 0.32, 0.42); // Steam
    vec3 a4 = vec3(0.02, 0.00, 0.06), b4 = vec3(0.35, 0.10, 0.70), d4 = vec3(0.18, 0.38, 0.60); // Arcade

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

    // subtle magenta/purple accent only in highlights
    float breath = 0.85 + 0.15 * sin(t * 0.25);
    float hi = smoothstep(0.72, 0.98, L);
    vec3 ARCADE = vec3(0.95, 0.18, 0.55);
    col = mix(col, ARCADE, hi * clamp(uAccent, 0.0, 1.0) * breath);

    return col;
}

// ---------------- Main ----------------
void main() {
  vec2 uv = vTexCoord * 2.0 - 1.0;                     // [-1,1]
  uv.x *= iResolution.x / iResolution.y;               // aspect

  vec2 uv0 = uv;
  vec3 finalColor = vec3(0.0);                         // starts black

  float t = iTime * 0.22;                              // elegant speed

  for (float i = 0.0; i < 4.0; i++) {
    uv = fract(uv * 1.5) - 0.5;                        // core pattern warp
    float d = length(uv) * exp(-length(uv0));

    vec3 col = palette(length(uv0) + i*0.40 + t*0.35);

    d = sin(d*8.0 + t) / 8.0;
    d = abs(d) / 0.40;

    // ---- Anti-aliased 'tan' lines (no dotted rings, still crisp) ----
    float td = tan(d * 0.90);                          // tiny thickening
    #ifdef GL_OES_standard_derivatives
      float aaf = fwidth(td);                          // screen-space smoothing
    #else
      float aaf = 0.002;                               // safe fallback
    #endif
    float inten = pow(0.01 / (abs(td) + 2.5*aaf), 1.15);
    inten = max(inten - 0.012, 0.0);                   // kill haze -> true black bg

    finalColor += col * inten;                         // additive light only
  }

  gl_FragColor = vec4(clamp(finalColor, 0.0, 1.0), 1.0);
}
`;

// ---------- p5.js ----------
let theShader;

function setup() {
  // Fullscreen, fixed, behind content (avoids CSS scaling artifacts)
  const c = createCanvas(windowWidth, windowHeight, WEBGL);
  pixelDensity(Math.min(2, window.devicePixelRatio));  // sharper without going crazy
  noStroke();
  theShader = createShader(vertShader, fragShader);

  // Ensure derivatives extension is available (for AA)
  if (drawingContext && drawingContext.getExtension) {
    drawingContext.getExtension('OES_standard_derivatives');
  }

  // Pin the canvas behind the page content
  c.position(0, 0);
  c.style('position', 'fixed');
  c.style('left', '0');
  c.style('top', '0');
  c.style('z-index', '-1');
  c.style('pointer-events', 'none');
}

function draw() {
  // Hard black clear (prevents any startup flash)
  background(0);

  shader(theShader);

  // Core uniforms
  theShader.setUniform("iResolution", [width, height]);
  theShader.setUniform("iTime", millis() / 1000.0);

  // Theme — Wii bluer base + subtle arcade accent
  theShader.setUniform("uTheme", 1.0);   // 0=PS4, 1=Wii, 2=Xbox, 3=Steam, 4=Arcade
  theShader.setUniform("uSat",   1.10);
  theShader.setUniform("uHue",  -0.03);
  theShader.setUniform("uAccent", 0.18); // 0.10..0.25 = tasteful

  // Fullscreen quad
  rect(-width/2, -height/2, width, height);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}



