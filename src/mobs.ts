import * as THREE from "three";
import type { World } from "./world.js";
import { WORLD_BLOCKS } from "./world.js";
import { Block, isSolid, type BlockId } from "./blocks.js";

type MobKind = "pig" | "sheep";

interface MobColors {
  body: number;
  head: number;
  accent: number;
}

const MOB_COLORS: Record<MobKind, MobColors> = {
  pig: { body: 0xe79c9c, head: 0xe79c9c, accent: 0xd3766e },
  sheep: { body: 0xe8e4dc, head: 0xcbb9a5, accent: 0x8a7d6d },
};

const GRAVITY = 26;
const WALK_SPEED = 1.2;
const TURN_TIME = [2, 5];

/** A boxy wanderer (pig or sheep) with just enough AI to feel alive. */
export class Mob {
  readonly group = new THREE.Group();
  private readonly legs: THREE.Mesh[] = [];
  private readonly mats: THREE.MeshLambertMaterial[] = [];
  private vy = 0;
  private yaw = Math.random() * Math.PI * 2;
  private timer = 1 + Math.random() * 2;
  private walking = true;
  private legPhase = 0;
  private flashUntil = 0;
  hp = 2;
  readonly kind: MobKind;

  constructor(kind: MobKind, x: number, y: number, z: number) {
    this.kind = kind;
    const colors = MOB_COLORS[kind];
    const mat = (fill: number): THREE.MeshLambertMaterial => {
      const m = new THREE.MeshLambertMaterial({ color: fill });
      this.mats.push(m);
      return m;
    };

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.55, 1.0), mat(colors.body));
    body.position.set(0, 0.62, 0);
    this.group.add(body);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.4), mat(colors.head));
    head.position.set(0, 0.78, -0.62);
    this.group.add(head);

    if (kind === "pig") {
      const snout = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, 0.1), mat(colors.accent));
      snout.position.set(0, 0.72, -0.86);
      this.group.add(snout);
    }

    const legGeo = new THREE.BoxGeometry(0.16, 0.36, 0.16);
    for (const [lx, lz] of [
      [-0.18, -0.3],
      [0.18, -0.3],
      [-0.18, 0.3],
      [0.18, 0.3],
    ]) {
      const leg = new THREE.Mesh(legGeo, mat(colors.accent));
      leg.position.set(lx, 0.18, lz);
      this.group.add(leg);
      this.legs.push(leg);
    }

    this.group.position.set(x, y, z);
  }

  /** Centre of the body, used as the combat hit target. */
  center(target: THREE.Vector3): THREE.Vector3 {
    return target.copy(this.group.position).add(new THREE.Vector3(0, 0.6, 0));
  }

  /** Take a hit and flash red. Returns false when the mob is still alive. */
  damage(now: number): boolean {
    this.hp -= 1;
    this.flashUntil = now + 140;
    for (const m of this.mats) m.emissive.setHex(0xff2233);
    return this.hp <= 0;
  }

  update(dt: number, world: World, now: number): void {
    if (this.flashUntil !== 0 && now >= this.flashUntil) {
      for (const m of this.mats) m.emissive.setHex(0x000000);
      this.flashUntil = 0;
    }

    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = TURN_TIME[0] + Math.random() * (TURN_TIME[1] - TURN_TIME[0]);
      this.yaw = Math.random() * Math.PI * 2;
      this.walking = Math.random() > 0.25;
    }

    const speed = this.walking ? WALK_SPEED : 0;
    const dx = -Math.sin(this.yaw) * speed * dt;
    const dz = -Math.cos(this.yaw) * speed * dt;

    const p = this.group.position;
    const nx = p.x + dx;
    const nz = p.z + dz;

    // look one cell ahead at foot level: water means turn around, walls mean hop or turn
    const ax = Math.floor(nx - Math.sin(this.yaw) * 0.45);
    const az = Math.floor(nz - Math.cos(this.yaw) * 0.45);
    const footY = Math.floor(p.y + 0.1);
    const ahead = world.getBlock(ax, footY, az) as BlockId;
    const aheadHigh = world.getBlock(ax, footY + 1, az) as BlockId;

    const insideBounds = nx > 2 && nz > 2 && nx < WORLD_BLOCKS - 2 && nz < WORLD_BLOCKS - 2;
    if (!insideBounds || ahead === Block.Water) {
      this.yaw += Math.PI;
    } else if (isSolid(ahead)) {
      if (!isSolid(aheadHigh)) this.vy = 8.2; // hop the one-block step
      else this.yaw += Math.PI / 2 + Math.random() * Math.PI;
    } else {
      p.x = nx;
      p.z = nz;
    }

    // gravity + ground collision (feet cell)
    this.vy -= GRAVITY * dt;
    p.y += this.vy * dt;
    if (isSolid(world.getBlock(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z)) as BlockId)) {
      p.y = Math.floor(p.y) + 1;
      this.vy = 0;
    }

    if (p.y < -10) p.y = 40; // safety net, should not happen

    // leg swing while walking
    this.legPhase += dt * speed * 6;
    this.legs.forEach((leg, i) => {
      leg.rotation.x = Math.sin(this.legPhase + (i % 2) * Math.PI) * 0.55;
    });
    this.group.rotation.y = this.yaw;
  }
}

