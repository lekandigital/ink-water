import * as THREE from 'three';
import vertexShader from './shaders/Drawing.vert';
import fragmentShader from './shaders/AsciiWater.frag';
import {seededRandom} from './CaptureMode';

// ASCII Sharks supplies the visual reference: tall mono cells, cool shaded
// blocks, sparse edge glyphs and a few colored glints. This pass only reads the
// displayed water texture. It owns no simulation, impulses, clock or randomness.
const GLYPHS = " .',`:;t%SX8#@";
const ATLAS_CELL = 64;

export class AsciiWaterPresentation {
  static create(invalidate: () => void) {
    // Three.js allocates UUIDs with Math.random. Give presentation resources an
    // independent synchronous stream so they cannot shift seeded physical rain.
    const physicalRandom = Math.random;
    try {
      Math.random = seededRandom(0xa5c11);
      return new AsciiWaterPresentation(invalidate);
    } finally {
      Math.random = physicalRandom;
    }
  }
  enabled = new URLSearchParams(location.search).get('ascii') !== '0';
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly material: THREE.ShaderMaterial;
  private cellScale = 1;
  private width = 1;
  private height = 1;
  private pixelRatio = 1;

  private constructor(private readonly invalidate: () => void) {
    const atlas = document.createElement('canvas');
    atlas.width = ATLAS_CELL * GLYPHS.length;
    atlas.height = ATLAS_CELL;
    const context = atlas.getContext('2d');
    if (!context) throw new Error('The ASCII character atlas could not start.');
    context.fillStyle = '#fff';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.font = '600 46px ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace';
    for (let i = 0; i < GLYPHS.length; i++) {
      context.fillText(GLYPHS[i], (i + .5) * ATLAS_CELL, ATLAS_CELL * .53);
    }
    const texture = new THREE.CanvasTexture(atlas);
    texture.generateMipmaps = false;
    texture.minFilter = texture.magFilter = THREE.LinearFilter;
    this.material = new THREE.ShaderMaterial({
      vertexShader, fragmentShader, depthTest: false, depthWrite: false, toneMapped: false,
      uniforms: {
        glyphs: {value: texture}, glyphCount: {value: GLYPHS.length},
        water: {value: null}, sceneColor: {value: null},
        inverseViewProjection: {value: new THREE.Matrix4()}, eye: {value: new THREE.Vector3()},
        resolution: {value: new THREE.Vector2()}, cellSize: {value: new THREE.Vector2()},
        accents: {value: true}, phase: {value: 0}, caustics: {value: true},
      },
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    quad.frustumCulled = false;
    this.scene.add(quad);

    const toggle = document.getElementById('ascii-enabled') as HTMLInputElement;
    const quick = document.getElementById('toggle-ascii') as HTMLButtonElement;
    toggle.addEventListener('input', () => this.setEnabled(toggle.checked));
    quick.addEventListener('click', () => this.setEnabled(!this.enabled));
    const scale = document.getElementById('ascii-scale') as HTMLInputElement;
    scale.addEventListener('input', () => {
      this.cellScale = Number(scale.value);
      this.resize(this.width, this.height, this.pixelRatio);
      this.invalidate();
    });
    const accents = document.getElementById('ascii-accents') as HTMLInputElement;
    accents.addEventListener('input', () => {
      this.material.uniforms.accents.value = accents.checked;
      this.invalidate();
    });
    window.addEventListener('keydown', event => {
      if (event.key.toLowerCase() !== 'a' || event.repeat || event.isComposing ||
          event.ctrlKey || event.metaKey || event.altKey ||
          (event.target as Element)?.closest?.('input,textarea,select,[contenteditable="true"]')) return;
      event.preventDefault();
      this.setEnabled(!this.enabled);
    });
    this.setEnabled(this.enabled);
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    (document.getElementById('ascii-enabled') as HTMLInputElement).checked = enabled;
    document.getElementById('toggle-ascii')!.setAttribute('aria-pressed', String(enabled));
    document.body.classList.toggle('ascii-active', enabled);
    this.invalidate();
  }

  resize(width: number, height: number, pixelRatio: number) {
    this.width = width; this.height = height; this.pixelRatio = pixelRatio;
    const cellWidth = Math.round(THREE.MathUtils.clamp(Math.round(width / 124), 8, 13) * this.cellScale);
    const cellHeight = Math.round(cellWidth * 1.45);
    this.material.uniforms.resolution.value.set(width * pixelRatio, height * pixelRatio);
    this.material.uniforms.cellSize.value.set(cellWidth * pixelRatio, cellHeight * pixelRatio);
    document.getElementById('ascii-scale-value')!.textContent = `${cellWidth} × ${cellHeight} px`;
  }

  render(renderer: THREE.WebGLRenderer, water: THREE.Texture, sceneColor: THREE.Texture,
         inverseViewProjection: THREE.Matrix4, eye: THREE.Vector3, phase: number, caustics: boolean) {
    if (!this.enabled) return;
    const uniforms = this.material.uniforms;
    uniforms.water.value = water;
    uniforms.sceneColor.value = sceneColor;
    uniforms.inverseViewProjection.value.copy(inverseViewProjection);
    uniforms.eye.value.copy(eye);
    uniforms.phase.value = phase;
    uniforms.caustics.value = caustics;
    const target = renderer.getRenderTarget();
    renderer.setRenderTarget(null);
    renderer.render(this.scene, this.camera);
    renderer.setRenderTarget(target);
  }
}
