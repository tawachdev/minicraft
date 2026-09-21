import * as THREE from "three";
import { createNoise2D } from "simplex-noise";
import {
  Block,
  type BlockId,
  type FaceKind,
  isOpaque,
  isWater,
  tileForKind,
} from "./blocks.js";
import { tileUV } from "./textures.js";

export const CHUNK = 16;
export const WORLD_CHUNKS = 12;
export const HEIGHT = 48;
export const SEA_LEVEL = 14;
export const WORLD_BLOCKS = WORLD_CHUNKS * CHUNK;
/** Chunks within this radius (in chunks) of the view stay meshed. */
export const VIEW_RADIUS = 3;

interface Face {
  kind: FaceKind;
  dir: readonly [number, number, number];
  corners: ReadonlyArray<{ pos: readonly [number, number, number]; uv: readonly [number, number] }>;
}

const FACES: readonly Face[] = [
  { kind: "side", dir: [-1, 0, 0], corners: [ { pos: [0, 1, 0], uv: [0, 1] }, { pos: [0, 0, 0], uv: [0, 0] }, { pos: [0, 1, 1], uv: [1, 1] }, { pos: [0, 0, 1], uv: [1, 0] } ] },
  { kind: "side", dir: [1, 0, 0], corners: [ { pos: [1, 1, 1], uv: [0, 1] }, { pos: [1, 0, 1], uv: [0, 0] }, { pos: [1, 1, 0], uv: [1, 1] }, { pos: [1, 0, 0], uv: [1, 0] } ] },
  { kind: "bottom", dir: [0, -1, 0], corners: [ { pos: [1, 0, 1], uv: [1, 0] }, { pos: [0, 0, 1], uv: [0, 0] }, { pos: [1, 0, 0], uv: [1, 1] }, { pos: [0, 0, 0], uv: [0, 1] } ] },
  { kind: "top", dir: [0, 1, 0], corners: [ { pos: [0, 1, 1], uv: [0, 1] }, { pos: [1, 1, 1], uv: [1, 1] }, { pos: [0, 1, 0], uv: [0, 0] }, { pos: [1, 1, 0], uv: [1, 0] } ] },
  { kind: "side", dir: [0, 0, -1], corners: [ { pos: [1, 0, 0], uv: [0, 0] }, { pos: [0, 0, 0], uv: [1, 0] }, { pos: [1, 1, 0], uv: [0, 1] }, { pos: [0, 1, 0], uv: [1, 1] } ] },
  { kind: "side", dir: [0, 0, 1], corners: [ { pos: [0, 0, 1], uv: [0, 0] }, { pos: [1, 0, 1], uv: [1, 0] }, { pos: [0, 1, 1], uv: [0, 1] }, { pos: [1, 1, 1], uv: [1, 1] } ] },
];

class Chunk {
  readonly cx: number;
  readonly cz: number;
  readonly data: Uint8Array;
  opaqueMesh: THREE.Mesh | null = null;
  waterMesh: THREE.Mesh | null = null;
  meshed = false;

  constructor(cx: number, cz: number) {
    this.cx = cx;
    this.cz = cz;
    this.data = new Uint8Array(CHUNK * HEIGHT * CHUNK);
  }

  idx(lx: number, ly: number, lz: number): number {
    return ly * CHUNK * CHUNK + lz * CHUNK + lx;
  }
}

/**
 * Fixed-size voxel world with lazy chunk meshing: voxel data for the whole map
 * exists from the start, but chunk meshes are built on demand (budgeted) around
 * the viewer, which keeps the world large without startup or frame hitches.
 */
export class World {
  private readonly scene: THREE.Scene;
  private readonly chunks = new Map<string, Chunk>();
  private readonly opaqueMat: THREE.Material;
  private readonly waterMat: THREE.Material;
  private readonly noise2D: (x: number, y: number) => number;

  constructor(scene: THREE.Scene, atlas: THREE.Texture, seed = 1337) {
    this.scene = scene;
    this.opaqueMat = new THREE.MeshLambertMaterial({ map: atlas });
    this.waterMat = new THREE.MeshLambertMaterial({ map: atlas, transparent: true, opacity: 0.72, depthWrite: false });

    let s = seed;
    const rand = () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
    this.noise2D = createNoise2D(rand);

    for (let cx = 0; cx < WORLD_CHUNKS; cx++) {
      for (let cz = 0; cz < WORLD_CHUNKS; cz++) {
        const chunk = new Chunk(cx, cz);
        this.chunks.set(this.key(cx, cz), chunk);
        this.generateChunkData(chunk);
      }
    }
    this.plantTrees();
  }

  private key(cx: number, cz: number): string {
    return `${cx},${cz}`;
  }

