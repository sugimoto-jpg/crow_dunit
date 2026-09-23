import * as THREE from 'three';
import type { SpriteInfo } from '../data/sprites';

export type ActorAnim = 'idle' | 'attack' | 'hit' | 'victory' | 'defeat';

const loader = new THREE.TextureLoader();

/**
 * 2Dスプライトを板ポリゴンで表示する役者。
 * 常にカメラ正面を向き（ビルボード）、待機・攻撃・被弾・勝利・撃破の動きを付ける。
 */
export class SpriteActor {
  readonly root = new THREE.Group();
  private pivot = new THREE.Group();
  private plane: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private shadow: THREE.Mesh;
  private anim: ActorAnim = 'idle';
  private animT = 0;
  private basePos = new THREE.Vector3();
  private disposed = false;
  /** 攻撃時の突進方向（親空間） */
  attackVector = new THREE.Vector3(0, 0, 1);
  private phase = Math.random() * 10;

  constructor(
    info: SpriteInfo,
    private opts: { face?: 'left' | 'right' | 'front'; scale?: number; floating?: boolean } = {},
  ) {
    const height = info.height * (opts.scale ?? 1);
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.translate(0, 0.5, 0);
    const mat = new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.04, depthWrite: false, side: THREE.DoubleSide });
    this.plane = new THREE.Mesh(geo, mat);
    this.plane.scale.set(height * 0.45, height, 1);
    this.plane.renderOrder = 2;
    this.pivot.add(this.plane);
    this.root.add(this.pivot);

    // 足元の丸い影
    this.shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.5, 24),
      new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.35, depthWrite: false }),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.012;
    this.shadow.renderOrder = 1;
    this.root.add(this.shadow);

    // 向きを揃える（元画像の向き → 希望の向き）
    const want = opts.face ?? 'front';
    const flip = (want === 'right' && info.facing === 'left') || (want === 'left' && info.facing === 'right');

    loader.load(info.src, (tex) => {
      if (this.disposed) {
        tex.dispose();
        return;
      }
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      mat.map = tex;
      mat.needsUpdate = true;
      const img = tex.image as { width: number; height: number };
      const aspect = img.width / img.height;
      this.plane.scale.set(height * aspect * (flip ? -1 : 1), height, 1);
      const w = height * aspect;
      this.shadow.scale.set(Math.max(0.55, w * 0.75), Math.max(0.3, w * 0.28), 1);
    });
  }

  setBasePosition(v: THREE.Vector3) {
    this.basePos.copy(v);
    this.root.position.copy(v);
  }

  play(anim: ActorAnim) {
    if (this.anim === 'defeat' && anim !== 'idle') return;
    this.anim = anim;
    this.animT = 0;
  }

  revive() {
    this.anim = 'idle';
    this.animT = 0;
    this.root.visible = true;
    this.plane.material.opacity = 1;
    this.plane.material.color.set('#ffffff');
  }

  dispose() {
    this.disposed = true;
    this.plane.geometry.dispose();
    this.plane.material.map?.dispose();
    this.plane.material.dispose();
    this.shadow.geometry.dispose();
    (this.shadow.material as THREE.Material).dispose();
  }

  /** @param yaw ステージの回転角。板を常にカメラへ向けるために打ち消す */
  update(dt: number, time: number, yaw: number) {
    this.animT += dt;
    const t = this.animT;
    const tt = time + this.phase;
    this.pivot.rotation.y = -yaw;

    // 待機：呼吸（縦に少し伸び縮み）＋浮遊
    const breath = Math.sin(tt * 2.4);
    let sx = 1 - breath * 0.01;
    let sy = 1 + breath * 0.018;
    let lean = 0;
    let lift = this.opts.floating ? 0.12 + Math.sin(tt * 1.8) * 0.1 : 0;
    const offset = new THREE.Vector3();
    let tint = 0;
    let opacity = 1;

    if (this.anim === 'attack') {
      // 溜め → 突進＆斬撃 → 帰還
      if (t < 0.16) {
        const k = t / 0.16;
        offset.copy(this.attackVector).multiplyScalar(-0.1 * k);
        sx = 1 + 0.08 * k;
        sy = 1 - 0.08 * k;
        lean = -0.12 * k;
      } else if (t < 0.36) {
        const k = (t - 0.16) / 0.2;
        const e = 1 - Math.pow(1 - k, 3);
        offset.copy(this.attackVector).multiplyScalar(e);
        sx = 0.92;
        sy = 1.08;
        lean = 0.22;
        lift += Math.sin(k * Math.PI) * 0.18;
      } else if (t < 0.72) {
        const k = (t - 0.36) / 0.36;
        const e = k * k * (3 - 2 * k);
        offset.copy(this.attackVector).multiplyScalar(1 - e);
        lean = 0.22 * (1 - e);
      } else {
        this.anim = 'idle';
      }
    } else if (this.anim === 'hit') {
      if (t < 0.6) {
        const k = t / 0.6;
        const knock = Math.sin(Math.min(1, k * 2.2) * Math.PI) * (1 - k);
        offset.copy(this.attackVector).normalize().multiplyScalar(-0.5 * knock);
        offset.x += Math.sin(k * 60) * 0.05 * (1 - k);
        lean = -0.35 * knock;
        tint = k < 0.55 ? Math.max(0, Math.sin(k * 32)) : 0;
      } else {
        this.anim = 'idle';
      }
    } else if (this.anim === 'victory') {
      const cycle = t % 0.8;
      lift += Math.sin((cycle / 0.8) * Math.PI) * 0.35;
      sy = 1 + Math.sin((cycle / 0.8) * Math.PI) * 0.05;
      if (t > 2.4) this.anim = 'idle';
    } else if (this.anim === 'defeat') {
      const k = Math.min(1, t / 1.1);
      offset.x += Math.sin(t * 40) * 0.04 * (1 - k);
      sx = 1 + k * 0.35;
      sy = 1 - k * 0.9;
      tint = Math.max(0, Math.sin(t * 25)) * (1 - k);
      opacity = 1 - k;
      if (k >= 1) this.root.visible = false;
    }

    this.root.position.copy(this.basePos).add(offset);
    this.pivot.position.y = lift;
    this.pivot.scale.set(sx, sy, 1);
    this.pivot.rotation.z = -lean * Math.sign(this.attackVector.x || 1);
    this.shadow.scale.x = Math.abs(this.shadow.scale.x);
    (this.shadow.material as THREE.MeshBasicMaterial).opacity = 0.35 * (1 - Math.min(0.7, lift));
    const m = this.plane.material;
    m.opacity = opacity;
    if (tint > 0) m.color.setRGB(1, 1 - tint * 0.65, 1 - tint * 0.65);
    else m.color.set('#ffffff');
  }
}
