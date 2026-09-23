import * as THREE from 'three';
import type { Gender, Job } from '../data/types';

// ============================================================
// プロシージャル生成のちびキャラ勇者
// 前方向 = ローカル +Z
// ============================================================

export type HeroAnim = 'idle' | 'attack' | 'hit' | 'victory';

const SKIN = '#ffd9b8';
const HAIR: Record<Gender, string> = { male: '#2d2118', female: '#b8542c' };

function mat(color: string, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.1, flatShading: false, ...opts });
}
function metal(color: string) {
  return mat(color, { metalness: 0.65, roughness: 0.3 });
}

export class HeroModel {
  readonly root = new THREE.Group();
  /** アニメーション用のオフセット（root の位置/回転はステージが管理） */
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
  private flashMats = new Map<THREE.MeshStandardMaterial, { c: THREE.Color; i: number }>();

  private anim: HeroAnim = 'idle';
  private animT = 0;
  /** 攻撃時の突進方向（ローカル座標, root の親空間） */
  attackVector = new THREE.Vector3(0, 0, 1.2);
  private basePos = new THREE.Vector3();

  constructor(job: Job, gender: Gender) {
    this.root.add(this.body);
    this.build(job, gender);
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
  private add<T extends THREE.Object3D>(parent: THREE.Object3D, obj: T, x = 0, y = 0, z = 0): T {
    obj.position.set(x, y, z);
    obj.castShadow = true;
    parent.add(obj);
    return obj;
  }

  private mesh(geo: THREE.BufferGeometry, material: THREE.Material) {
    const m = new THREE.Mesh(geo, material);
    m.castShadow = true;
    if (material instanceof THREE.MeshStandardMaterial && !this.flashMats.has(material))
      this.flashMats.set(material, { c: material.emissive.clone(), i: material.emissiveIntensity });
    return m;
  }

  private build(job: Job, gender: Gender) {
    const p = job.palette;
    const isVillager = job.id === 'villager';
    const armorMat = isVillager ? mat(p.armor) : metal(p.armor);
    const trimMat = metal(p.trim);
    const clothMat = mat(p.cloth);
    const skinMat = mat(SKIN, { roughness: 0.8 });
    const hairMat = mat(HAIR[gender], { roughness: 0.7 });
    const bootMat = mat(isVillager ? '#5a3b22' : '#2a2320');

    // ---- 脚 ----
    const legGeo = new THREE.CapsuleGeometry(0.11, 0.3, 4, 10);
    const bootGeo = new THREE.BoxGeometry(0.2, 0.14, 0.28);
    for (const [leg, x] of [[this.legL, 0.13], [this.legR, -0.13]] as const) {
      leg.position.set(x, 0.55, 0);
      this.body.add(leg);
      this.add(leg, this.mesh(legGeo, clothMat), 0, -0.2, 0);
      this.add(leg, this.mesh(bootGeo, bootMat), 0, -0.47, 0.04);
    }

    // ---- 胴体 ----
    this.torso.position.set(0, 0.62, 0);
    this.body.add(this.torso);
    const chest = this.mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.5, 14), armorMat);
    this.add(this.torso, chest, 0, 0.25, 0);
    // スカート/腰当て
    if (gender === 'female') {
      this.add(this.torso, this.mesh(new THREE.ConeGeometry(0.4, 0.34, 14, 1, true), clothMat), 0, 0.02, 0);
    } else {
      this.add(this.torso, this.mesh(new THREE.CylinderGeometry(0.3, 0.33, 0.14, 14), clothMat), 0, 0.02, 0);
    }
    // ベルト
    this.add(this.torso, this.mesh(new THREE.TorusGeometry(0.29, 0.035, 6, 20), trimMat), 0, 0.08, 0).rotation.x = Math.PI / 2;
    // 胸当てエンブレム
    if (!isVillager) {
      const emblem = this.mesh(new THREE.OctahedronGeometry(0.07), mat(p.accent, { emissive: p.accent, emissiveIntensity: 0.6 }));
      this.add(this.torso, emblem, 0, 0.32, 0.28);
    } else {
      // 村人はネクタイ
      const tie = this.mesh(new THREE.ConeGeometry(0.05, 0.22, 4), mat('#2f5fbf'));
      tie.rotation.x = Math.PI;
      this.add(this.torso, tie, 0, 0.3, 0.27);
    }

