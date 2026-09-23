import * as THREE from 'three';
import type { MonsterSpec } from '../data/types';

export type MonsterAnim = 'idle' | 'hit' | 'attack' | 'defeat';

function mat(color: string | THREE.Color, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.05, ...opts });
}

/** プロシージャル生成のモンスター（＝見込み顧客）。前方向 = ローカル +Z */
export class MonsterModel {
  readonly root = new THREE.Group();
  private body = new THREE.Group();
  private eyes: THREE.Object3D[] = [];
  private mats = new Map<THREE.MeshStandardMaterial, { c: THREE.Color; i: number }>();
  private anim: MonsterAnim = 'idle';
  private animT = 0;
  private basePos = new THREE.Vector3();
  attackVector = new THREE.Vector3(0, 0, 1);
  private floating: boolean;
  private scale: number;

  constructor(spec: MonsterSpec, bossScale = 1) {
    this.root.add(this.body);
    this.floating = spec.shape === 'ghost' || spec.shape === 'demon';
    this.scale = bossScale;
    this.build(spec);
    this.body.scale.setScalar(bossScale);
  }

  setBasePosition(v: THREE.Vector3) {
    this.basePos.copy(v);
    this.root.position.copy(v);
  }

  play(anim: MonsterAnim) {
    if (this.anim === 'defeat') return;
    this.anim = anim;
    this.animT = 0;
  }

  revive() {
    this.anim = 'idle';
    this.animT = 0;
    this.root.visible = true;
    this.body.scale.setScalar(this.scale);
    this.body.rotation.set(0, 0, 0);
  }