/**
 * A small herd of wandering animals. Deliberately tiny: fixed count, no
 * pathfinding, box geometry — the whole herd costs less than one chunk mesh.
 */
export class Mobs {
  private readonly mobs: Mob[] = [];
  private readonly world: World;
  private readonly scene: THREE.Scene;
  private readonly fx?: { burst: (x: number, y: number, z: number, color: number, count?: number) => void };

  constructor(
    world: World,
    scene: THREE.Scene,
    count: number,
    center: THREE.Vector3,
    fx?: { burst: (x: number, y: number, z: number, color: number, count?: number) => void }
  ) {
    this.world = world;
    this.scene = scene;
    if (fx) this.fx = fx;
    const kinds: MobKind[] = ["pig", "sheep"];
    let placed = 0;
    let attempts = 0;
    while (placed < count && attempts < count * 40) {
      attempts++;
      const x = Math.floor(center.x + (Math.random() - 0.5) * 60);
      const z = Math.floor(center.z + (Math.random() - 0.5) * 60);
      const kind = kinds[placed % kinds.length];
      if (this.trySpawn(kind, x, z)) placed++;
    }
  }

  private trySpawn(kind: MobKind, x: number, z: number): boolean {
    for (let y = 40; y > 2; y--) {
      const block = this.world.getBlock(x, y, z) as BlockId;
      if (block === Block.Water) return false;
      if (isSolid(block)) {
        const mob = new Mob(kind, x + 0.5, y + 1, z + 0.5);
        this.mobs.push(mob);
        this.scene.add(mob.group);
        return true;
      }
    }
    return false;
  }

  /** Nearest mob under the crosshair, or null. */
  raycastHit(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number): Mob | null {
    let best: Mob | null = null;
    let bestT = maxDist;
    const to = new THREE.Vector3();
    for (const mob of this.mobs) {
      const c = mob.center(to.clone());
      const t = c.clone().sub(origin).dot(dir);
      if (t < 0.3 || t > bestT) continue;
      const perp = c.clone().sub(origin).addScaledVector(dir, -t).length();
      if (perp < 0.75) {
        best = mob;
        bestT = t;
      }
    }
    return best;
  }

  /** Apply a hit. Returns true when the mob died (it removes itself with a poof). */
  hit(mob: Mob, now: number): boolean {
    const dead = mob.damage(now);
    if (dead) {
      const p = mob.group.position;
      this.fx?.burst(p.x, p.y + 0.6, p.z, this.mobColor(mob.kind), 18);
      this.scene.remove(mob.group);
      this.mobs.splice(this.mobs.indexOf(mob), 1);
    }
    return dead;
  }

  private mobColor(kind: MobKind): number {
    return kind === "pig" ? 0xe79c9c : 0xe8e4dc;
  }

  update(dt: number, now: number): void {
    for (const mob of this.mobs) mob.update(dt, this.world, now);
  }
}
