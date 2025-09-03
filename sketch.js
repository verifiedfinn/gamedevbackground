// ---------- Vertex shader (unchanged) ----------
const vertShader = `#ifdef GL_ES
precision highp float;
#endif
attribute vec3 aPosition;
attribute vec2 aTexCoord;
varying vec2 vTexCoord;
void main() {
  vTexCoord = aTexCoord;
  vec4 positionVec4 = vec4(aPosition, 1.0);
  positionVec4.xy = positionVec4.xy * 2.0 - 1.0;
  gl_Position = positionVec4;
}`;

// ---------- Fragment shader (BLACK bg + same look + POP knobs) ----------
const fragShader = `#ifdef GL_ES
precision highp float;
#endif
uniform vec2 iResolution;
uniform float iTime;

// THEME
uniform float uTheme;   // 0=PS4, 1=Wii, 2=Xbox, 3=Steam, 4=Arcade
uniform float uSat;     // 0.7..1.3
uniform float uHue;     // -0.05..0.05

// ACCENT
uniform float uAccent;  // 0.0..0.3

// FILL / COVERAGE
uniform float uZoom;    // <1 = bigger features
uniform float uTile;    // 1.2..2.0
uniform float uThin;    // 0.7..1.2  ( <1 = thicker )
uniform float uBias;    // 0.008..0.020 haze cut (lower = more fill)

// POP (new)
uniform float uGain;    // 1.0..1.6  brightness boost before clamp
uniform float uGamma;   // 0.85..0.95 midtone pop ( <1 brightens )

varying vec2 vTexCoord;

// -------- Palette (console-themed) --------
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

// -------- Main --------
void main() {
  vec2 uv = vTexCoord * 2.0 - 1.0;
  uv.x *= iResolution.x / iResolution.y;

  // Fill more of the frame
  uv *= uZoom;

  vec2 uv0 = uv;
  vec3 finalColor = vec3(0.0);

  float t = iTime * 0.22;

  for (float i = 0.0; i < 4.0; i++) {
    uv = fract(uv * uTile) - 0.5;

    float d = length(uv) * exp(-length(uv0));
    vec3 col = palette(length(uv0) + i*0.40 + t*0.35);

    d = sin(d*8.0 + t) / 8.0;
    d = abs(d) / 0.40;

    // same crisp 'tan' look, but controllable thickness
    float td = tan(d * uThin);

    float inten = pow(0.01 / max(abs(td), 1e-3), 1.20);
    inten = max(inten - uBias, 0.0); // pure black where no light

    finalColor += col * inten;
  }

  // POP: simple gain + gamma (keeps black at 0, boosts mid/highs)
  finalColor = pow(max(finalColor * uGain, 0.0), vec3(uGamma));

  gl_FragColor = vec4(clamp(finalColor, 0.0, 1.0), 1.0);
}
`;

// ---------- p5.js ----------
let theShader;

function setup() {
  createCanvas(windowWidth, windowHeight, WEBGL);
  pixelDensity(1); // keep exactly like your site for the same look
  noStroke();
  theShader = createShader(vertShader, fragShader);
}

function draw() {
  shader(theShader);

  theShader.setUniform("iResolution", [width, height]);
  theShader.setUniform("iTime", millis() / 1000.0);

  // --- Wii-bluer + arcade feel (hotter) ---
  theShader.setUniform("uTheme",   1.0);
  theShader.setUniform("uSat",     1.26); // bump saturation
  theShader.setUniform("uHue",    -0.02);
  theShader.setUniform("uAccent",  0.22);

  // --- Fill / coverage (fuller frame) ---
  theShader.setUniform("uZoom", 0.82);   // 0.78–0.88
  theShader.setUniform("uTile", 1.72);   // 1.60–1.85
  theShader.setUniform("uThin", 0.84);   // 0.80 thicker, 1.00 thinner
  theShader.setUniform("uBias", 0.010);  // lower = more glow but still black bg

  // --- POP (the missing heat) ---
  theShader.setUniform("uGain",  1.35);  // 1.20–1.50
  theShader.setUniform("uGamma", 0.90);  // 0.85–0.95 brightens mids

  rect(-width/2, -height/2, width, height);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}





