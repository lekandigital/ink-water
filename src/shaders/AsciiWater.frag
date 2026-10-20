// Presentation only. The source height/velocity/normal texture is read-only.
precision highp float;
uniform sampler2D water;
uniform sampler2D sceneColor;
uniform sampler2D glyphs;
uniform float glyphCount;
uniform vec2 resolution;
uniform vec2 cellSize;
uniform mat4 inverseViewProjection;
uniform vec3 eye;
uniform float phase;
uniform bool accents;
uniform bool caustics;
varying vec2 coord;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

vec4 stateAt(vec2 uv) {
  vec4 world = inverseViewProjection * vec4(uv * 2.0 - 1.0, 0.0, 1.0);
  vec3 ray = normalize(world.xyz / world.w - eye);
  vec2 p = (eye + ray * (-eye.y / ray.y)).xz;
  vec2 waterUV = p * .5 + .5;
  // Manual bilinear filtering also works on devices without float filtering.
  const vec2 delta = vec2(1.0 / 256.0);
  vec2 q = clamp(waterUV, delta * .5, 1.0 - delta * .5) / delta - .5;
  vec2 f = fract(q), a = (floor(q) + .5) * delta;
  return mix(mix(texture2D(water, a), texture2D(water, a + vec2(delta.x, 0)), f.x),
             mix(texture2D(water, a + vec2(0, delta.y)), texture2D(water, a + delta), f.x), f.y);
}

float activity(vec4 s) {
  return length(s.ba) * 22.0 + abs(s.r) * 160.0 + abs(s.g) * 38.0;
}

vec3 accent(float key) {
  if (key < .14) return vec3(.88, .54, .17);
  if (key < .28) return vec3(.88, .23, .20);
  if (key < .42) return vec3(.71, .29, .88);
  if (key < .56) return vec3(.20, .78, .80);
  if (key < .70) return vec3(.24, .71, .29);
  if (key < .84) return vec3(.19, .31, .91);
  return vec3(.85, .76, .29);
}

void main() {
  vec2 pixel = coord * resolution;
  vec2 cell = floor(pixel / cellSize);
  vec2 local = fract(pixel / cellSize);
  vec2 center = (cell + .5) * cellSize / resolution;
  vec4 s = stateAt(center);
  // Four sub-cell reads preserve narrow ripples as they cross the character grid.
  vec2 d = cellSize / resolution * .30;
  float energy = activity(s);
  energy = max(energy, activity(stateAt(center + vec2(d.x, d.y))));
  energy = max(energy, activity(stateAt(center + vec2(-d.x, d.y))));
  energy = max(energy, activity(stateAt(center + vec2(d.x, -d.y))));
  energy = max(energy, activity(stateAt(center - d)));
  float body = smoothstep(.035, .32, energy);
  float strength = 1.0 - exp(-energy * 1.8);
  float light = clamp(.52 + dot(s.ba, vec2(-2.2, 3.2)), .0, 1.0);
  vec3 lit = texture2D(sceneColor, center).rgb;
  float luma = dot(lit, vec3(.2126, .7152, .0722));
  float focus = caustics ? smoothstep(.58, 1.65, luma) * strength : 0.0;

  // One device pixel of dark grid around each cell, as in ASCII Sharks.
  vec2 edge = min(local, 1.0 - local) * cellSize;
  float interior = smoothstep(.55, 1.25, min(edge.x, edge.y));
  vec3 color = vec3(.025) * (1.0 - interior);
  float shade = (.13 + .48 * light + .18 * focus) * strength;
  color = mix(color, vec3(shade * .92, shade * .97, shade * 1.06), body * interior);

  float key = hash(cell);
  float jitter = floor(hash(cell + 19.0) * 3.0) - 1.0;
  float denseGlyph = 5.0 + clamp(floor((1.0 - light) * 8.99) + jitter, 0.0, 8.0);
  float edgeGlyph = 1.0 + floor(hash(cell + 8.0) * 4.0);
  float glyph = energy < .18 ? edgeGlyph : denseGlyph;
  vec2 glyphUV = vec2((glyph + .13 + local.x * .74) / glyphCount, .08 + local.y * .84);
  float mask = texture2D(glyphs, glyphUV).a;
  vec3 ink = energy < .18 ? vec3(.48, .54, .61) : vec3(.055, .06, .08);
  float roll = hash(cell + floor(phase * 2.4 + key * 10.0));
  if (accents && roll < .09) ink = accent(hash(cell + 37.0));
  else if (roll < .13) ink = vec3(.92, .95, 1.0);
  color = mix(color, ink, mask * body);

  // A small cyan wake dot lives in the low-right corner of active cells.
  float wake = smoothstep(.08, .3, energy) * (1.0 - smoothstep(.25, .65, energy));
  vec2 dotDistance = abs(local - vec2(.66, .36)) * cellSize;
  float dotMask = 1.0 - smoothstep(1.0, 1.75, max(dotDistance.x, dotDistance.y));
  vec3 wakeInk = accents ? vec3(.43, .90, 1.0) : vec3(.7, .75, .8);
  color = mix(color, wakeInk, dotMask * wake * .65);
  gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}