  dispose() {
    this.root.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    });
  }

  private m(geo: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0, parent: THREE.Object3D = this.body) {
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    parent.add(mesh);
    if (material instanceof THREE.MeshStandardMaterial && !this.mats.has(material))
      this.mats.set(material, { c: material.emissive.clone(), i: material.emissiveIntensity });
    return mesh;
  }

  private build(spec: MonsterSpec) {
    const bodyMat = mat(spec.bodyColor, {
      roughness: spec.shape === 'slime' ? 0.15 : 0.6,
      transparent: spec.shape === 'ghost',
      opacity: spec.shape === 'ghost' ? 0.85 : 1,
    });
    const accentMat = mat(spec.accentColor, { metalness: 0.4, roughness: 0.35 });
    let eyeY = 0.75;
    let eyeZ = 0.52;
    let topY = 1.2;

    switch (spec.shape) {
      case 'slime': {
        const g = new THREE.SphereGeometry(0.75, 28, 20);
        // しずく型に変形
        const pos = g.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          const y = pos.getY(i);
          const k = y > 0 ? 1 - (y / 0.75) * 0.35 : 1 + (-y / 0.75) * 0.05;
          pos.setX(i, pos.getX(i) * k);
          pos.setZ(i, pos.getZ(i) * k);
          if (y > 0.5) pos.setY(i, y + (y - 0.5) * 0.9);
          if (y < -0.3) pos.setY(i, -0.3 - (-(y + 0.3)) * 0.4);
        }
        g.computeVertexNormals();
        this.m(g, bodyMat, 0, 0.42, 0);
        eyeY = 0.6;
        eyeZ = 0.6;
        topY = 1.35;
        break;
      }
      case 'golem': {
        this.m(new THREE.BoxGeometry(1.1, 0.9, 0.8), bodyMat, 0, 0.75, 0).rotation.y = 0.05;
        this.m(new THREE.DodecahedronGeometry(0.42, 0), bodyMat, 0, 1.45, 0.05);
        for (const x of [0.72, -0.72]) {
          this.m(new THREE.DodecahedronGeometry(0.28, 0), bodyMat, x, 0.95, 0);
          this.m(new THREE.BoxGeometry(0.3, 0.55, 0.3), bodyMat, x * 1.05, 0.5, 0.05);
        }
        for (const x of [0.28, -0.28]) this.m(new THREE.BoxGeometry(0.34, 0.35, 0.4), bodyMat, x, 0.17, 0);
        // コアの宝石
        this.m(new THREE.OctahedronGeometry(0.13), mat(spec.accentColor, { emissive: spec.accentColor, emissiveIntensity: 0.8 }), 0, 0.85, 0.42);
        eyeY = 1.48;
        eyeZ = 0.38;
        topY = 1.85;
        break;
      }
      case 'ghost': {
        const g = new THREE.SphereGeometry(0.6, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.6);
        this.m(g, bodyMat, 0, 0.95, 0);
        const skirt = new THREE.CylinderGeometry(0.58, 0.72, 0.8, 24, 4, true);
        const pos = skirt.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          const y = pos.getY(i);
          if (y < -0.35) {
            const a = Math.atan2(pos.getZ(i), pos.getX(i));
            pos.setY(i, y + Math.sin(a * 6) * 0.12);
          }
        }
        skirt.computeVertexNormals();
        this.m(skirt, mat(spec.bodyColor, { transparent: true, opacity: 0.85, side: THREE.DoubleSide }), 0, 0.72, 0);
        for (const x of [0.62, -0.62]) this.m(new THREE.SphereGeometry(0.14, 10, 8), bodyMat, x, 0.72, 0.1);
        eyeY = 1.05;
        eyeZ = 0.5;
        topY = 1.55;
        break;
      }
      case 'demon': {
        this.m(new THREE.SphereGeometry(0.62, 24, 18), bodyMat, 0, 0.95, 0).scale.set(1, 1.1, 0.9);
        // 角
        for (const s of [1, -1]) {
          const horn = this.m(new THREE.ConeGeometry(0.1, 0.55, 8), accentMat, s * 0.36, 1.65, 0);
          horn.rotation.z = -s * 0.5;
        }
        // 翼
        const wingShape = new THREE.Shape();
        wingShape.moveTo(0, 0);
        wingShape.lineTo(0.95, 0.6);
        wingShape.lineTo(0.85, 0.05);
        wingShape.lineTo(0.62, 0.22);
        wingShape.lineTo(0.55, -0.2);
        wingShape.lineTo(0.3, 0.0);
        wingShape.lineTo(0, 0);
        const wg = new THREE.ShapeGeometry(wingShape);
        const wm = mat(spec.accentColor, { side: THREE.DoubleSide, roughness: 0.7 });
        for (const s of [1, -1]) {
          const w = this.m(wg, wm, s * 0.35, 1.05, -0.35);
          w.scale.x = s;
          w.rotation.y = s * 0.6;
          w.name = 'wing';
        }
        // 腕
        for (const s of [1, -1]) {
          const arm = this.m(new THREE.CapsuleGeometry(0.1, 0.35, 4, 8), bodyMat, s * 0.62, 0.8, 0.1);
          arm.rotation.z = s * 0.6;
          this.m(new THREE.ConeGeometry(0.05, 0.14, 5), accentMat, s * 0.8, 0.56, 0.15).rotation.x = Math.PI;
        }
        // 口の牙
        for (const s of [1, -1]) {
          const fang = this.m(new THREE.ConeGeometry(0.04, 0.12, 5), mat('#ffffff'), s * 0.12, 0.72, 0.52);
          fang.rotation.x = Math.PI;
        }
        eyeY = 1.08;
        eyeZ = 0.52;
        topY = 1.72;
        break;
      }
    }

    // ---- 目 ----
    const white = mat('#ffffff', { roughness: 0.2 });
    const pupil = mat(spec.shape === 'demon' ? '#ff2020' : '#141420', {
      roughness: 0.2,
      emissive: spec.shape === 'demon' ? '#ff2020' : '#000000',
      emissiveIntensity: 0.6,
    });
    for (const s of [1, -1]) {
      const eye = new THREE.Group();
      eye.position.set(s * 0.2, eyeY, eyeZ);
      this.body.add(eye);
      const w = this.m(new THREE.SphereGeometry(0.13, 14, 10), white, 0, 0, 0, eye);
      w.scale.set(1, 1.1, 0.6);
      this.m(new THREE.SphereGeometry(0.065, 10, 8), pupil, 0, -0.01, 0.07, eye);
      // 怒り眉
      const brow = this.m(new THREE.BoxGeometry(0.22, 0.04, 0.04), mat('#1a1a1a'), 0, 0.15, 0.06, eye);
      brow.rotation.z = s * 0.35;
      this.eyes.push(eye);
    }
    // 口
    const mouth = this.m(new THREE.TorusGeometry(0.1, 0.022, 6, 12, Math.PI), mat('#3a1010'), 0, eyeY - 0.22, eyeZ - 0.02);
    mouth.rotation.z = 0; // への字

    this.buildAccessory(spec, accentMat, eyeY, eyeZ, topY);
  }

  private buildAccessory(spec: MonsterSpec, accentMat: THREE.MeshStandardMaterial, eyeY: number, eyeZ: number, topY: number) {
    switch (spec.accessory) {
      case 'glasses': {
        const frame = mat('#111111', { metalness: 0.6 });
        for (const s of [1, -1]) {
          this.m(new THREE.TorusGeometry(0.13, 0.018, 6, 18), frame, s * 0.2, eyeY, eyeZ + 0.1);
        }
        this.m(new THREE.BoxGeometry(0.14, 0.02, 0.02), frame, 0, eyeY, eyeZ + 0.1);
        break;
      }
      case 'tie': {
        const t = this.m(new THREE.ConeGeometry(0.08, 0.35, 4), accentMat, 0, eyeY - 0.5, eyeZ + 0.05);
        t.rotation.x = Math.PI - 0.2;
        this.m(new THREE.BoxGeometry(0.1, 0.08, 0.06), accentMat, 0, eyeY - 0.3, eyeZ + 0.03);
        break;
      }
      case 'hardhat': {
        const hat = new THREE.Group();
        hat.position.set(0, topY - 0.08, 0);
        this.body.add(hat);
        this.m(new THREE.SphereGeometry(0.42, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat('#ffd400', { roughness: 0.35 }), 0, 0, 0, hat);
        this.m(new THREE.CylinderGeometry(0.5, 0.5, 0.04, 20), mat('#ffd400', { roughness: 0.35 }), 0, 0, 0.05, hat);
        this.m(new THREE.BoxGeometry(0.06, 0.1, 0.84), mat('#e0b800'), 0, 0.36, 0, hat);
        break;
      }
      case 'headset': {
        const band = this.m(new THREE.TorusGeometry(0.5, 0.03, 6, 20, Math.PI), mat('#222222'), 0, topY - 0.4, 0);
        band.rotation.y = Math.PI / 2;
        for (const s of [1, -1]) this.m(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 14), mat('#333333'), s * 0.5, topY - 0.4, 0).rotation.z = Math.PI / 2;
        const mic = this.m(new THREE.CylinderGeometry(0.015, 0.015, 0.4, 6), mat('#222222'), 0.38, eyeY - 0.25, 0.3);
        mic.rotation.set(0.9, 0.6, 0);
        this.m(new THREE.SphereGeometry(0.04, 8, 8), accentMat, 0.22, eyeY - 0.28, eyeZ + 0.05);
        break;
      }
      case 'crown': {
        const crown = new THREE.Group();
        crown.position.set(0, topY, 0);
        this.body.add(crown);
        const gold = mat('#ffcc33', { metalness: 0.8, roughness: 0.25 });
        this.m(new THREE.CylinderGeometry(0.28, 0.3, 0.14, 18, 1, true), gold, 0, 0, 0, crown);
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          this.m(new THREE.ConeGeometry(0.05, 0.18, 4), gold, Math.sin(a) * 0.28, 0.14, Math.cos(a) * 0.28, crown);
        }
        this.m(new THREE.OctahedronGeometry(0.06), mat('#ff2255', { emissive: '#ff2255', emissiveIntensity: 0.7 }), 0, 0.02, 0.3, crown);
        break;
      }
      case 'gear': {
        const gear = new THREE.Group();
        gear.position.set(0.35, topY - 0.05, 0);
        gear.rotation.z = -0.3;
        gear.name = 'spin';
        this.body.add(gear);
        const metal = mat('#9aa3ad', { metalness: 0.8, roughness: 0.3 });
        this.m(new THREE.CylinderGeometry(0.2, 0.2, 0.08, 16), metal, 0, 0, 0, gear).rotation.x = Math.PI / 2;
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          this.m(new THREE.BoxGeometry(0.08, 0.08, 0.08), metal, Math.cos(a) * 0.24, Math.sin(a) * 0.24, 0, gear).rotation.z = a;
        }
        break;
      }
      case 'leaf': {
        const stem = this.m(new THREE.CylinderGeometry(0.02, 0.02, 0.25, 6), mat('#3b7a2a'), 0, topY + 0.05, 0);
        stem.rotation.z = 0.2;
        const leaf = this.m(new THREE.SphereGeometry(0.16, 12, 8), mat('#4caf50'), 0.12, topY + 0.2, 0);
        leaf.scale.set(1.3, 0.4, 0.7);
        leaf.rotation.z = 0.5;
        break;
      }
      case 'coin': {
        const coin = this.m(new THREE.CylinderGeometry(0.22, 0.22, 0.05, 20), mat('#ffcc33', { metalness: 0.85, roughness: 0.2 }), 0, topY + 0.3, 0);
        coin.rotation.x = Math.PI / 2;
        coin.name = 'spin';
        break;
      }
      case 'antenna': {
        this.m(new THREE.CylinderGeometry(0.02, 0.02, 0.4, 6), mat('#555555'), 0, topY + 0.1, 0);
        const tip = this.m(new THREE.SphereGeometry(0.07, 10, 8), mat(spec.accentColor, { emissive: spec.accentColor, emissiveIntensity: 1 }), 0, topY + 0.32, 0);
        tip.name = 'blink';
        break;
      }
      case 'none':
      default:
        break;
    }
  }

  update(dt: number, time: number) {
    this.animT += dt;
    const t = this.animT;
    const bob = this.floating ? Math.sin(time * 1.8) * 0.12 + 0.15 : 0;
    const squash = Math.sin(time * 2.4) * 0.04;
    let offset = new THREE.Vector3();
    let tilt = 0;

    this.body.scale.set(this.scale * (1 + squash), this.scale * (1 - squash), this.scale * (1 + squash));

    if (this.anim === 'hit') {
      const d = 0.55;
      if (t < d) {
        const k = t / d;
        const shake = Math.sin(k * 40) * 0.08 * (1 - k);
        offset.copy(this.attackVector).normalize().multiplyScalar(-0.35 * Math.sin(Math.min(1, k * 2) * Math.PI) * (1 - k));
        offset.x += shake;
        tilt = -0.3 * (1 - k);
        this.setFlash(k < 0.6 ? Math.max(0, Math.sin(k * 36)) : 0, '#ffffff');
      } else {
        this.setFlash(0);
        this.anim = 'idle';
      }
    } else if (this.anim === 'attack') {
      const d = 0.6;
      if (t < d) {
        const k = t / d;
        offset.copy(this.attackVector).multiplyScalar(Math.sin(k * Math.PI) * 0.9);
        tilt = Math.sin(k * Math.PI) * 0.3;
      } else this.anim = 'idle';
    } else if (this.anim === 'defeat') {
      const k = Math.min(1, t / 1.2);
      this.body.scale.set(this.scale * (1 + k * 0.3), this.scale * (1 - k * 0.95), this.scale * (1 + k * 0.3));
      this.body.rotation.z = Math.sin(t * 30) * 0.1 * (1 - k);
      this.setFlash(Math.max(0, Math.sin(t * 25)) * (1 - k), '#ffd34d');
      if (k >= 1) this.root.visible = false;
    }

    this.root.position.copy(this.basePos).add(offset);
    this.root.position.y += bob;
    if (this.anim !== 'defeat') this.body.rotation.x = tilt;

    // 目のまばたき
    const blink = (time % 3.3) < 0.12 ? 0.1 : 1;
    for (const e of this.eyes) e.scale.y = blink;
    this.body.traverse((o) => {
      if (o.name === 'spin') o.rotation.y += dt * 2;
      if (o.name === 'wing') o.rotation.y = Math.sign(o.scale.x) * (0.6 + Math.sin(time * 4) * 0.25);
      if (o.name === 'blink' && o instanceof THREE.Mesh) {
        (o.material as THREE.MeshStandardMaterial).emissiveIntensity = (Math.sin(time * 6) + 1) * 0.8;
      }
    });
  }

  private setFlash(v: number, color = '#ffffff') {
    const c = new THREE.Color(color);
    for (const [m, orig] of this.mats) {
      if (v <= 0) {
        m.emissive.copy(orig.c);
        m.emissiveIntensity = orig.i;
      } else {
        m.emissive.copy(c);
        m.emissiveIntensity = v;
      }
    }
  }
}
