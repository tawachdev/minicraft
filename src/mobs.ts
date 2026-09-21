import * as THREE from "three";
import type { World } from "./world.js";
import { WORLD_BLOCKS } from "./world.js";
import { Block, isSolid, type BlockId } from "./blocks.js";
import type { Player } from "./player.js";

export type MobKind = "pig" | "sheep" | "zombie";

interface MobColors {
  body: number;
  head: number;
  accent: number;
}

const MOB_COLORS: Record<MobKind, MobColors> = {
  pig: { body: 0xe79c9c, head: 0xe79c9c, accent: 0xd3766e },
  sheep: { body: 0xe8e4dc, head: 0xcbb9a5, accent: 0x8a7d6d },
  zombie: { body: 0x3e7a3e, head: 0x4e8f4e, accent: 0x2c3e6b },
};

const GRAVITY = 26;
const WALK_SPEED = 1.2;
const CHASE_SPEED = 1.9;
const FLEE_SPEED = 2.4;
const TURN_TIME = [2, 5];
const CHASE_RANGE = 14;
const FLEE_RANGE = 6;
const ATTACK_RANGE = 0.95;
const ATTACK_COOLDOWN = 0.9;

/** A boxy wanderer, a fleeing animal, or a hostile zombie that hunts at night... and day. */
export class Mob {
  readonly group = new THREE.Group();
  readonly kind: MobKind;
  readonly hostile: boolean;
  hp: number;
  private readonly legs: THREE.Mesh[] = [];
  private readonly mats: THREE.MeshLambertMaterial[] = [];
  private vy = 0;
  private yaw = Math.random() * Math.PI * 2;
  private timer = 1 + Math.random() * 2;
  private legPhase = 0;
  private flashUntil = 0;
  private attackCooldown = 0;

  constructor(kind: MobKind, x: number, y: number, z: number, hp: number) {
    this.kind = kind;
    this.hostile = kind === "zombie";
    this.hp = hp;
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

    if (kind === "zombie") {
      // classic outstretched zombie arms
      for (const side of [-1, 1]) {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.55), mat(colors.body));
        arm.position.set(side * 0.36, 1.0, -0.3);
        this.group.add(arm);
      }
      const legGeo = new THREE.BoxGeometry(0.18, 0.5, 0.18);
      for (const lx of [-0.14, 0.14]) {
        const leg = new THREE.Mesh(legGeo, mat(colors.accent));
        leg.position.set(lx, 0.25, 0);
        this.group.add(leg);
        this.legs.push(leg);
      }
    } else {
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

  horizontalDistTo(x: number, z: number): number {
    return Math.hypot(this.group.position.x - x, this.group.position.z - z);
  }

  attackReady(): boolean {
    return this.attackCooldown === 0;
  }

  spendAttack(): void {
    this.attackCooldown = ATTACK_COOLDOWN;
  }

  update(dt: number, world: World, now: number, moveYaw: number | null, speed: number): void {
    if (this.flashUntil !== 0 && now >= this.flashUntil) {
      for (const m of this.mats) m.emissive.setHex(0x000000);
      this.flashUntil = 0;
    }
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);

    if (moveYaw !== null) {
      this.yaw = moveYaw;
    } else {
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = TURN_TIME[0] + Math.random() * (TURN_TIME[1] - TURN_TIME[0]);
      this.yaw = Math.random() * Math.PI * 2;
    }
    }

    const step = speed * dt;
    const dx = -Math.sin(this.yaw) * step;
    const dz = -Math.cos(this.yaw) * step;

    const p = this.group.position;
    const nx = p.x + dx;
    const nz = p.z + dz;

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

    this.vy -= GRAVITY * dt;
    p.y += this.vy * dt;
    if (isSolid(world.getBlock(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z)) as BlockId)) {
      p.y = Math.floor(p.y) + 1;
      this.vy = 0;
    }

    if (p.y < -10) p.y = 40;

    this.legPhase += dt * speed * 6;
    this.legs.forEach((leg, i) => {
      leg.rotation.x = Math.sin(this.legPhase + (i % 2) * Math.PI) * 0.55;
    });
    this.group.rotation.y = this.yaw;
  }
}