    // ---- 肩当て ----
    if (job.hasShoulder) {
      const padGeo = new THREE.SphereGeometry(0.15, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
      for (const x of [0.33, -0.33]) {
        const pad = this.mesh(padGeo, trimMat);
        pad.scale.set(1.1, 0.8, 1.1);
        this.add(this.torso, pad, x, 0.46, 0);
      }
    }

    // ---- 腕 ----
    const armGeo = new THREE.CapsuleGeometry(0.075, 0.28, 4, 8);
    const handGeo = new THREE.SphereGeometry(0.08, 10, 8);
    for (const [arm, x] of [[this.armL, 0.36], [this.armR, -0.36]] as const) {
      arm.position.set(x, 0.45, 0);
      this.torso.add(arm);
      this.add(arm, this.mesh(armGeo, isVillager ? clothMat : armorMat), 0, -0.18, 0);
      this.add(arm, this.mesh(handGeo, skinMat), 0, -0.4, 0);
    }
    this.armL.rotation.z = 0.12;
    this.armR.rotation.z = -0.12;

    // ---- 頭 ----
    this.head.position.set(0, 0.62, 0);
    this.torso.add(this.head);
    this.add(this.head, this.mesh(new THREE.SphereGeometry(0.3, 20, 16), skinMat), 0, 0.26, 0);
    // 目
    const eyeGeo = new THREE.SphereGeometry(0.04, 8, 8);
    const eyeMat = mat('#1b1b2a', { roughness: 0.2 });
    for (const x of [0.1, -0.1]) {
      const eye = this.mesh(eyeGeo, eyeMat);
      eye.scale.set(0.8, 1.2, 0.6);
      this.add(this.head, eye, x, 0.26, 0.27);
      const shine = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 6), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
      this.add(this.head, shine, x + 0.015, 0.285, 0.3);
    }
    // ほっぺ
    const blush = mat('#ff9a9a', { transparent: true, opacity: 0.55 });
    for (const x of [0.17, -0.17]) {
      const b = this.mesh(new THREE.SphereGeometry(0.04, 8, 6), blush);
      b.scale.set(1, 0.5, 0.3);
      this.add(this.head, b, x, 0.19, 0.25);
    }
    // 髪（キャップ）
    const hairCap = this.mesh(new THREE.SphereGeometry(0.32, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat);
    hairCap.rotation.x = -0.25;
    this.add(this.head, hairCap, 0, 0.3, -0.02);
    // 前髪
    for (let i = -2; i <= 2; i++) {
      const bang = this.mesh(new THREE.ConeGeometry(0.07, 0.18, 5), hairMat);
      bang.rotation.set(Math.PI + 0.35, 0, i * 0.18);
      this.add(this.head, bang, i * 0.085, 0.43, 0.24);
    }
    if (gender === 'male') {
      // 跳ね髪
      const spikes: [number, number, number, number, number][] = [
        [0, 0.58, -0.05, -0.3, 0], [0.16, 0.54, -0.08, -0.4, -0.6], [-0.16, 0.54, -0.08, -0.4, 0.6],
        [0.08, 0.5, -0.22, -1.0, -0.3], [-0.08, 0.5, -0.22, -1.0, 0.3], [0.24, 0.4, -0.12, -0.5, -1.1], [-0.24, 0.4, -0.12, -0.5, 1.1],
      ];
      for (const [x, y, z, rx, rz] of spikes) {
        const s = this.mesh(new THREE.ConeGeometry(0.08, 0.26, 5), hairMat);
        s.rotation.set(rx, 0, rz);
        this.add(this.head, s, x, y, z);
      }
    } else {
      // サイドの髪
      for (const x of [0.27, -0.27]) {
        const side = this.mesh(new THREE.CapsuleGeometry(0.07, 0.22, 4, 8), hairMat);
        this.add(this.head, side, x, 0.12, 0.05);
      }
      // ポニーテール
      this.ponytail = new THREE.Group();
      this.ponytail.position.set(0, 0.42, -0.26);
      this.head.add(this.ponytail);
      this.add(this.ponytail, this.mesh(new THREE.TorusGeometry(0.05, 0.02, 6, 12), mat(p.accent)), 0, 0, 0);
      const tail = this.mesh(new THREE.ConeGeometry(0.12, 0.5, 8), hairMat);
      tail.rotation.x = Math.PI - 0.2;
      this.add(this.ponytail, tail, 0, -0.24, -0.06);
    }
    // 王冠（勇者）/ サークレット
    if (job.hasCrown) {
      const crown = new THREE.Group();
      this.add(crown, this.mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.08, 16, 1, true), metal(p.trim)), 0, 0, 0);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const spike = this.mesh(new THREE.ConeGeometry(0.035, 0.1, 4), metal(p.trim));
        this.add(crown, spike, Math.sin(a) * 0.2, 0.08, Math.cos(a) * 0.2);
      }
      const gem = this.mesh(new THREE.OctahedronGeometry(0.04), mat('#ff3355', { emissive: '#ff3355', emissiveIntensity: 0.8 }));
      this.add(crown, gem, 0, 0.02, 0.22);
      crown.rotation.x = -0.15;
      this.add(this.head, crown, 0, 0.56, 0);
    } else if (job.id === 'paladin' || job.id === 'dragonKnight') {
      const circlet = this.mesh(new THREE.TorusGeometry(0.3, 0.02, 6, 24), metal(p.trim));
      circlet.rotation.x = Math.PI / 2 - 0.2;
      this.add(this.head, circlet, 0, 0.4, 0.02);
    }

    // ---- マント ----
    if (job.hasCape) {
      const geo = new THREE.PlaneGeometry(0.62, 0.95, 6, 10);
      geo.translate(0, -0.47, 0);
      const cape = new THREE.Mesh(geo, mat(p.cape, { side: THREE.DoubleSide, roughness: 0.8 }));
      cape.castShadow = true;
      cape.position.set(0, 0.52, -0.27);
      cape.rotation.x = 0.12;
      this.torso.add(cape);
      this.cape = cape;
      this.capeBase = Float32Array.from(geo.attributes.position.array as Float32Array);
    }

    // ---- 翼（ドラゴンナイト） ----
    if (job.hasWings) {
      this.wings = new THREE.Group();
      this.wings.position.set(0, 0.4, -0.3);
      this.torso.add(this.wings);
      const wingShape = new THREE.Shape();
      wingShape.moveTo(0, 0);
      wingShape.lineTo(0.7, 0.45);
      wingShape.lineTo(0.62, 0.1);
      wingShape.lineTo(0.5, 0.18);
      wingShape.lineTo(0.42, -0.1);
      wingShape.lineTo(0.28, 0.02);
      wingShape.lineTo(0.2, -0.2);
      wingShape.lineTo(0, 0);
      const wGeo = new THREE.ShapeGeometry(wingShape);
      const wMat = mat(p.trim, { side: THREE.DoubleSide, metalness: 0.3 });
      for (const s of [1, -1]) {
        const w = new THREE.Mesh(wGeo, wMat);
        w.scale.x = s;
        w.rotation.y = s * -0.5;
        w.castShadow = true;
        this.wings.add(w);
      }
    }

    // ---- 武器 ----
    this.buildWeapon(job, trimMat, armorMat);
  }

  private buildWeapon(job: Job, trimMat: THREE.Material, armorMat: THREE.Material) {
    const p = job.palette;
    const hand = new THREE.Group();
    hand.position.set(0, -0.42, 0.02);
    this.armR.add(hand);
    const glowMat = (c: string) => mat(c, { emissive: c, emissiveIntensity: 1.1, roughness: 0.2 });

    switch (job.weapon) {
      case 'bag': {
        const bag = new THREE.Group();
        this.add(bag, this.mesh(new THREE.BoxGeometry(0.34, 0.26, 0.1), mat('#4a2f1c', { roughness: 0.6 })), 0, -0.18, 0);
        const handle = this.mesh(new THREE.TorusGeometry(0.07, 0.018, 6, 12, Math.PI), mat('#2a1a10'));
        this.add(bag, handle, 0, -0.04, 0);
        this.add(bag, this.mesh(new THREE.BoxGeometry(0.05, 0.04, 0.11), metal('#d4b060')), 0, -0.1, 0.0);
        bag.rotation.y = Math.PI / 2;
        hand.add(bag);
        break;
      }
      case 'sword':
      case 'holySword': {
        const sword = new THREE.Group();
        const holy = job.weapon === 'holySword';
        const bladeMat = holy ? glowMat(p.accent) : metal('#dfe6ee');
        this.add(sword, this.mesh(new THREE.BoxGeometry(0.07, holy ? 0.95 : 0.75, 0.025), bladeMat), 0, holy ? 0.55 : 0.45, 0);
        this.add(sword, this.mesh(new THREE.ConeGeometry(0.05, 0.12, 4), bladeMat), 0, holy ? 1.08 : 0.88, 0);
        this.add(sword, this.mesh(new THREE.BoxGeometry(0.26, 0.05, 0.07), trimMat), 0, 0.06, 0);
        this.add(sword, this.mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.16, 8), mat('#3a2a20')), 0, -0.04, 0);
        this.add(sword, this.mesh(new THREE.SphereGeometry(0.04, 8, 8), trimMat), 0, -0.13, 0);
        if (holy) {
          const aura = new THREE.Mesh(
            new THREE.BoxGeometry(0.16, 1.05, 0.05),
            new THREE.MeshBasicMaterial({ color: p.accent, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }),
          );
          this.add(sword, aura, 0, 0.58, 0);
          this.weaponGlow = aura;
        }
        sword.rotation.x = Math.PI / 2 - 0.3;
        hand.add(sword);
        break;
      }
      case 'staff': {
        const staff = new THREE.Group();
        this.add(staff, this.mesh(new THREE.CylinderGeometry(0.03, 0.035, 1.3, 8), mat('#6b4a2a')), 0, 0.3, 0);
        this.add(staff, this.mesh(new THREE.TorusGeometry(0.1, 0.02, 6, 16), trimMat), 0, 1.0, 0);
        const orb = this.mesh(new THREE.IcosahedronGeometry(0.09, 1), glowMat(p.accent));
        this.add(staff, orb, 0, 1.0, 0);
        this.weaponGlow = orb;
        hand.add(staff);
        break;
      }
      case 'bow': {
        const bow = new THREE.Group();
        const arc = this.mesh(new THREE.TorusGeometry(0.45, 0.025, 6, 24, Math.PI * 0.9), mat('#7a5230'));
        arc.rotation.z = Math.PI / 2 + Math.PI * 0.05;
        this.add(bow, arc, 0, 0, 0);
        const string = new THREE.Mesh(
          new THREE.CylinderGeometry(0.004, 0.004, 0.88, 4),
          new THREE.MeshBasicMaterial({ color: '#eeeeee' }),
        );
        this.add(bow, string, -0.07, 0, 0);
        this.add(bow, this.mesh(new THREE.SphereGeometry(0.035, 6, 6), glowMat(p.accent)), 0.45, 0, 0);
        bow.rotation.y = Math.PI / 2;
        bow.position.z = 0.08;
        hand.add(bow);
        // 矢筒
        const quiver = this.mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.45, 8), mat('#5a3b22'));
        quiver.rotation.z = 0.5;
        this.add(this.torso, quiver, 0.12, 0.35, -0.3);
        break;
      }
      case 'lance': {
        const lance = new THREE.Group();
        this.add(lance, this.mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 8), mat('#3a2a20')), 0, -0.05, 0);
        this.add(lance, this.mesh(new THREE.ConeGeometry(0.1, 0.15, 12), trimMat), 0, 0.26, 0);
        this.add(lance, this.mesh(new THREE.ConeGeometry(0.075, 1.2, 12), metal('#c9ced6')), 0, 0.93, 0);
        const tip = this.mesh(new THREE.ConeGeometry(0.03, 0.2, 6), glowMat(p.accent));
        this.add(lance, tip, 0, 1.6, 0);
        this.weaponGlow = tip;
        lance.rotation.x = Math.PI / 2 - 0.15;
        hand.add(lance);
        break;
      }
    }

    // ---- 盾 ----
    if (job.hasShield) {
      const shield = new THREE.Group();
      const big = job.id === 'paladin' || job.id === 'hero';
      const face = this.mesh(new THREE.CylinderGeometry(big ? 0.28 : 0.22, big ? 0.28 : 0.22, 0.05, 20), armorMat);
      face.rotation.x = Math.PI / 2;
      this.add(shield, face, 0, 0, 0);
      const rim = this.mesh(new THREE.TorusGeometry(big ? 0.28 : 0.22, 0.025, 6, 24), trimMat);
      this.add(shield, rim, 0, 0, 0.01);
      const crest = this.mesh(new THREE.OctahedronGeometry(0.07), mat(p.accent, { emissive: p.accent, emissiveIntensity: 0.4 }));
      this.add(shield, crest, 0, 0, 0.05);
      shield.position.set(0.1, -0.3, 0.12);
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
    this.torso.scale.set(1 + breath * 0.012, 1 + breath * 0.02, 1 + breath * 0.012);
    this.body.position.y = Math.abs(Math.sin(time * 1.1)) * 0.015;
    this.head.rotation.z = Math.sin(time * 0.9) * 0.04;
    let armR = -0.12 + Math.sin(time * 2.2) * 0.04;
    let armRx = 0;
    let armL = 0.12 - Math.sin(time * 2.2) * 0.04;
    let lean = 0;
    let offset = new THREE.Vector3();
    let jump = 0;

    if (this.anim === 'attack') {
      // 0-0.18 溜め / 0.18-0.4 突進+薙ぎ払い / 0.4-0.75 帰還
      const d = 0.75;
      if (t < 0.18) {
        const k = t / 0.18;
        armRx = -1.6 * k;
        armR = -0.12 - 1.2 * k;
        lean = -0.12 * k;
        offset.copy(this.attackVector).multiplyScalar(-0.08 * k);
      } else if (t < 0.4) {
        const k = (t - 0.18) / 0.22;
        const e = 1 - Math.pow(1 - k, 3);
        armRx = -1.6 + 2.6 * e;
        armR = -1.32 + 2.2 * e;
        lean = 0.25;
        offset.copy(this.attackVector).multiplyScalar(e);
      } else if (t < d) {
        const k = (t - 0.4) / (d - 0.4);
        const e = k * k * (3 - 2 * k);
        armRx = 1.0 * (1 - e);
        armR = 0.88 * (1 - e) - 0.12 * e;
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
        const flash = k < 0.5 ? Math.max(0, Math.sin(k * 30)) * 0.8 : 0;
        this.setFlash(flash);
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
    this.legL.rotation.x = Math.sin(time * 2.2) * 0.02 + (this.anim === 'attack' ? 0.3 : 0);
    this.legR.rotation.x = -Math.sin(time * 2.2) * 0.02 - (this.anim === 'attack' ? 0.2 : 0);

    // ---- マントのなびき ----
    if (this.cape && this.capeBase) {
      const pos = this.cape.geometry.attributes.position as THREE.BufferAttribute;
      const arr = pos.array as Float32Array;
      const wind = this.anim === 'attack' ? 2.5 : 1;
      for (let i = 0; i < arr.length; i += 3) {
        const x = this.capeBase[i];
        const y = this.capeBase[i + 1];
        const depth = -y; // 0 (上) 〜 0.95 (下)
        arr[i + 2] = this.capeBase[i + 2] - depth * depth * 0.25 * wind
          + Math.sin(time * 3 + depth * 4 + x * 3) * 0.04 * depth * wind;
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
    if (this.weaponGlow) {
      const s = 1 + Math.sin(time * 5) * 0.12;
      this.weaponGlow.scale.setScalar(s);
    }
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
