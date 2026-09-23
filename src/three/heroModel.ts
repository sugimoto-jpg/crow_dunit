import * as THREE from 'three';
import type { Gender, Job, JobId } from '../data/types';
import { addOutlines, toon, toonMetal, type ToonParams } from './toon';

// ============================================================
// プロシージャル生成の勇者（アニメ調トゥーン＋輪郭線）
// 参考：ファンタジーRPGのドット絵キャラ（革ベスト・籠手・ブーツ・プレート鎧）
// 前方向 = ローカル +Z
// ============================================================

export type HeroAnim = 'idle' | 'attack' | 'hit' | 'victory';

type TopStyle = 'vest' | 'tunic' | 'plate' | 'robe' | 'coat';

interface Outfit {
  shirt: string;
  top: TopStyle;
  topColor: string;
  /** 上着の差し色（縁取り・前垂れ） */
  topTrim: string;
  pants: string;
  boots: string;
  gloves: string;
  leather: string;
  /** 女性用スカート色 */
  skirt: string;
  /** 女性のレッグウェア */
  stockings: string;
  /** 金属パーツ（肩当て・籠手・脛当て）の色。null = 金属なし */
  plate: string | null;
  hood: string | null;
}

/** 職業ごとの衣装（参考画像の配色に寄せる） */
const OUTFITS: Record<JobId, Outfit> = {
  villager: {
    shirt: '#e9dcc0', top: 'vest', topColor: '#7a4f2e', topTrim: '#5b3a22', pants: '#5c6440', boots: '#6b4428',
    gloves: '#7a5132', leather: '#5b3a22', skirt: '#7a5236', stockings: '#2e2a2e', plate: null, hood: null,
  },
  warrior: {
    shirt: '#e4d9c4', top: 'tunic', topColor: '#34497a', topTrim: '#6b4a2e', pants: '#3b3230', boots: '#5a3b24',
    gloves: '#6b4a2e', leather: '#6b4a2e', skirt: '#34497a', stockings: '#2b2b33', plate: '#b8c0cc', hood: null,
  },
  archer: {
    shirt: '#d9ceb4', top: 'tunic', topColor: '#3f6b3a', topTrim: '#6b4a2e', pants: '#4a3b2c', boots: '#5a3b24',
    gloves: '#6b4a2e', leather: '#6b4a2e', skirt: '#3f6b3a', stockings: '#3a3026', plate: null, hood: '#2f5530',
  },
  mage: {
    shirt: '#efe4cc', top: 'robe', topColor: '#9e2f2f', topTrim: '#efe4cc', pants: '#3a2a2a', boots: '#5a3b24',
    gloves: '#6b4a2e', leather: '#6b4a2e', skirt: '#9e2f2f', stockings: '#2b2b33', plate: null, hood: null,
  },
  paladin: {
    shirt: '#d9d9d9', top: 'plate', topColor: '#c9d0da', topTrim: '#2f4c8f', pants: '#2e3140', boots: '#b8c0cc',
    gloves: '#b8c0cc', leather: '#6b4a2e', skirt: '#2f4c8f', stockings: '#2e3140', plate: '#c9d0da', hood: null,
  },
  dragonKnight: {
    shirt: '#3a3a44', top: 'plate', topColor: '#4a4f5e', topTrim: '#8f2424', pants: '#23232c', boots: '#4a4f5e',
    gloves: '#4a4f5e', leather: '#3a2a20', skirt: '#8f2424', stockings: '#23232c', plate: '#5a6072', hood: null,
  },
  hero: {
    shirt: '#f1ead8', top: 'coat', topColor: '#2c56a8', topTrim: '#e8c14a', pants: '#2d2a33', boots: '#5a3b24',
    gloves: '#c9d0da', leather: '#6b4a2e', skirt: '#2c56a8', stockings: '#2d2a33', plate: '#d5dbe4', hood: null,
  },
};

const SKIN = '#f6d3b3';
const HAIR: Record<Gender, string> = { male: '#4a2e1c', female: '#6a4028' };
const IRIS: Record<Gender, string> = { male: '#5b7a3a', female: '#5a6f9a' };

export class HeroModel {
  readonly root = new THREE.Group();
  private body = new THREE.Group();
  private torso = new THREE.Group();
  private head = new THREE.Group();
  private armL = new THREE.Group();
  private armR = new THREE.Group();
  private legL = new THREE.Group();
  private legR = new THREE.Group();
  private cape: THREE.Mesh | null = null;
  private capeBase: Float32Array | null = null;
  private wings: THREE.Group | null = null;
  private ponytail: THREE.Group | null = null;
  private weaponGlow: THREE.Mesh | null = null;
  private flashMats = new Map<THREE.MeshToonMaterial, { c: THREE.Color; i: number }>();

  private anim: HeroAnim = 'idle';
  private animT = 0;
  /** 攻撃時の突進方向（root の親空間） */
  attackVector = new THREE.Vector3(0, 0, 1.2);
  private basePos = new THREE.Vector3();

