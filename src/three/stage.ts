import * as THREE from 'three';
import type { SpriteInfo } from '../data/sprites';
import { SpriteActor, type ActorAnim } from './spriteActor';

export type StageMode = 'viewer' | 'battle';

interface Burst {
  points: THREE.Points;
  velocities: Float32Array;
  life: number;
}

/**
 * Three.js のレンダラ・カメラ・入力（ドラッグ回転/ピンチズーム）を管理するステージ。
 * React からは命令的APIで操作する。
 */
export class Stage {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private turntable = new THREE.Group();
  private clock = new THREE.Clock();
  private raf = 0;
  private ro: ResizeObserver;
  private hero: SpriteActor | null = null;
  private monster: SpriteActor | null = null;
  private bursts: Burst[] = [];
  private ring: THREE.Mesh;

  // 入力
  private yaw = 0;
  private yawVel = 0;
  private pitch = 0;
  private distance: number;
  private minDist: number;
  private maxDist: number;
  private pointers = new Map<number, { x: number; y: number }>();
  private pinchStart = 0;
  private pinchDist0 = 0;
  private lastInteraction = 0;
  private tapStart: { x: number; y: number; t: number } | null = null;
  private disposed = false;
  /** 縦長画面で左右の2体が収まるように距離を伸ばす倍率 */
  private fitScale = 1;

  constructor(private container: HTMLElement, private mode: StageMode) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = false;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    const canvas = this.renderer.domElement;
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.touchAction = mode === 'battle' ? 'none' : 'pan-y';
    canvas.style.cursor = 'grab';
    container.appendChild(canvas);

    this.distance = mode === 'battle' ? 6.2 : 3.7;
    this.minDist = mode === 'battle' ? 4 : 2.6;
    this.maxDist = mode === 'battle' ? 9 : 7;
    this.camera = new THREE.PerspectiveCamera(mode === 'battle' ? 38 : 35, 1, 0.1, 100);

