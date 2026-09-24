import * as THREE from 'three';
import type { FrameName, SpriteInfo } from '../data/sprites';

export type ActorAnim = 'idle' | 'attack' | 'hit' | 'victory' | 'defeat';

const loader = new THREE.TextureLoader();
const FRAMES: FrameName[] = ['hold', 'windup', 'strike'];

/**
 * 2Dスプライトを板ポリゴンで表示する役者。
 * 構え・振りかぶり・振り下ろしの3コマを切り替え、常にカメラ正面を向く（ビルボード）。
 */
export class SpriteActor {
  readonly root = new THREE.Group();
  private pivot = new THREE.Group();
  private plane: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private shadow: THREE.Mesh;
  private textures: Partial<Record<FrameName, THREE.Texture>> = {};
  private current: FrameName | null = null;
  private anim: ActorAnim = 'idle';
  private animT = 0;
  private basePos = new THREE.Vector3();
  private disposed = false;
  /** 1px あたりのワールド長 */
  private unit: number;
  private flipSign: number;
  private anchorX: number;
  private holdBottom: number;
  /** 攻撃時の突進方向（親空間） */
  attackVector = new THREE.Vector3(0, 0, 1);
  private phase = Math.random() * 10;

  constructor(
    private info: SpriteInfo,
    private opts: { face?: 'left' | 'right' | 'front'; floating?: boolean } = {},
  ) {
    const hold = info.frames.hold;
    this.unit = info.height / hold.h;
    this.anchorX = hold.ox + hold.ax * hold.w;
    this.holdBottom = hold.oy + hold.h;
    const want = opts.face ?? 'front';
    const flip = (want === 'right' && info.facing === 'left') || (want === 'left' && info.facing === 'right');
    this.flipSign = flip ? -1 : 1;

    const geo = new THREE.PlaneGeometry(1, 1);
    geo.translate(0, 0.5, 0);
    const mat = new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.04, depthWrite: false, side: THREE.DoubleSide });
    this.plane = new THREE.Mesh(geo, mat);
    this.plane.renderOrder = 2;
    this.plane.visible = false;
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
    const w = hold.w * this.unit;
    this.shadow.scale.set(Math.max(0.55, w * 0.7), Math.max(0.3, w * 0.26), 1);
    this.root.add(this.shadow);

    for (const f of FRAMES) {
      loader.load(info.frames[f].src, (tex) => {
        if (this.disposed) {
          tex.dispose();
          return;
        }
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 4;
        this.textures[f] = tex;
        if (f === 'hold' && !this.current) this.setFrame('hold');
      });
    }
  }

  /** コマを切り替える（足元の位置が揃うよう元シート座標で位置合わせ） */
  private setFrame(name: FrameName) {
    const tex = this.textures[name] ?? this.textures.hold;
    if (!tex) return;
    const used: FrameName = this.textures[name] ? name : 'hold';
    if (this.current === used) return;
    this.current = used;
    const f = this.info.frames[used];
    const u = this.unit;
    this.plane.material.map = tex;
    this.plane.material.needsUpdate = true;
    this.plane.scale.set(f.w * u * this.flipSign, f.h * u, 1);
    this.plane.position.x = (f.ox + f.w / 2 - this.anchorX) * u * this.flipSign;
    this.plane.position.y = (this.holdBottom - (f.oy + f.h)) * u;
    this.plane.visible = true;
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
    this.setFrame('hold');
  }

  dispose() {
    this.disposed = true;
    this.plane.geometry.dispose();
    for (const t of Object.values(this.textures)) t?.dispose();
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
    let sx = 1 - breath * 0.008;
    let sy = 1 + breath * 0.014;
    let lift = this.opts.floating ? 0.12 + Math.sin(tt * 1.8) * 0.1 : 0;
    const offset = new THREE.Vector3();
    let tint = 0;
    let opacity = 1;
    let frame: FrameName = 'hold';

    if (this.anim === 'attack') {
      // 振りかぶり → 踏み込んで振り下ろし → 構えに戻る
      if (t < 0.22) {
        const k = t / 0.22;
        frame = 'windup';
        offset.copy(this.attackVector).multiplyScalar(-0.12 * k);
        sx = 1 + 0.04 * k;
        sy = 1 - 0.03 * k;
      } else if (t < 0.42) {
        const k = (t - 0.22) / 0.2;
        const e = 1 - Math.pow(1 - k, 3);
        frame = 'strike';
        offset.copy(this.attackVector).multiplyScalar(-0.12 + 1.12 * e);
        lift += Math.sin(k * Math.PI) * 0.12;
      } else if (t < 0.62) {
        frame = 'strike';
        offset.copy(this.attackVector);
      } else if (t < 0.95) {
        const k = (t - 0.62) / 0.33;
        const e = k * k * (3 - 2 * k);
        offset.copy(this.attackVector).multiplyScalar(1 - e);
      } else {
        this.anim = 'idle';
      }
    } else if (this.anim === 'hit') {
      if (t < 0.6) {
        const k = t / 0.6;
        const knock = Math.sin(Math.min(1, k * 2.2) * Math.PI) * (1 - k);
        offset.copy(this.attackVector).normalize().multiplyScalar(-0.5 * knock);
        offset.x += Math.sin(k * 60) * 0.05 * (1 - k);
        tint = k < 0.55 ? Math.max(0, Math.sin(k * 32)) : 0;
      } else {
        this.anim = 'idle';
      }
    } else if (this.anim === 'victory') {
      const cycle = t % 0.8;
      frame = 'windup';
      lift += Math.sin((cycle / 0.8) * Math.PI) * 0.3;
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

    this.setFrame(frame);
    this.root.position.copy(this.basePos).add(offset);
    this.pivot.position.y = lift;
    this.pivot.scale.set(sx, sy, 1);
    (this.shadow.material as THREE.MeshBasicMaterial).opacity = 0.35 * (1 - Math.min(0.7, lift));
    const m = this.plane.material;
    m.opacity = opacity;
    if (tint > 0) m.color.setRGB(1, 1 - tint * 0.65, 1 - tint * 0.65);
    else m.color.set('#ffffff');
  }
}
