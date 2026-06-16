import * as THREE from "three";
import { World, WORLD_BLOCKS, HEIGHT } from "./world.js";
import { Player } from "./player.js";
import { Hotbar } from "./ui.js";
import { makeAtlasTexture } from "./textures.js";
import { Block } from "./blocks.js";

const canvas = document.getElementById("game") as HTMLCanvasElement;
const overlay = document.getElementById("overlay") as HTMLDivElement;
const hud = document.getElementById("hud") as HTMLDivElement;
const playBtn = document.getElementById("play") as HTMLButtonElement;
const hotbarEl = document.getElementById("hotbar") as HTMLDivElement;
const debugEl = document.getElementById("debug") as HTMLDivElement;

// ---------- Renderer / scene ----------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
const SKY = new THREE.Color(0x88c4ff);
scene.background = SKY;
scene.fog = new THREE.Fog(SKY, 40, WORLD_BLOCKS * 0.9);

const atlas = makeAtlasTexture();
const world = new World(scene, atlas);

// Lighting.
scene.add(new THREE.HemisphereLight(0xffffff, 0x6688aa, 1.0));
const sun = new THREE.DirectionalLight(0xfff2cc, 1.1);
sun.position.set(60, 120, 30);
scene.add(sun);

// ---------- Player ----------
function groundSpawn(): THREE.Vector3 {
  const cx = Math.floor(WORLD_BLOCKS / 2);
  const cz = Math.floor(WORLD_BLOCKS / 2);
  for (let y = HEIGHT - 1; y > 0; y--) {
    if (world.getBlock(cx, y, cz) !== Block.Air) {
      return new THREE.Vector3(cx + 0.5, y + 1, cz + 0.5);
    }
  }
  return new THREE.Vector3(cx + 0.5, 30, cz + 0.5);
}

const player = new Player(world, groundSpawn());
const hotbar = new Hotbar(hotbarEl);

// Block selection highlight.
const highlight = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(1.001, 1.001, 1.001)),
  new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4 })
);
highlight.visible = false;
scene.add(highlight);

// ---------- Input ----------
// Two independent states: `playing` (in the world) and `locked` (mouse captured).
// Pointer lock is the preferred mode, but the game stays fully playable without
// it (e.g. inside an embedded preview) via drag-to-look.
let playing = false;
let locked = false;
let dragging = false;
let dragButton = -1;
let dragMoved = 0;

function tryLock(): void {
  const result = canvas.requestPointerLock() as unknown as Promise<void> | undefined;
  if (result && typeof result.then === "function") result.catch(() => undefined);
}

function startGame(): void {
  playing = true;
  overlay.classList.add("hidden");
  hud.classList.remove("hidden");
  tryLock();
}

function pauseGame(): void {
  playing = false;
  dragging = false;
  overlay.classList.remove("hidden");
  hud.classList.add("hidden");
  player.clearKeys();
  if (document.pointerLockElement === canvas) document.exitPointerLock();
}

function doAction(button: number): void {
  const hit = player.raycast();
  if (!hit) return;
  if (button === 0) {
    world.setBlock(hit.block.x, hit.block.y, hit.block.z, Block.Air);
  } else if (button === 2) {
    const p = hit.place;
    if (player.intersectsCell(p.x, p.y, p.z)) return;
    world.setBlock(p.x, p.y, p.z, hotbar.block);
  }
}

playBtn.addEventListener("click", startGame);

document.addEventListener("pointerlockchange", () => {
  locked = document.pointerLockElement === canvas;
});

window.addEventListener("mousemove", (e) => {
  if (!playing) return;
  if (locked) {
    player.look(e.movementX, e.movementY);
  } else if (dragging) {
    player.look(e.movementX, e.movementY);
    dragMoved += Math.abs(e.movementX) + Math.abs(e.movementY);
  }
});

canvas.addEventListener("mousedown", (e) => {
  if (!playing) return;
  e.preventDefault();
  if (locked) {
    doAction(e.button); // captured mode: act immediately
  } else {
    dragging = true;
    dragButton = e.button;
    dragMoved = 0;
  }
});

window.addEventListener("mouseup", () => {
  if (!playing || locked) return;
  if (dragging && dragMoved <= 6) {
    doAction(dragButton); // a click, not a drag-look
    tryLock(); // and (re)capture the mouse if the browser allows it
  }
  dragging = false;
});

window.addEventListener("keydown", (e) => {
  if (e.code === "Escape") {
    if (playing) pauseGame();
    return;
  }
  if (!playing) return;
  if (e.code.startsWith("Digit")) {
    const n = Number(e.code.slice(5));
    if (n >= 1 && n <= 9) hotbar.select(n - 1);
  }
  player.setKey(e.code, true);
  if (e.code === "Space") e.preventDefault();
});
window.addEventListener("keyup", (e) => player.setKey(e.code, false));

window.addEventListener("wheel", (e) => {
  if (!playing) return;
  hotbar.cycle(e.deltaY > 0 ? 1 : -1);
});

canvas.addEventListener("contextmenu", (e) => e.preventDefault());

window.addEventListener("resize", () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  player.camera.aspect = window.innerWidth / window.innerHeight;
  player.camera.updateProjectionMatrix();
});

// ---------- Loop ----------
let last = performance.now();
let fpsAcc = 0;
let fpsFrames = 0;
let fps = 0;

function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (playing) player.update(dt);

  const hit = player.raycast();
  if (hit) {
    highlight.visible = true;
    highlight.position.set(hit.block.x + 0.5, hit.block.y + 0.5, hit.block.z + 0.5);
  } else {
    highlight.visible = false;
  }

  fpsAcc += dt;
  fpsFrames++;
  if (fpsAcc >= 0.5) {
    fps = Math.round(fpsFrames / fpsAcc);
    fpsAcc = 0;
    fpsFrames = 0;
  }
  debugEl.textContent =
    `MiniCraft\n` +
    `${fps} fps\n` +
    `xyz ${player.pos.x.toFixed(1)} ${player.pos.y.toFixed(1)} ${player.pos.z.toFixed(1)}\n` +
    `holding: ${hotbar.name}`;

  renderer.render(scene, player.camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
