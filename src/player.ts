import * as THREE from "three";
import { World, WORLD_BLOCKS } from "./world.js";
import { isSolid, type BlockId } from "./blocks.js";

const WIDTH = 0.6;
const HEIGHT = 1.8;
const EYE = 1.62;
const HALF = WIDTH / 2;

const SPEED = 5.2;
const SPRINT = 8.2;
const GRAVITY = 26;
const JUMP = 8.6;
const REACH = 5.5;

/** Fall of more than SAFE_FALL blocks deals (fall - SAFE_FALL) damage points. */
const SAFE_FALL = 3.5;

export type GameMode = "creative" | "survival";

export interface RayHit {
  block: { x: number; y: number; z: number };
  place: { x: number; y: number; z: number };
}

export class Player {
  readonly camera: THREE.PerspectiveCamera;
  readonly pos: THREE.Vector3;
  mode: GameMode;
  private readonly vel = new THREE.Vector3();
  private yaw = 0;
  private pitch = 0;
  private onGround = false;
  private readonly keys = new Set<string>();
  private readonly world: World;
  private readonly spawn: THREE.Vector3;
  private hp = 20;
  private airPeak: number;
  private touchMove = { x: 0, z: 0 };
  readonly model = new THREE.Group();
  private readonly limbs: THREE.Mesh[] = [];
  private legSwing = 0;

  onDamage?: (hp: number) => void;
  onRespawn?: () => void;

  constructor(world: World, spawn: THREE.Vector3, mode: GameMode = "creative") {
    this.world = world;
    this.mode = mode;
    this.spawn = spawn.clone();
    this.pos = spawn.clone();
    this.airPeak = spawn.y;
    this.camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.buildModel();
    this.syncCamera();
  }

  /** Simple humanoid shown in third-person view. */
  private buildModel(): void {
    const mat = (fill: number): THREE.MeshLambertMaterial => new THREE.MeshLambertMaterial({ color: fill });
    const box = (w: number, h: number, d: number, fill: number, pivotY = 0): THREE.Mesh => {
      const geo = new THREE.BoxGeometry(w, h, d);
      geo.translate(0, pivotY, 0);
      const mesh = new THREE.Mesh(geo, mat(fill));
      this.model.add(mesh);
      if (pivotY !== 0) this.limbs.push(mesh);
      return mesh;
    };
    // legs (pivot at the hip)
    box(0.22, 0.75, 0.26, 0x3b4cc0, -0.375).position.set(-0.13, 0.75, 0);
    box(0.22, 0.75, 0.26, 0x3b4cc0, -0.375).position.set(0.13, 0.75, 0);
    // torso
    box(0.5, 0.66, 0.3, 0x2e8b8b).position.set(0, 1.08, 0);
    // arms (pivot at the shoulder)
    box(0.2, 0.66, 0.24, 0xc8946c, -0.28).position.set(-0.36, 1.4, 0);
    box(0.2, 0.66, 0.24, 0xc8946c, -0.28).position.set(0.36, 1.4, 0);
    // head
    box(0.46, 0.46, 0.46, 0xc8946c).position.set(0, 1.64, 0);
    this.model.visible = false;
  }

  get health(): number {
    return this.hp;
  }

  get maxHealth(): number {
    return 20;
  }

  setMode(mode: GameMode): void {
    this.mode = mode;
    this.hp = this.maxHealth;
    this.airPeak = this.pos.y;
  }

  setKey(code: string, down: boolean): void {
    if (down) this.keys.add(code);
    else this.keys.delete(code);
  }

  /** Analog move input from the touch joystick, in [-1, 1] (strafe, forward). */
  setTouchMove(x: number, z: number): void {
    this.touchMove.x = x;
    this.touchMove.z = z;
  }

  clearKeys(): void {
    this.keys.clear();
  }

  look(dx: number, dy: number): void {
    const s = 0.0024;
    this.yaw -= dx * s;
    this.pitch -= dy * s;
    const lim = Math.PI / 2 - 0.01;
    this.pitch = Math.max(-lim, Math.min(lim, this.pitch));
  }

  getYaw(): number {
    return this.yaw;
  }

  getPitch(): number {
    return this.pitch;
  }

  /** Eye position (first-person camera anchor). */
  eyePosition(target = new THREE.Vector3()): THREE.Vector3 {
    return target.set(this.pos.x, this.pos.y + 1.62, this.pos.z);
  }

  /** Unit vector the camera looks along. */
  lookDirection(target = new THREE.Vector3()): THREE.Vector3 {
    return target.set(0, 0, -1).applyEuler(new THREE.Euler(this.pitch, this.yaw, 0, "YXZ"));
  }

  setModelVisible(visible: boolean): void {
    this.model.visible = visible;
  }

  get onGroundFlag(): boolean {
    return this.onGround;
  }

  /** First-person camera placement (position + rotation). */
  syncCameraOnly(): void {
    this.syncCamera();
  }