    // ---- ライト ----
    this.scene.add(new THREE.HemisphereLight('#dfe8ff', '#3a2a4a', 1.1));
    const key = new THREE.DirectionalLight('#fff4dc', 2.2);
    key.position.set(3, 6, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -4;
    key.shadow.camera.right = 4;
    key.shadow.camera.top = 4;
    key.shadow.camera.bottom = -4;
    key.shadow.bias = -0.0015;
    this.scene.add(key);
    const rim = new THREE.DirectionalLight('#7fb2ff', 1.0);
    rim.position.set(-4, 3, -4);
    this.scene.add(rim);
    // 参考画像のような暖色の縁取り光
    const warm = new THREE.DirectionalLight('#ffd9a0', 0.9);
    warm.position.set(2, 2, -5);
    this.scene.add(warm);

    // ---- 床（魔法陣風の台座） ----
    this.scene.add(this.turntable);
    const groundR = mode === 'battle' ? 3.6 : 1.6;
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(groundR, 48),
      new THREE.MeshStandardMaterial({ color: '#1d2448', roughness: 0.9, transparent: true, opacity: 0.85 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.turntable.add(ground);
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(groundR * 0.94, groundR, 64),
      new THREE.MeshBasicMaterial({ color: '#ffd166', transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.005;
    this.turntable.add(this.ring);
    const inner = new THREE.Mesh(
      new THREE.RingGeometry(groundR * 0.6, groundR * 0.62, 6),
      new THREE.MeshBasicMaterial({ color: '#8ab4ff', transparent: true, opacity: 0.45, side: THREE.DoubleSide }),
    );
    inner.rotation.x = -Math.PI / 2;
    inner.position.y = 0.006;
    inner.name = 'inner';
    this.turntable.add(inner);
    // 影を受ける透明な床
    const shadowPlane = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.ShadowMaterial({ opacity: 0.35 }));
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = 0.01;
    shadowPlane.receiveShadow = true;
    this.turntable.add(shadowPlane);

    // ---- 入力 ----
    canvas.addEventListener('pointerdown', this.onDown);
    window.addEventListener('pointermove', this.onMove, { passive: true });
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onUp);
    canvas.addEventListener('wheel', this.onWheel, { passive: false });

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.resize();
    this.loop();
  }

  // ------------------------------------------------------------
  setHero(sprite: SpriteInfo) {
    if (this.hero) {
      this.turntable.remove(this.hero.root);
      this.hero.dispose();
    }
    const battle = this.mode === 'battle';
    this.hero = new SpriteActor(sprite, { face: battle ? 'right' : 'front' });
    if (battle) {
      this.hero.setBasePosition(new THREE.Vector3(-1.55, 0, 0.25));
      this.hero.attackVector.set(1.8, 0, -0.1);
    } else {
      this.hero.setBasePosition(new THREE.Vector3(0, 0, 0));
      this.hero.attackVector.set(0, 0, 0.9);
    }
    this.turntable.add(this.hero.root);
  }

  setMonster(sprite: SpriteInfo | null) {
    if (this.monster) {
      this.turntable.remove(this.monster.root);
      this.monster.dispose();
      this.monster = null;
    }
    if (!sprite) return;
    this.monster = new SpriteActor(sprite, { face: 'left', floating: sprite.floating });
    this.monster.setBasePosition(new THREE.Vector3(1.55, 0, -0.1));
    this.monster.attackVector.set(-1.7, 0, 0.1);
    this.turntable.add(this.monster.root);
  }

  playHero(anim: ActorAnim) {
    this.hero?.play(anim);
  }

  playMonster(anim: ActorAnim) {
    this.monster?.play(anim);
  }

  reviveMonster() {
    this.monster?.revive();
  }

  /** 黄金の粒子（正解）/ 赤い粒子（被弾） */
  burst(target: 'hero' | 'monster', color: string, count = 60) {
    const obj = target === 'hero' ? this.hero?.root : this.monster?.root;
    if (!obj) return;
    const origin = obj.position.clone().add(new THREE.Vector3(0, 1, 0));
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = origin.x;
      positions[i * 3 + 1] = origin.y;
      positions[i * 3 + 2] = origin.z;
      const a = Math.random() * Math.PI * 2;
      const b = Math.random() * Math.PI - Math.PI / 2;
      const sp = 1.5 + Math.random() * 3;
      velocities[i * 3] = Math.cos(a) * Math.cos(b) * sp;
      velocities[i * 3 + 1] = Math.abs(Math.sin(b)) * sp + 1;
      velocities[i * 3 + 2] = Math.sin(a) * Math.cos(b) * sp;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const points = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ color, size: 0.09, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    this.turntable.add(points);
    this.bursts.push({ points, velocities, life: 1 });
  }

  resetView() {
    this.yaw = 0;
    this.yawVel = 0;
    this.pitch = 0;
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('pointerdown', this.onDown);
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('pointercancel', this.onUp);
    canvas.removeEventListener('wheel', this.onWheel);
    this.hero?.dispose();
    this.monster?.dispose();
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Points) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    });
    this.renderer.dispose();
    canvas.remove();
  }

  // ------------------------------------------------------------
  private resize() {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    // バトルでは自キャラとモンスター（横幅 約±2.75、高さ 約3.2）がちょうど収まる距離にする
    if (this.mode === 'battle') {
      const halfTan = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
      const fitDist = Math.max(2.75 / (halfTan * this.camera.aspect), 1.6 / halfTan);
      this.fitScale = fitDist / 6.2;
    }
  }

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    if (document.hidden) return;
    const dt = Math.min(0.05, this.clock.getDelta());
    const time = this.clock.elapsedTime;

    // 慣性回転
    if (this.pointers.size === 0) {
      this.yaw += this.yawVel * dt;
      this.yawVel *= Math.pow(0.04, dt);
      // バトルでは一定時間操作が無ければ正面構図に戻す
      if (this.mode === 'battle' && performance.now() - this.lastInteraction > 2500) {
        const target = Math.round(this.yaw / (Math.PI * 2)) * Math.PI * 2;
        this.yaw += (target - this.yaw) * Math.min(1, dt * 2);
        this.pitch += (0 - this.pitch) * Math.min(1, dt * 2);
      }
    }
    this.turntable.rotation.y = this.yaw;

    const lookY = this.mode === 'battle' ? 1.2 : 1.0;
    const camPitch = (this.mode === 'battle' ? 0.2 : 0.12) + this.pitch;
    const dist = this.distance * this.fitScale;
    this.camera.position.set(0, lookY + Math.sin(camPitch) * dist, Math.cos(camPitch) * dist);
    this.camera.lookAt(0, lookY, 0);

    this.hero?.update(dt, time, this.yaw);
    this.monster?.update(dt, time, this.yaw);

    const inner = this.turntable.getObjectByName('inner');
    if (inner) inner.rotation.z = time * 0.3;
    (this.ring.material as THREE.MeshBasicMaterial).opacity = 0.55 + Math.sin(time * 2) * 0.25;

    // パーティクル
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i];
      b.life -= dt * 1.2;
      const pos = b.points.geometry.attributes.position as THREE.BufferAttribute;
      const arr = pos.array as Float32Array;
      for (let j = 0; j < arr.length; j += 3) {
        b.velocities[j + 1] -= 6 * dt;
        arr[j] += b.velocities[j] * dt;
        arr[j + 1] += b.velocities[j + 1] * dt;
        arr[j + 2] += b.velocities[j + 2] * dt;
      }
      pos.needsUpdate = true;
      (b.points.material as THREE.PointsMaterial).opacity = Math.max(0, b.life);
      if (b.life <= 0) {
        this.turntable.remove(b.points);
        b.points.geometry.dispose();
        (b.points.material as THREE.Material).dispose();
        this.bursts.splice(i, 1);
      }
    }

    this.renderer.render(this.scene, this.camera);
  };

  private onDown = (e: PointerEvent) => {
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.tapStart = this.pointers.size === 1 ? { x: e.clientX, y: e.clientY, t: performance.now() } : null;
    this.lastInteraction = performance.now();
    this.renderer.domElement.style.cursor = 'grabbing';
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      this.pinchDist0 = Math.hypot(a.x - b.x, a.y - b.y);
      this.pinchStart = this.distance;
    }
  };

  private onMove = (e: PointerEvent) => {
    const prev = this.pointers.get(e.pointerId);
    if (!prev) return;
    const cur = { x: e.clientX, y: e.clientY };
    this.pointers.set(e.pointerId, cur);
    this.lastInteraction = performance.now();
    if (this.pointers.size === 1) {
      const dx = cur.x - prev.x;
      const dy = cur.y - prev.y;
      const w = this.container.clientWidth || 300;
      const dYaw = (dx / w) * Math.PI * 2;
      this.yaw += dYaw;
      this.yawVel = dYaw * 60;
      this.pitch = THREE.MathUtils.clamp(this.pitch + (dy / w) * 1.2, -0.15, 0.7);
    } else if (this.pointers.size === 2 && this.pinchDist0 > 0) {
      const [a, b] = [...this.pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      this.distance = THREE.MathUtils.clamp(this.pinchStart * (this.pinchDist0 / d), this.minDist, this.maxDist);
    }
  };

  private onUp = (e: PointerEvent) => {
    // キャラ表示画面ではタップで攻撃モーションを試せる
    if (this.tapStart && this.mode === 'viewer' && this.pointers.has(e.pointerId)) {
      const moved = Math.hypot(e.clientX - this.tapStart.x, e.clientY - this.tapStart.y);
      if (moved < 8 && performance.now() - this.tapStart.t < 400) this.hero?.play('attack');
    }
    this.tapStart = null;
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.pinchDist0 = 0;
    if (this.pointers.size === 0) this.renderer.domElement.style.cursor = 'grab';
  };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    this.distance = THREE.MathUtils.clamp(this.distance * (1 + e.deltaY * 0.001), this.minDist, this.maxDist);
  };
}
