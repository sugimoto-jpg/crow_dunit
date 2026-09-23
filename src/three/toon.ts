import * as THREE from 'three';

// ============================================================
// アニメ/ドット絵風の見た目を作る共通ユーティリティ
//  - 3段階トゥーンシェーディング
//  - 法線押し出しによる輪郭線（インバーテッドハル）
// ============================================================

let gradient: THREE.DataTexture | null = null;

function gradientMap() {
  if (!gradient) {
    gradient = new THREE.DataTexture(new Uint8Array([110, 190, 255]), 3, 1, THREE.RedFormat);
    gradient.minFilter = THREE.NearestFilter;
    gradient.magFilter = THREE.NearestFilter;
    gradient.generateMipmaps = false;
    gradient.needsUpdate = true;
  }
  return gradient;
}

export type ToonParams = Partial<THREE.MeshToonMaterialParameters>;

export function toon(color: string | THREE.Color, opts: ToonParams = {}) {
  return new THREE.MeshToonMaterial({ color, gradientMap: gradientMap(), ...opts });
}

/** 金属パーツ：少し明るめ＋ほのかな自己発光でハイライト感を出す */
export function toonMetal(color: string) {
  const c = new THREE.Color(color);
  return toon(c, { emissive: c.clone().multiplyScalar(0.12) });
}

const OUTLINE_VERT = /* glsl */ `
  uniform float thickness;
  void main() {
    vec3 p = position + normalize(normal) * thickness;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;
const OUTLINE_FRAG = /* glsl */ `
  uniform vec3 color;
  void main() { gl_FragColor = vec4(color, 1.0); }
`;

export function outlineMaterial(color = '#24160f', thickness = 0.014) {
  return new THREE.ShaderMaterial({
    uniforms: { color: { value: new THREE.Color(color) }, thickness: { value: thickness } },
    vertexShader: OUTLINE_VERT,
    fragmentShader: OUTLINE_FRAG,
    side: THREE.BackSide,
  });
}

/**
 * root 配下の不透明メッシュに輪郭線を付ける。
 * 小さいパーツ（目のハイライト等）・透明/両面/発光のみのメッシュは除外。
 */
export function addOutlines(root: THREE.Object3D, color = '#24160f', thickness = 0.014) {
  const mat = outlineMaterial(color, thickness);
  const targets: THREE.Mesh[] = [];
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || o.userData.noOutline) return;
    const m = o.material as THREE.Material;
    if (!(m instanceof THREE.MeshToonMaterial)) return;
    if (m.transparent || m.side === THREE.DoubleSide) return;
    o.geometry.computeBoundingSphere();
    if ((o.geometry.boundingSphere?.radius ?? 0) < 0.03) return;
    targets.push(o);
  });
  for (const o of targets) {
    const line = new THREE.Mesh(o.geometry, mat);
    line.userData.isOutline = true;
    line.raycast = () => {};
    o.add(line);
  }
}