  private collides(p: THREE.Vector3): boolean {
    const minX = Math.floor(p.x - HALF);
    const maxX = Math.floor(p.x + HALF);
    const minY = Math.floor(p.y);
    const maxY = Math.floor(p.y + HEIGHT);
    const minZ = Math.floor(p.z - HALF);
    const maxZ = Math.floor(p.z + HALF);
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          if (isSolid(this.world.getBlock(x, y, z) as BlockId)) return true;
        }
      }
    }
    return false;
  }

  update(dt: number): void {
    const forward =
      (this.keys.has("KeyW") ? 1 : 0) -
      (this.keys.has("KeyS") ? 1 : 0) -
      this.touchMove.z;
    const strafe =
      (this.keys.has("KeyD") ? 1 : 0) -
      (this.keys.has("KeyA") ? 1 : 0) +
      this.touchMove.x;
    const speed = this.keys.has("ShiftLeft") ? SPRINT : SPEED;

    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    // forward is -z when yaw 0
    let mx = -sin * forward + cos * strafe;
    let mz = -cos * forward - sin * strafe;
    const len = Math.hypot(mx, mz);
    if (len > 0) {
      // keyboard input has len 1 or sqrt(2); analog input keeps its partial magnitude
      const scale = Math.min(1, len) * speed;
      mx = (mx / len) * scale;
      mz = (mz / len) * scale;
    }
    this.vel.x = mx;
    this.vel.z = mz;

    if (this.keys.has("Space") && this.onGround) {
      this.vel.y = JUMP;
      this.onGround = false;
    }
    this.vel.y -= GRAVITY * dt;

    // Move per-axis with collision resolution.
    const p = this.pos;

    p.x += this.vel.x * dt;
    if (this.collides(p)) {
      p.x -= this.vel.x * dt;
      this.vel.x = 0;
    }

    p.z += this.vel.z * dt;
    if (this.collides(p)) {
      p.z -= this.vel.z * dt;
      this.vel.z = 0;
    }

    p.y += this.vel.y * dt;
    if (this.collides(p)) {
      const movingDown = this.vel.y < 0;
      p.y -= this.vel.y * dt;
      if (movingDown) this.onGround = true;
      this.vel.y = 0;
    } else {
      this.onGround = false;
    }

    // Keep the player inside the world bounds.
    p.x = Math.min(Math.max(p.x, 1), WORLD_BLOCKS - 1);
    p.z = Math.min(Math.max(p.z, 1), WORLD_BLOCKS - 1);

    // Void below the world (e.g. dug straight down): never fall forever.
    if (p.y < -12) {
      this.respawn();
      return;
    }

    this.applyFallDamage(p);

    // third-person body: follow the player, swing limbs while moving
    const moveSpeed = Math.hypot(this.vel.x, this.vel.z);
    this.legSwing += moveSpeed * dt * 3.4;
    let limbIndex = 0;
    for (const limb of this.limbs) {
      const phase = limbIndex % 2 === 0 ? 0 : Math.PI;
      limb.rotation.x = Math.sin(this.legSwing * 2.4 + phase) * Math.min(0.8, moveSpeed * 0.3);
      limbIndex++;
    }
    this.model.position.copy(this.pos);
    this.model.rotation.y = this.yaw;

    this.syncCamera();
  }

  private applyFallDamage(p: THREE.Vector3): void {
    if (this.onGround) {
      const fall = this.airPeak - p.y;
      if (fall > SAFE_FALL && this.mode === "survival") {
        this.damage(Math.floor(fall - SAFE_FALL) + 1);
      }
      this.airPeak = p.y;
      return;
    }
    this.airPeak = Math.max(this.airPeak, p.y);
  }

  damage(points: number): void {
    if (this.mode === "creative" || points <= 0) return;
    this.hp = Math.max(0, this.hp - points);
    this.onDamage?.(this.hp);
    if (this.hp === 0) this.respawn();
  }

  respawn(): void {
    this.pos.copy(this.spawn);
    this.vel.set(0, 0, 0);
    this.hp = this.maxHealth;
    this.airPeak = this.pos.y;
    this.syncCamera();
    this.onRespawn?.();
  }

  private syncCamera(): void {
    this.camera.position.set(this.pos.x, this.pos.y + EYE, this.pos.z);
    this.camera.rotation.set(0, 0, 0, "YXZ");
    this.camera.rotateY(this.yaw);
    this.camera.rotateX(this.pitch);
  }

  /** Voxel raycast from the camera; returns the hit block and the adjacent placement cell. */
  raycast(): RayHit | null {
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    const origin = this.camera.position;
    let px = origin.x;
    let py = origin.y;
    let pz = origin.z;
    const step = 0.05;
    let prev = { x: Math.floor(px), y: Math.floor(py), z: Math.floor(pz) };
    for (let t = 0; t < REACH; t += step) {
      px += dir.x * step;
      py += dir.y * step;
      pz += dir.z * step;
      const cell = { x: Math.floor(px), y: Math.floor(py), z: Math.floor(pz) };
      if (cell.x === prev.x && cell.y === prev.y && cell.z === prev.z) continue;
      if (isSolid(this.world.getBlock(cell.x, cell.y, cell.z) as BlockId)) {
        return { block: cell, place: prev };
      }
      prev = cell;
    }
    return null;
  }

  /** True if the given block cell would overlap the player's body (block-in-feet guard). */
  intersectsCell(x: number, y: number, z: number): boolean {
    const p = this.pos;
    const overlapsX = p.x + HALF > x && p.x - HALF < x + 1;
    const overlapsZ = p.z + HALF > z && p.z - HALF < z + 1;
    const overlapsY = p.y + HEIGHT > y && p.y < y + 1;
    return overlapsX && overlapsY && overlapsZ;
  }
}

export const WORLD_CENTER = WORLD_BLOCKS / 2;