/**
 * A small living world: passive animals that flee, hostile zombies that hunt
 * the player (and animals). Fixed count, box geometry, no pathfinding.
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
    const kinds: MobKind[] = ["pig", "zombie", "sheep", "zombie"];
    let placed = 0;
    let attempts = 0;
    while (placed < count && attempts < count * 40) {
      attempts++;
      const x = Math.floor(center.x + (Math.random() - 0.5) * 70);
      const z = Math.floor(center.z + (Math.random() - 0.5) * 70);
      const kind = kinds[placed % kinds.length];
      const hp = kind === "zombie" ? 3 : 2;
      if (this.trySpawn(kind, x, z, hp)) placed++;
    }
  }

  private trySpawn(kind: MobKind, x: number, z: number, hp: number): boolean {
    for (let y = 40; y > 2; y--) {
      const block = this.world.getBlock(x, y, z) as BlockId;
      if (block === Block.Water) return false;
      if (isSolid(block)) {
        const mob = new Mob(kind, x + 0.5, y + 1, z + 0.5, hp);
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
      this.fx?.burst(p.x, p.y + 0.6, p.z, this.colorOf(mob.kind), 18);
      this.scene.remove(mob.group);
      this.mobs.splice(this.mobs.indexOf(mob), 1);
    }
    return dead;
  }

  private colorOf(kind: MobKind): number {
    return MOB_COLORS[kind].body;
  }

  update(dt: number, now: number, player?: Player): void {
    for (const mob of [...this.mobs]) {
      if (mob.hostile) this.updateZombie(mob, dt, now, player);
      else this.updateAnimal(mob, dt, now);
    }
  }

  private updateZombie(mob: Mob, dt: number, now: number, player: Player | undefined): void {
    // hunt the player first, then the nearest animal
    if (player) {
      const d = mob.horizontalDistTo(player.pos.x, player.pos.z);
      if (d < CHASE_RANGE) {
        const yaw = Math.atan2(-(player.pos.x - mob.group.position.x), -(player.pos.z - mob.group.position.z));
        const dy = Math.abs(player.pos.y - mob.group.position.y);
        mob.update(dt, this.world, now, yaw, CHASE_SPEED);
        if (d < ATTACK_RANGE && dy < 1.6 && mob.attackReady()) {
          player.damage(2);
          mob.spendAttack();
        }
        return;
      }
    }
    const prey = this.nearestPassive(mob, 10);
    if (prey) {
      const yaw = Math.atan2(-(prey.group.position.x - mob.group.position.x), -(prey.group.position.z - mob.group.position.z));
      mob.update(dt, this.world, now, yaw, CHASE_SPEED * 0.8);
      if (mob.horizontalDistTo(prey.group.position.x, prey.group.position.z) < 0.9) {
        const dead = prey.damage(now);
        if (dead) {
          const p = prey.group.position;
          this.fx?.burst(p.x, p.y + 0.6, p.z, this.colorOf(prey.kind), 16);
          this.scene.remove(prey.group);
          this.mobs.splice(this.mobs.indexOf(prey), 1);
        }
      }
      return;
    }
    mob.update(dt, this.world, now, null, WALK_SPEED);
  }

  private updateAnimal(mob: Mob, dt: number, now: number): void {
    // flee the nearest zombie
    let threat: Mob | null = null;
    let threatDist = FLEE_RANGE;
    for (const other of this.mobs) {
      if (!other.hostile) continue;
      const d = mob.horizontalDistTo(other.group.position.x, other.group.position.z);
      if (d < threatDist) {
        threat = other;
        threatDist = d;
      }
    }
    if (threat) {
      const yaw = Math.atan2(
        -(mob.group.position.x - threat.group.position.x),
        -(mob.group.position.z - threat.group.position.z)
      );
      mob.update(dt, this.world, now, yaw, FLEE_SPEED);
      return;
    }
    mob.update(dt, this.world, now, null, WALK_SPEED);
  }

  private nearestPassive(mob: Mob, range: number): Mob | null {
    let best: Mob | null = null;
    let bestDist = range;
    for (const other of this.mobs) {
      if (other.hostile || other === mob) continue;
      const d = mob.horizontalDistTo(other.group.position.x, other.group.position.z);
      if (d < bestDist) {
        best = other;
        bestDist = d;
      }
    }
    return best;
  }
}