  constructor(job: Job, gender: Gender) {
    this.root.add(this.body);
    this.build(job, gender);
    addOutlines(this.root);
  }

  setBasePosition(v: THREE.Vector3) {
    this.basePos.copy(v);
    this.root.position.copy(v);
  }

  play(anim: HeroAnim) {
    this.anim = anim;
    this.animT = 0;
  }

  dispose() {
    this.root.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        const m = o.material;
        if (Array.isArray(m)) m.forEach((x) => x.dispose());
        else m.dispose();
      }
    });
  }

  // ----------------------------------------------------------
  private mat(color: string, opts: ToonParams = {}) {
    const m = toon(color, opts);
    this.flashMats.set(m, { c: m.emissive.clone(), i: m.emissiveIntensity });
    return m;
  }
  private metal(color: string) {
    const m = toonMetal(color);
    this.flashMats.set(m, { c: m.emissive.clone(), i: m.emissiveIntensity });
    return m;
  }

  private put<T extends THREE.Object3D>(parent: THREE.Object3D, obj: T, x = 0, y = 0, z = 0): T {
    obj.position.set(x, y, z);
    obj.castShadow = true;
    parent.add(obj);
    return obj;
  }

  private mesh(geo: THREE.BufferGeometry, material: THREE.Material, noOutline = false) {
    const m = new THREE.Mesh(geo, material);
    m.castShadow = true;
    if (noOutline) m.userData.noOutline = true;
    return m;
  }

  private build(job: Job, gender: Gender) {
    const o = OUTFITS[job.id];
    const female = gender === 'female';
    const skin = this.mat(SKIN);
    const hair = this.mat(HAIR[gender]);
    const shirt = this.mat(o.shirt);
    const top = o.top === 'plate' ? this.metal(o.topColor) : this.mat(o.topColor);
    const topTrim = o.top === 'coat' ? this.metal(o.topTrim) : this.mat(o.topTrim);
    const leather = this.mat(o.leather);
    const pants = this.mat(female ? o.stockings : o.pants);
    const boots = o.plate && (job.id === 'paladin' || job.id === 'dragonKnight') ? this.metal(o.boots) : this.mat(o.boots);
    const gloves = o.plate && o.gloves === o.plate ? this.metal(o.gloves) : this.mat(o.gloves);
    const plate = o.plate ? this.metal(o.plate) : null;
    const gold = this.metal(job.palette.trim);

    // ================= 脚 =================
    const legGeo = new THREE.CapsuleGeometry(female ? 0.085 : 0.095, 0.42, 4, 10);
    for (const [leg, x] of [[this.legL, 0.12], [this.legR, -0.12]] as const) {
      leg.position.set(x, 0.8, 0);
      this.body.add(leg);
      this.put(leg, this.mesh(legGeo, pants), 0, -0.3, 0);
      // ロングブーツ＋折り返し
      this.put(leg, this.mesh(new THREE.CylinderGeometry(0.11, 0.1, 0.34, 12), boots), 0, -0.6, 0);
      this.put(leg, this.mesh(new THREE.CylinderGeometry(0.125, 0.12, 0.06, 12), boots), 0, -0.43, 0);
      this.put(leg, this.mesh(new THREE.BoxGeometry(0.17, 0.09, 0.26), boots), 0, -0.745, 0.05);
      if (plate && o.top === 'plate') {
        // 膝当て
        this.put(leg, this.mesh(new THREE.SphereGeometry(0.075, 10, 8), plate), 0, -0.36, 0.07);
      }
    }

    // ================= 胴体 =================
    this.torso.position.set(0, 0.8, 0);
    this.body.add(this.torso);
    const chestR = female ? 0.2 : 0.22;
    // インナー（シャツ）
    this.put(this.torso, this.mesh(new THREE.CylinderGeometry(chestR, chestR * 0.9, 0.56, 16), o.top === 'plate' ? top : shirt), 0, 0.3, 0);
    // 腰回り
    this.put(this.torso, this.mesh(new THREE.CylinderGeometry(chestR * 0.92, chestR * 1.05, 0.16, 16), female ? this.mat(o.skirt) : this.mat(o.pants)), 0, 0.02, 0);

    switch (o.top) {
      case 'vest': {
        // 前開きの革ベスト（開口部を正面に）
        const vest = new THREE.CylinderGeometry(chestR + 0.018, chestR * 0.92 + 0.02, 0.44, 18, 1, true, 0.55, Math.PI * 2 - 1.1);
        this.put(this.torso, this.mesh(vest, this.mat(o.topColor, { side: THREE.DoubleSide })), 0, 0.33, 0);
        // 女性は胸当て
        if (female) {
          const breast = this.mesh(new THREE.SphereGeometry(0.15, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), this.metal('#b9c0c9'));
          breast.rotation.x = Math.PI / 2;
          breast.scale.set(1.15, 0.45, 0.8);
          this.put(this.torso, breast, 0, 0.4, 0.13);
        } else {
          // 紐の編み上げ
          this.put(this.torso, this.mesh(new THREE.BoxGeometry(0.03, 0.2, 0.02), leather), 0, 0.48, chestR + 0.005);
        }
        break;
      }
      case 'tunic': {
        this.put(this.torso, this.mesh(new THREE.CylinderGeometry(chestR + 0.012, chestR * 0.92 + 0.012, 0.5, 16), top), 0, 0.31, 0);
        // 裾（太ももまで）
        this.put(this.torso, this.mesh(new THREE.CylinderGeometry(chestR * 1.02, chestR * 1.3, 0.3, 16, 1, true), this.mat(o.topColor, { side: THREE.DoubleSide })), 0, -0.1, 0);
        // 革のたすき掛け
        const strap = this.mesh(new THREE.TorusGeometry(chestR + 0.02, 0.022, 6, 24), leather);
        strap.rotation.set(Math.PI / 2, 0.6, 0);
        this.put(this.torso, strap, 0, 0.34, 0);
        break;
      }
      case 'plate': {
        // 胸甲の稜線
        this.put(this.torso, this.mesh(new THREE.BoxGeometry(0.04, 0.34, 0.04), top), 0, 0.36, chestR - 0.005);
        this.put(this.torso, this.mesh(new THREE.TorusGeometry(chestR + 0.01, 0.02, 6, 24), gold), 0, 0.55, 0).rotation.x = Math.PI / 2;
        // 前垂れ（タバード）
        const tabard = this.mesh(new THREE.BoxGeometry(0.2, 0.42, 0.02), this.mat(o.topTrim));
        this.put(this.torso, tabard, 0, -0.1, chestR + 0.02);
        // 草摺
        this.put(this.torso, this.mesh(new THREE.CylinderGeometry(chestR * 1.02, chestR * 1.28, 0.2, 16, 1, true), this.metal(o.plate ?? o.topColor)), 0, -0.07, 0).material.side = THREE.DoubleSide;
        break;
      }
      case 'robe': {
        this.put(this.torso, this.mesh(new THREE.CylinderGeometry(chestR + 0.015, chestR + 0.01, 0.5, 16), top), 0, 0.31, 0);
        // 足首までのローブ
        this.put(this.torso, this.mesh(new THREE.CylinderGeometry(chestR + 0.01, 0.34, 0.72, 18, 1, true), this.mat(o.topColor, { side: THREE.DoubleSide })), 0, -0.3, 0);
        // 前身頃の白い帯＋金の縁
        this.put(this.torso, this.mesh(new THREE.BoxGeometry(0.13, 1.05, 0.02), topTrim), 0, -0.02, chestR + 0.05).rotation.x = -0.1;
        this.put(this.torso, this.mesh(new THREE.TorusGeometry(chestR + 0.02, 0.018, 6, 24), gold), 0, 0.55, 0).rotation.x = Math.PI / 2;
        break;
      }
      case 'coat': {
        // 銀の胸当て＋前開きのロングコート
        this.put(this.torso, this.mesh(new THREE.CylinderGeometry(chestR + 0.01, chestR * 0.9, 0.4, 16), plate ?? top), 0, 0.36, 0);
        const coat = new THREE.CylinderGeometry(chestR + 0.03, 0.33, 0.95, 18, 1, true, 0.45, Math.PI * 2 - 0.9);
        this.put(this.torso, this.mesh(coat, this.mat(o.topColor, { side: THREE.DoubleSide })), 0, 0.1, 0);
        // 金の縁取り（前立て）
        for (const s of [1, -1]) {
          const edge = this.mesh(new THREE.BoxGeometry(0.03, 0.95, 0.03), gold);
          edge.rotation.z = s * 0.1;
          this.put(this.torso, edge, s * 0.1, 0.1, chestR + 0.05);
        }
        break;
      }
    }

    // ベルト＋バックル＋ポーチ
    const belt = this.mesh(new THREE.TorusGeometry(chestR * 0.95 + 0.012, 0.03, 6, 24), leather);
    belt.rotation.x = Math.PI / 2;
    this.put(this.torso, belt, 0, 0.08, 0);
    this.put(this.torso, this.mesh(new THREE.BoxGeometry(0.07, 0.06, 0.03), gold), 0, 0.08, chestR * 0.95 + 0.03);
    this.put(this.torso, this.mesh(new THREE.BoxGeometry(0.09, 0.1, 0.06), leather), -0.16, 0.0, 0.12);

    // 女性スカート（ベスト/チュニック時）
    if (female && (o.top === 'vest' || o.top === 'tunic')) {
      this.put(this.torso, this.mesh(new THREE.CylinderGeometry(chestR, 0.3, 0.26, 16, 1, true), this.mat(o.skirt, { side: THREE.DoubleSide })), 0, -0.1, 0);
    }

    // ================= 肩当て =================
    if (plate || job.hasShoulder) {
      const padMat = plate ?? leather;
      const padGeo = new THREE.SphereGeometry(0.12, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
      for (const x of [0.27, -0.27]) {
        const pad = this.mesh(padGeo, padMat);
        pad.scale.set(1.1, 0.75, 1.1);
        pad.rotation.z = x > 0 ? -0.35 : 0.35;
        this.put(this.torso, pad, x, 0.53, 0);
      }
    }
    // 襟
    this.put(this.torso, this.mesh(new THREE.CylinderGeometry(0.09, 0.13, 0.07, 12), o.top === 'plate' ? top : shirt), 0, 0.6, 0);

    // ================= 腕 =================
    const upperGeo = new THREE.CapsuleGeometry(0.062, 0.2, 4, 8);
    const foreGeo = new THREE.CapsuleGeometry(0.07, 0.14, 4, 8);
    const sleeve = o.top === 'plate' || o.top === 'robe' || o.top === 'coat' ? top : shirt;
    for (const [arm, x] of [[this.armL, 0.29], [this.armR, -0.29]] as const) {
      arm.position.set(x, 0.52, 0);
      this.torso.add(arm);
      this.put(arm, this.mesh(upperGeo, sleeve), 0, -0.14, 0);
      // 籠手（グローブ）
      this.put(arm, this.mesh(foreGeo, gloves), 0, -0.36, 0);
      this.put(arm, this.mesh(new THREE.CylinderGeometry(0.085, 0.08, 0.05, 10), gloves), 0, -0.27, 0);
      this.put(arm, this.mesh(new THREE.SphereGeometry(0.065, 10, 8), gloves), 0, -0.48, 0);
    }
    this.armL.rotation.z = 0.1;
    this.armR.rotation.z = -0.1;

    // ================= 頭 =================
    this.head.position.set(0, 0.62, 0);
    this.torso.add(this.head);
    this.put(this.head, this.mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.1, 8), skin), 0, 0.02, 0);
    const face = this.mesh(new THREE.SphereGeometry(0.235, 22, 18), skin);
    face.scale.set(1, 1.05, 0.98);
    this.put(this.head, face, 0, 0.24, 0);
    this.buildFace(gender);
    this.buildHair(gender, hair, job);
    // 耳
    for (const x of [0.225, -0.225]) this.put(this.head, this.mesh(new THREE.SphereGeometry(0.045, 8, 8), skin), x, 0.22, 0);

    // ---- 冠 / サークレット ----
    if (job.hasCrown) {
      const crown = new THREE.Group();
      this.put(crown, this.mesh(new THREE.TorusGeometry(0.24, 0.02, 6, 24), gold), 0, 0, 0).rotation.x = Math.PI / 2;
      const gem = this.mesh(new THREE.OctahedronGeometry(0.035), this.mat('#e8344f', { emissive: '#e8344f', emissiveIntensity: 0.7 }), true);
      this.put(crown, gem, 0, 0.02, 0.245);
      for (const s of [1, -1]) {
        const wing = this.mesh(new THREE.ConeGeometry(0.03, 0.12, 4), gold);
        wing.rotation.z = s * 1.1;
        this.put(crown, wing, s * 0.2, 0.05, 0.12);
      }
      crown.rotation.x = -0.18;
      this.put(this.head, crown, 0, 0.36, 0);
    } else if (job.id === 'paladin' || job.id === 'dragonKnight') {
      const circlet = this.mesh(new THREE.TorusGeometry(0.245, 0.016, 6, 24), gold);
      circlet.rotation.x = Math.PI / 2 - 0.2;
      this.put(this.head, circlet, 0, 0.34, 0.01);
    }

    // ================= マント / フード =================
    const capeColor = o.hood ?? (job.hasCape ? job.palette.cape : null);
    if (capeColor) {
      const geo = new THREE.PlaneGeometry(0.55, 1.0, 6, 10);
      geo.translate(0, -0.5, 0);
      const cape = new THREE.Mesh(geo, this.mat(capeColor, { side: THREE.DoubleSide }));
      cape.castShadow = true;
      cape.position.set(0, 0.58, -0.22);
      cape.rotation.x = 0.1;
      this.torso.add(cape);
      this.cape = cape;
      this.capeBase = Float32Array.from(geo.attributes.position.array as Float32Array);
      // マントの留め具
      for (const s of [1, -1]) this.put(this.torso, this.mesh(new THREE.SphereGeometry(0.035, 8, 8), gold), s * 0.16, 0.58, 0.12);
    }
    if (o.hood) {
      const hood = this.mesh(new THREE.SphereGeometry(0.27, 16, 12, 0, Math.PI * 2, Math.PI * 0.35, Math.PI * 0.5), this.mat(o.hood, { side: THREE.DoubleSide }));
      hood.rotation.x = 1.6;
      this.put(this.head, hood, 0, 0.14, -0.14);
    }

    // ================= 翼（ドラゴンナイト） =================
    if (job.hasWings) {
      this.wings = new THREE.Group();
      this.wings.position.set(0, 0.42, -0.26);
      this.torso.add(this.wings);
      const s = new THREE.Shape();
      s.moveTo(0, 0);
      s.lineTo(0.7, 0.45);
      s.lineTo(0.62, 0.1);
      s.lineTo(0.5, 0.18);
      s.lineTo(0.42, -0.1);
      s.lineTo(0.28, 0.02);
      s.lineTo(0.2, -0.2);
      s.lineTo(0, 0);
      const wGeo = new THREE.ShapeGeometry(s);
      const wMat = this.mat('#7a2020', { side: THREE.DoubleSide });
      for (const sx of [1, -1]) {
        const w = new THREE.Mesh(wGeo, wMat);
        w.scale.x = sx;
        w.rotation.y = sx * -0.5;
        w.castShadow = true;
        this.wings.add(w);
      }
    }

    this.buildWeapon(job, gold, leather);
  }

  private buildFace(gender: Gender) {
    const white = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    const iris = new THREE.MeshBasicMaterial({ color: IRIS[gender] });
    const pupil = new THREE.MeshBasicMaterial({ color: '#1a120e' });
    const lash = new THREE.MeshBasicMaterial({ color: '#241510' });
    for (const s of [1, -1]) {
      const eye = new THREE.Group();
      eye.position.set(s * 0.085, 0.22, 0.212);
      eye.rotation.y = s * 0.3;
      this.head.add(eye);
      const w = new THREE.Mesh(new THREE.CircleGeometry(0.045, 16), white);
      w.scale.set(0.85, 1.15, 1);
      eye.add(w);
      const ir = new THREE.Mesh(new THREE.CircleGeometry(0.034, 16), iris);
      ir.position.set(-s * 0.004, -0.004, 0.002);
      ir.scale.set(0.85, 1.2, 1);
      eye.add(ir);
      const pu = new THREE.Mesh(new THREE.CircleGeometry(0.016, 12), pupil);
      pu.position.set(-s * 0.004, -0.006, 0.003);
      pu.scale.set(0.9, 1.2, 1);
      eye.add(pu);
      const hl = new THREE.Mesh(new THREE.CircleGeometry(0.009, 8), white);
      hl.position.set(s * 0.008, 0.016, 0.004);
      eye.add(hl);
      // 上まつ毛
      const top = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.014), lash);
      top.position.set(0, 0.052, 0.004);
      top.rotation.z = s * -0.12;
      eye.add(top);
      if (gender === 'female') {
        const flick = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.01), lash);
        flick.position.set(s * 0.05, 0.05, 0.004);
        flick.rotation.z = s * 0.6;
        eye.add(flick);
      }
      // 眉
      const brow = new THREE.Mesh(new THREE.PlaneGeometry(0.075, 0.012), lash);
      brow.position.set(0, 0.085, 0.004);
      brow.rotation.z = s * (gender === 'male' ? -0.18 : -0.08);
      eye.add(brow);
    }
    // 口
    const mouth = new THREE.Mesh(new THREE.PlaneGeometry(0.035, 0.008), new THREE.MeshBasicMaterial({ color: '#8a4a3a' }));
    mouth.position.set(0, 0.105, 0.222);
    this.head.add(mouth);
    // 頬の赤み
    const blush = new THREE.MeshBasicMaterial({ color: '#f2a08c', transparent: true, opacity: 0.45 });
    for (const s of [1, -1]) {
      const b = new THREE.Mesh(new THREE.CircleGeometry(0.03, 10), blush);
      b.scale.set(1.3, 0.6, 1);
      b.position.set(s * 0.13, 0.15, 0.185);
      b.rotation.y = s * 0.55;
      this.head.add(b);
    }
  }

  private buildHair(gender: Gender, hair: THREE.Material, job: Job) {
    // 後頭部をすっぽり覆うキャップ
    const cap = this.mesh(new THREE.SphereGeometry(0.255, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.62), hair);
    cap.rotation.x = -0.35;
    this.put(this.head, cap, 0, 0.26, -0.02);
    // 後頭部（前方に回り込まないよう後ろ半分だけ）
    const back = this.mesh(new THREE.SphereGeometry(0.245, 16, 12, Math.PI * 0.9, Math.PI * 1.2), hair);
    back.scale.set(1.02, 0.95, 0.95);
    this.put(this.head, back, 0, 0.25, -0.04);

    const lock = (x: number, y: number, z: number, rx: number, rz: number, r = 0.06, h = 0.2, ry = 0) => {
      const m = this.mesh(new THREE.ConeGeometry(r, h, 5), hair);
      m.rotation.set(rx, ry, rz);
      this.put(this.head, m, x, y, z);
    };

    if (gender === 'male') {
      // 無造作な跳ね前髪
      const bangs: [number, number, number, number][] = [
        [-0.13, 0.36, 0.18, 0.55], [-0.06, 0.37, 0.2, 0.2], [0.02, 0.37, 0.21, -0.1], [0.1, 0.36, 0.19, -0.4], [0.17, 0.33, 0.14, -0.8],
      ];
      for (const [x, y, z, rz] of bangs) lock(x, y, z, Math.PI + 0.75, rz, 0.06, 0.2);
      // 頭頂〜後ろの跳ね
      const spikes: [number, number, number, number, number][] = [
        [0, 0.48, -0.02, -0.4, 0], [0.12, 0.46, -0.06, -0.6, -0.7], [-0.12, 0.46, -0.06, -0.6, 0.7],
        [0.05, 0.4, -0.2, -1.3, -0.3], [-0.06, 0.4, -0.2, -1.3, 0.3], [0.2, 0.34, -0.1, -0.7, -1.3], [-0.2, 0.34, -0.1, -0.7, 1.3],
        [0.0, 0.3, -0.25, -1.9, 0],
      ];
      for (const [x, y, z, rx, rz] of spikes) lock(x, y, z, rx, rz, 0.07, 0.2);
      // もみあげ
      for (const s of [1, -1]) lock(s * 0.22, 0.2, 0.06, Math.PI, 0, 0.04, 0.14);
    } else {
      // ボブ＋前髪（参考画像の女性タイプ）
      const bangs: [number, number, number, number][] = [
        [-0.14, 0.34, 0.17, 0.35], [-0.07, 0.36, 0.2, 0.12], [0.0, 0.36, 0.21, -0.02], [0.08, 0.36, 0.2, -0.18], [0.15, 0.33, 0.16, -0.4],
      ];
      for (const [x, y, z, rz] of bangs) lock(x, y, z, Math.PI + 0.5, rz, 0.065, 0.22);
      // 顔まわりの長いサイドの髪
      for (const s of [1, -1]) {
        const side = this.mesh(new THREE.CapsuleGeometry(0.065, 0.26, 4, 8), hair);
        side.rotation.z = s * 0.08;
        this.put(this.head, side, s * 0.2, 0.1, 0.05);
      }
      // 後ろ髪のボリューム
      const bob = this.mesh(new THREE.SphereGeometry(0.265, 16, 12, Math.PI * 0.85, Math.PI * 1.3, Math.PI * 0.35, Math.PI * 0.45), hair);
      bob.rotation.x = 0.2;
      this.put(this.head, bob, 0, 0.18, -0.05);
      // ポニーテール（伝説の勇者では高めに結う）
      this.ponytail = new THREE.Group();
      this.ponytail.position.set(0, job.id === 'hero' ? 0.42 : 0.34, -0.22);
      this.head.add(this.ponytail);
      this.put(this.ponytail, this.mesh(new THREE.TorusGeometry(0.04, 0.018, 6, 12), this.mat(job.palette.accent)), 0, 0, 0);
      const tail = this.mesh(new THREE.ConeGeometry(0.1, 0.46, 8), hair);
      tail.rotation.x = Math.PI - 0.25;
      this.put(this.ponytail, tail, 0, -0.22, -0.06);
    }
  }

  private buildWeapon(job: Job, gold: THREE.Material, leather: THREE.Material) {
    const p = job.palette;
    const hand = new THREE.Group();
    hand.position.set(0, -0.48, 0.02);
    this.armR.add(hand);
    const glow = (c: string) => this.mat(c, { emissive: c, emissiveIntensity: 1.1 });
    const steel = this.metal('#d8dee6');

    switch (job.weapon) {
      case 'bag': {
        // 営業カバン（ブリーフケース）
        const bag = new THREE.Group();
        this.put(bag, this.mesh(new THREE.BoxGeometry(0.34, 0.25, 0.09), this.mat('#4a2c18')), 0, -0.18, 0);
        this.put(bag, this.mesh(new THREE.BoxGeometry(0.35, 0.03, 0.095), this.mat('#6b4428')), 0, -0.1, 0);
        this.put(bag, this.mesh(new THREE.TorusGeometry(0.06, 0.016, 6, 12, Math.PI), this.mat('#2a1a10')), 0, -0.05, 0);
        this.put(bag, this.mesh(new THREE.BoxGeometry(0.05, 0.035, 0.1), gold), 0, -0.1, 0);
        bag.rotation.y = Math.PI / 2;
        hand.add(bag);
        break;
      }
      case 'sword':
      case 'holySword': {
        const sword = new THREE.Group();
        const holy = job.weapon === 'holySword';
        const len = holy ? 0.95 : 0.78;
        const blade = holy ? glow(p.accent) : steel;
        this.put(sword, this.mesh(new THREE.BoxGeometry(0.065, len, 0.02), blade), 0, 0.08 + len / 2, 0);
        this.put(sword, this.mesh(new THREE.ConeGeometry(0.046, 0.1, 4), blade), 0, 0.13 + len, 0);
        this.put(sword, this.mesh(new THREE.BoxGeometry(0.26, 0.045, 0.06), gold), 0, 0.06, 0);
        this.put(sword, this.mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.16, 8), leather), 0, -0.04, 0);
        this.put(sword, this.mesh(new THREE.SphereGeometry(0.036, 8, 8), gold), 0, -0.13, 0);
        if (holy) {
          const aura = new THREE.Mesh(
            new THREE.BoxGeometry(0.15, len + 0.1, 0.05),
            new THREE.MeshBasicMaterial({ color: p.accent, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false }),
          );
          this.put(sword, aura, 0, 0.1 + len / 2, 0);
          this.weaponGlow = aura;
        }
        sword.rotation.x = Math.PI / 2 - 0.35;
        hand.add(sword);
        break;
      }
      case 'staff': {
        const staff = new THREE.Group();
        this.put(staff, this.mesh(new THREE.CylinderGeometry(0.026, 0.032, 1.3, 8), this.mat('#6b4a2a')), 0, 0.3, 0);
        this.put(staff, this.mesh(new THREE.TorusGeometry(0.09, 0.018, 6, 16), gold), 0, 0.99, 0);
        const orb = this.mesh(new THREE.IcosahedronGeometry(0.075, 1), glow(p.accent), true);
        this.put(staff, orb, 0, 0.99, 0);
        this.weaponGlow = orb;
        hand.add(staff);
        break;
      }
      case 'bow': {
        const bow = new THREE.Group();
        const arc = this.mesh(new THREE.TorusGeometry(0.45, 0.022, 6, 24, Math.PI * 0.9), this.mat('#7a5230'));
        arc.rotation.z = Math.PI / 2 + Math.PI * 0.05;
        this.put(bow, arc, 0, 0, 0);
        const string = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.88, 4), new THREE.MeshBasicMaterial({ color: '#eeeeee' }));
        this.put(bow, string, -0.07, 0, 0);
        bow.rotation.y = Math.PI / 2;
        bow.position.z = 0.08;
        hand.add(bow);
        // 矢筒と矢羽
        const quiver = new THREE.Group();
        this.put(quiver, this.mesh(new THREE.CylinderGeometry(0.065, 0.055, 0.42, 8), leather), 0, 0, 0);
        for (let i = 0; i < 3; i++) this.put(quiver, this.mesh(new THREE.ConeGeometry(0.025, 0.08, 4), this.mat('#e9dcc0')), (i - 1) * 0.03, 0.25, 0);
        quiver.rotation.z = 0.5;
        this.put(this.torso, quiver, 0.12, 0.35, -0.26);
        break;
      }
      case 'lance': {
        const lance = new THREE.Group();
        this.put(lance, this.mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 8), this.mat('#3a2a20')), 0, -0.05, 0);
        this.put(lance, this.mesh(new THREE.ConeGeometry(0.1, 0.15, 12), gold), 0, 0.26, 0);
        this.put(lance, this.mesh(new THREE.ConeGeometry(0.075, 1.2, 12), steel), 0, 0.93, 0);
        const tip = this.mesh(new THREE.ConeGeometry(0.03, 0.2, 6), glow(p.accent), true);
        this.put(lance, tip, 0, 1.6, 0);
        this.weaponGlow = tip;
        lance.rotation.x = Math.PI / 2 - 0.15;
        hand.add(lance);
        break;
      }
    }

    // ---- 盾 ----
    if (job.hasShield) {
      const kite = job.id === 'paladin' || job.id === 'hero';
      const shield = new THREE.Group();
      if (kite) {
        // 騎士のカイトシールド
        const s = new THREE.Shape();
        s.moveTo(0, 0.3);
        s.quadraticCurveTo(0.22, 0.3, 0.22, 0.12);
        s.quadraticCurveTo(0.2, -0.18, 0, -0.38);
        s.quadraticCurveTo(-0.2, -0.18, -0.22, 0.12);
        s.quadraticCurveTo(-0.22, 0.3, 0, 0.3);
        const geo = new THREE.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.015, bevelSegments: 1 });
        this.put(shield, this.mesh(geo, this.metal(job.id === 'hero' ? '#2c56a8' : '#9aa6b8')), 0, 0, -0.02);
        this.put(shield, this.mesh(new THREE.BoxGeometry(0.05, 0.5, 0.02), gold), 0, -0.02, 0.05);
        this.put(shield, this.mesh(new THREE.BoxGeometry(0.3, 0.05, 0.02), gold), 0, 0.1, 0.05);
      } else {
        // 丸盾（バックラー）
        const face = this.mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 20), this.mat('#7a5230'));
        face.rotation.x = Math.PI / 2;
        this.put(shield, face, 0, 0, 0);
        this.put(shield, this.mesh(new THREE.TorusGeometry(0.2, 0.022, 6, 24), this.metal('#b8c0cc')), 0, 0, 0.01);
        this.put(shield, this.mesh(new THREE.SphereGeometry(0.05, 10, 8), this.metal('#b8c0cc')), 0, 0, 0.03);
      }
      shield.position.set(0.1, -0.32, 0.12);
      shield.rotation.y = 0.4;
      this.armL.add(shield);
    }
  }

  // ----------------------------------------------------------
  update(dt: number, time: number) {
    this.animT += dt;
    const t = this.animT;

    // ---- 待機息遣い ----
    const breath = Math.sin(time * 2.2);
    this.torso.scale.set(1 + breath * 0.01, 1 + breath * 0.016, 1 + breath * 0.01);
    this.body.position.y = Math.abs(Math.sin(time * 1.1)) * 0.012;
    this.head.rotation.z = Math.sin(time * 0.9) * 0.035;
    let armR = -0.1 + Math.sin(time * 2.2) * 0.04;
    let armRx = 0;
    let armL = 0.1 - Math.sin(time * 2.2) * 0.04;
    let lean = 0;
    const offset = new THREE.Vector3();
    let jump = 0;

    if (this.anim === 'attack') {
      // 0-0.18 振りかぶり / 0.18-0.4 突進＋振り下ろし / 0.4-0.75 帰還
      const d = 0.75;
      if (t < 0.18) {
        const k = t / 0.18;
        armRx = -2.4 * k;
        armR = -0.1 - 0.5 * k;
        lean = -0.12 * k;
        offset.copy(this.attackVector).multiplyScalar(-0.08 * k);
      } else if (t < 0.4) {
        const k = (t - 0.18) / 0.22;
        const e = 1 - Math.pow(1 - k, 3);
        armRx = -2.4 + 3.3 * e;
        armR = -0.6 + 0.5 * e;
        lean = 0.25;
        offset.copy(this.attackVector).multiplyScalar(e);
      } else if (t < d) {
        const k = (t - 0.4) / (d - 0.4);
        const e = k * k * (3 - 2 * k);
        armRx = 0.9 * (1 - e);
        armR = -0.1;
        lean = 0.25 * (1 - e);
        offset.copy(this.attackVector).multiplyScalar(1 - e);
      } else {
        this.anim = 'idle';
      }
    } else if (this.anim === 'hit') {
      const d = 0.6;
      if (t < d) {
        const k = t / d;
        const knock = Math.sin(Math.min(1, k * 2.2) * Math.PI) * (1 - k);
        offset.copy(this.attackVector).normalize().multiplyScalar(-0.55 * knock);
        lean = -0.45 * knock;
        armR = -0.8 * knock;
        armL = 0.8 * knock;
        this.setFlash(k < 0.5 ? Math.max(0, Math.sin(k * 30)) * 0.8 : 0);
      } else {
        this.setFlash(0);
        this.anim = 'idle';
      }
    } else if (this.anim === 'victory') {
      const cycle = t % 0.9;
      jump = Math.sin((cycle / 0.9) * Math.PI) * 0.35;
      armRx = -2.6;
      armR = -0.4;
      if (t > 2.7) this.anim = 'idle';
    }

    this.root.position.copy(this.basePos).add(offset);
    this.root.position.y += jump;
    this.body.rotation.x = lean;
    this.armR.rotation.z = armR;
    this.armR.rotation.x = armRx;
    this.armL.rotation.z = armL;
    this.legL.rotation.x = Math.sin(time * 2.2) * 0.02 + (this.anim === 'attack' ? 0.35 : 0);
    this.legR.rotation.x = -Math.sin(time * 2.2) * 0.02 - (this.anim === 'attack' ? 0.25 : 0);

    // ---- マントのなびき ----
    if (this.cape && this.capeBase) {
      const pos = this.cape.geometry.attributes.position as THREE.BufferAttribute;
      const arr = pos.array as Float32Array;
      const wind = this.anim === 'attack' ? 2.5 : 1;
      for (let i = 0; i < arr.length; i += 3) {
        const x = this.capeBase[i];
        const depth = -this.capeBase[i + 1];
        arr[i + 2] = this.capeBase[i + 2] - depth * depth * 0.22 * wind + Math.sin(time * 3 + depth * 4 + x * 3) * 0.035 * depth * wind;
      }
      pos.needsUpdate = true;
    }
    if (this.wings) {
      const flap = Math.sin(time * (this.anim === 'attack' ? 14 : 3)) * 0.25;
      this.wings.children.forEach((w, i) => (w.rotation.y = (i === 0 ? -0.5 : 0.5) + (i === 0 ? flap : -flap)));
    }
    if (this.ponytail) {
      this.ponytail.rotation.x = Math.sin(time * 2.5) * 0.12 + (this.anim === 'attack' ? -0.5 : 0);
      this.ponytail.rotation.z = Math.sin(time * 1.7) * 0.1;
    }
    if (this.weaponGlow) this.weaponGlow.scale.setScalar(1 + Math.sin(time * 5) * 0.12);
  }

  private setFlash(v: number) {
    for (const [m, orig] of this.flashMats) {
      if (v <= 0) {
        m.emissive.copy(orig.c);
        m.emissiveIntensity = orig.i;
      } else {
        m.emissive.setRGB(1, 0.1, 0.1);
        m.emissiveIntensity = v;
      }
    }
  }
}
