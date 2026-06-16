import * as THREE from "three";
import { World } from "./world.js";
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

export interface RayHit {
  block: { x: number; y: number; z: number };
  place: { x: number; y: number; z: number };
}

export class Player {
  readonly camera: THREE.PerspectiveCamera;
  readonly pos: THREE.Vector3;
  private readonly vel = new THREE.Vector3();
  private yaw = 0;
  private pitch = 0;
  private onGround = false;
  private readonly keys = new Set<string>();
  private readonly world: World;

  constructor(world: World, spawn: THREE.Vector3) {
    this.world = world;
    this.pos = spawn.clone();
    this.camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.syncCamera();
  }

  setKey(code: string, down: boolean): void {
    if (down) this.keys.add(code);
    else this.keys.delete(code);
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
    const forward = (this.keys.has("KeyW") ? 1 : 0) - (this.keys.has("KeyS") ? 1 : 0);
    const strafe = (this.keys.has("KeyD") ? 1 : 0) - (this.keys.has("KeyA") ? 1 : 0);
    const speed = this.keys.has("ShiftLeft") ? SPRINT : SPEED;

    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    // forward is -z when yaw 0
    let mx = (-sin * forward + cos * strafe);
    let mz = (-cos * forward - sin * strafe);
    const len = Math.hypot(mx, mz);
    if (len > 0) {
      mx = (mx / len) * speed;
      mz = (mz / len) * speed;
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

    // Safety floor.
    if (p.y < -20) {
      p.set(WORLD_CENTER, 60, WORLD_CENTER);
      this.vel.set(0, 0, 0);
    }

    this.syncCamera();
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

export const WORLD_CENTER = (6 * 16) / 2;