  private chunkAt(cx: number, cz: number): Chunk | undefined {
    return this.chunks.get(this.key(cx, cz));
  }

  getBlock(x: number, y: number, z: number): BlockId {
    if (y < 0 || y >= HEIGHT || x < 0 || z < 0 || x >= WORLD_BLOCKS || z >= WORLD_BLOCKS) return Block.Air;
    const cx = Math.floor(x / CHUNK);
    const cz = Math.floor(z / CHUNK);
    const chunk = this.chunkAt(cx, cz);
    if (!chunk) return Block.Air;
    return chunk.data[chunk.idx(x - cx * CHUNK, y, z - cz * CHUNK)] as BlockId;
  }

  /** Topmost solid block y at a column, or -1 when the column has no ground. */
  surfaceY(x: number, z: number): number {
    if (x < 0 || z < 0 || x >= WORLD_BLOCKS || z >= WORLD_BLOCKS) return -1;
    for (let y = HEIGHT - 1; y >= 0; y--) {
      const b = this.getBlock(x, y, z) as BlockId;
      if (b !== Block.Air && b !== Block.Water) return y;
    }
    return -1;
  }

  /** Nearest column with a walkable surface (solid top + headroom) around a point. */
  findSafeSurface(x: number, z: number, maxRadius: number): { x: number; y: number; z: number } | null {
    const sx = Math.floor(x);
    const sz = Math.floor(z);
    for (let r = 0; r <= maxRadius; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const cx = sx + dx;
          const cz = sz + dz;
          const top = this.surfaceY(cx, cz);
          if (top < 0 || top >= HEIGHT - 2) continue;
          const head1 = this.getBlock(cx, top + 1, cz) as BlockId;
          const head2 = this.getBlock(cx, top + 2, cz) as BlockId;
          if (head1 === Block.Air && head2 === Block.Air) {
            return { x: cx, y: top + 1, z: cz };
          }
        }
      }
    }
    return null;
  }

  private setRaw(x: number, y: number, z: number, id: BlockId): void {
    if (y < 0 || y >= HEIGHT || x < 0 || z < 0 || x >= WORLD_BLOCKS || z >= WORLD_BLOCKS) return;
    const cx = Math.floor(x / CHUNK);
    const cz = Math.floor(z / CHUNK);
    const chunk = this.chunkAt(cx, cz);
    if (!chunk) return;
    chunk.data[chunk.idx(x - cx * CHUNK, y, z - cz * CHUNK)] = id;
  }

  /** Player edit: set a block and rebuild the affected chunk(s). */
  setBlock(x: number, y: number, z: number, id: BlockId): void {
    this.setRaw(x, y, z, id);
    const cx = Math.floor(x / CHUNK);
    const cz = Math.floor(z / CHUNK);
    const lx = x - cx * CHUNK;
    const lz = z - cz * CHUNK;
    const dirty = new Set<string>([this.key(cx, cz)]);
    if (lx === 0) dirty.add(this.key(cx - 1, cz));
    if (lx === CHUNK - 1) dirty.add(this.key(cx + 1, cz));
    if (lz === 0) dirty.add(this.key(cx, cz - 1));
    if (lz === CHUNK - 1) dirty.add(this.key(cx, cz + 1));
    for (const k of dirty) {
      const c = this.chunks.get(k);
      if (c && c.meshed) this.buildChunkMesh(c);
    }
  }

  /** Mesh the nearest unmeshed chunk inside the view radius (budget: one per call). */
  update(view: THREE.Vector3): void {
    const vcx = Math.floor(view.x / CHUNK);
    const vcz = Math.floor(view.z / CHUNK);
    let best: Chunk | null = null;
    let bestDist = Infinity;
    for (const chunk of this.chunks.values()) {
      if (chunk.meshed) continue;
      const dx = chunk.cx - vcx;
      const dz = chunk.cz - vcz;
      const dist = dx * dx + dz * dz;
      if (dist <= VIEW_RADIUS * VIEW_RADIUS && dist < bestDist) {
        best = chunk;
        bestDist = dist;
      }
    }
    if (best) this.buildChunkMesh(best);
  }

  private generateChunkData(chunk: Chunk): void {
    for (let lx = 0; lx < CHUNK; lx++) {
      for (let lz = 0; lz < CHUNK; lz++) {
        const x = chunk.cx * CHUNK + lx;
        const z = chunk.cz * CHUNK + lz;
        const h = Math.max(1, Math.min(HEIGHT - 6, this.heightAt(x, z)));
        for (let y = 0; y <= h; y++) {
          let block: BlockId = Block.Stone;
          if (y === h) {
            if (h <= SEA_LEVEL) block = Block.Sand;
            else block = Block.Grass;
          } else if (y > h - 4) {
            block = h <= SEA_LEVEL ? Block.Sand : Block.Dirt;
          }
          this.setRaw(x, y, z, block);
        }
        for (let y = h + 1; y <= SEA_LEVEL; y++) this.setRaw(x, y, z, Block.Water);
      }
    }
  }

  private heightAt(x: number, z: number): number {
    const n =
      this.noise2D(x / 64, z / 64) * 1.0 +
      this.noise2D(x / 32, z / 32) * 0.4 +
      this.noise2D(x / 16, z / 16) * 0.18;
    const norm = (n + 1.58) / 3.16; // roughly 0..1
    return Math.floor(SEA_LEVEL - 4 + norm * 20);
  }

  private plantTrees(): void {
    let s = 9876;
    const rand = () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
    for (let x = 3; x < WORLD_BLOCKS - 3; x++) {
      for (let z = 3; z < WORLD_BLOCKS - 3; z++) {
        if (rand() > 0.985) {
          const h = this.heightAt(x, z);
          if (h <= SEA_LEVEL + 1) continue;
          if (this.getBlock(x, h, z) !== Block.Grass) continue;
          const trunk = 4 + Math.floor(rand() * 2);
          const topY = h + trunk;
          for (let y = h + 1; y <= topY; y++) this.setRaw(x, y, z, Block.Log);
          for (let dy = -1; dy <= 1; dy++) {
            const r = dy === 1 ? 1 : 2;
            for (let dx = -r; dx <= r; dx++) {
              for (let dz = -r; dz <= r; dz++) {
                if (dx === 0 && dz === 0 && dy <= 0) continue;
                if (Math.abs(dx) === r && Math.abs(dz) === r && rand() > 0.5) continue;
                const yy = topY + dy;
                if (this.getBlock(x + dx, yy, z + dz) === Block.Air) this.setRaw(x + dx, yy, z + dz, Block.Leaves);
              }
            }
          }
        }
      }
    }
  }

  private buildChunkMesh(chunk: Chunk): void {
    const op = { pos: [] as number[], norm: [] as number[], uv: [] as number[], idx: [] as number[] };
    const wa = { pos: [] as number[], norm: [] as number[], uv: [] as number[], idx: [] as number[] };
    const baseX = chunk.cx * CHUNK;
    const baseZ = chunk.cz * CHUNK;

    for (let lx = 0; lx < CHUNK; lx++) {
      for (let ly = 0; ly < HEIGHT; ly++) {
        for (let lz = 0; lz < CHUNK; lz++) {
          const wx = baseX + lx;
          const wy = ly;
          const wz = baseZ + lz;
          const block = this.getBlock(wx, wy, wz);
          if (block === Block.Air) continue;
          const water = isWater(block);
          const target = water ? wa : op;

          for (const face of FACES) {
            const nx = wx + face.dir[0];
            const ny = wy + face.dir[1];
            const nz = wz + face.dir[2];
            const neighbor = this.getBlock(nx, ny, nz);
            if (water) {
              if (neighbor !== Block.Air) continue; // only the exposed water surface
            } else if (isOpaque(neighbor)) {
              continue; // hidden between solids
            }

            const [u0, v0, u1, v1] = tileUV(tileForKind(block, face.kind));
            const start = target.pos.length / 3;
            for (const corner of face.corners) {
              target.pos.push(lx + corner.pos[0], wy + corner.pos[1], lz + corner.pos[2]);
              target.norm.push(face.dir[0], face.dir[1], face.dir[2]);
              target.uv.push(u0 + corner.uv[0] * (u1 - u0), v0 + corner.uv[1] * (v1 - v0));
            }
            target.idx.push(start, start + 1, start + 2, start + 2, start + 1, start + 3);
          }
        }
      }
    }

    chunk.opaqueMesh = this.swapMesh(chunk.opaqueMesh, op, this.opaqueMat, baseX, baseZ);
    chunk.waterMesh = this.swapMesh(chunk.waterMesh, wa, this.waterMat, baseX, baseZ);
    chunk.meshed = true;
  }

  private swapMesh(
    existing: THREE.Mesh | null,
    buf: { pos: number[]; norm: number[]; uv: number[]; idx: number[] },
    material: THREE.Material,
    baseX: number,
    baseZ: number
  ): THREE.Mesh | null {
    if (existing) {
      this.scene.remove(existing);
      existing.geometry.dispose();
    }
    if (buf.idx.length === 0) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(buf.pos, 3));
    geo.setAttribute("normal", new THREE.Float32BufferAttribute(buf.norm, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(buf.uv, 2));
    geo.setIndex(buf.idx);
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(baseX, 0, baseZ);
    this.scene.add(mesh);
    return mesh;
  }
}
