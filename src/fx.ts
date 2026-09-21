import * as THREE from "three";
import { Block, blockFx, type BlockId } from "./blocks.js";

const PARTICLE_POOL = 140;

interface Particle {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
}

/** Block break/place juice: particle bursts, mining cracks and a place pop. */
export class BlockFx {
  private readonly scene: THREE.Scene;
  private readonly pool: Particle[] = [];
  private readonly geo = new THREE.BoxGeometry(0.09, 0.09, 0.09);
  private readonly crackMats: THREE.MeshBasicMaterial[];
  private crackMesh: THREE.Mesh;
  private popMesh: THREE.LineSegments;
  private popLife = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    const crackCanvas = (stage: number): HTMLCanvasElement => {
      const c = document.createElement("canvas");
      c.width = c.height = 64;
      const ctx = c.getContext("2d")!;
      const lines = 5 + stage * 6;
      ctx.strokeStyle = "rgba(0,0,0,0.55)";
      ctx.lineWidth = 2;
      let s = stage * 97 + 13;
      const rnd = (): number => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 4294967296;
      };
      for (let i = 0; i < lines; i++) {
        const x = rnd() * 64;
        const y = rnd() * 64;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + (rnd() - 0.5) * 26, y + (rnd() - 0.5) * 26);
        ctx.stroke();
      }
      return c;
    };

    const crackMats = [0, 1, 2, 3].map((stage) => {
      const tex = new THREE.CanvasTexture(crackCanvas(stage));
      return new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    });
    this.crackMats = crackMats;
    this.crackMesh = new THREE.Mesh(new THREE.BoxGeometry(1.002, 1.002, 1.002), crackMats);
    this.crackMesh.visible = false;
    this.scene.add(this.crackMesh);

    this.popMesh = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1.02, 1.02, 1.02)),
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 })
    );
    this.popMesh.visible = false;
    this.scene.add(this.popMesh);

    for (let i = 0; i < PARTICLE_POOL; i++) {
      const mesh = new THREE.Mesh(this.geo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
      mesh.visible = false;
      this.scene.add(mesh);
      this.pool.push({ mesh, vel: new THREE.Vector3(), life: 0, maxLife: 0.6 });
    }
  }

  /** Colourful burst of mini-cubes where a block just broke. */
  burst(x: number, y: number, z: number, color: number, count = 14): void {
    let spawned = 0;
    for (const p of this.pool) {
      if (p.life > 0) continue;
      p.mesh.position.set(x + 0.2 + Math.random() * 0.6, y + 0.2 + Math.random() * 0.6, z + 0.2 + Math.random() * 0.6);
      (p.mesh.material as THREE.MeshBasicMaterial).color.setHex(color);
      p.vel.set((Math.random() - 0.5) * 3.4, 1.6 + Math.random() * 2.6, (Math.random() - 0.5) * 3.4);
      p.maxLife = 0.45 + Math.random() * 0.3;
      p.life = p.maxLife;
      p.mesh.visible = true;
      p.mesh.scale.setScalar(1);
      if (++spawned >= count) break;
    }
  }

  /** Show the crack overlay on the block being mined, stage 0..3. */
  crack(x: number, y: number, z: number, progress01: number): void {
    const stage = Math.max(0, Math.min(3, Math.floor(progress01 * 4)));
    this.crackMesh.material = this.crackMats[stage];
    this.crackMesh.position.set(x + 0.5, y + 0.5, z + 0.5);
    this.crackMesh.visible = true;
  }

  hideCrack(): void {
    this.crackMesh.visible = false;
  }

  /** Flash the outline of a freshly placed block. */
  placePop(x: number, y: number, z: number): void {
    this.popMesh.position.set(x + 0.5, y + 0.5, z + 0.5);
    this.popLife = 0.18;
    this.popMesh.visible = true;
    (this.popMesh.material as THREE.LineBasicMaterial).opacity = 0.85;
  }

  update(dt: number): void {
    for (const p of this.pool) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.mesh.visible = false;
        continue;
      }
      p.vel.y -= 22 * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.scale.setScalar(Math.max(0.15, p.life / p.maxLife));
    }
    if (this.popLife > 0) {
      this.popLife -= dt;
      const mat = this.popMesh.material as THREE.LineBasicMaterial;
      mat.opacity = Math.max(0, (this.popLife / 0.18) * 0.85);
      if (this.popLife <= 0) this.popMesh.visible = false;
    }
  }

  /** particle colour of a block id */
  static colorOf(id: BlockId): number {
    return blockFx(id as BlockId).particle;
  }

  static hardnessOf(id: BlockId): number {
    return blockFx(id as BlockId).hardness;
  }

  static soundOf(id: BlockId): string {
    return blockFx(id as BlockId).sound;
  }

  static isWater(id: BlockId): boolean {
    return id === Block.Water;
  }
}
