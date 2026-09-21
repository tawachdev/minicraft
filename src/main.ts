import * as THREE from "three";
import { World, WORLD_BLOCKS, HEIGHT } from "./world.js";
import { Player, type GameMode } from "./player.js";
import { Hotbar, Hearts } from "./ui.js";
import { makeAtlasTexture } from "./textures.js";
import { Mobs } from "./mobs.js";
import { initTouchControls } from "./touch.js";

const canvas = document.getElementById("game") as HTMLCanvasElement;
const overlay = document.getElementById("overlay") as HTMLDivElement;
const hud = document.getElementById("hud") as HTMLDivElement;
const playBtn = document.getElementById("play") as HTMLButtonElement;
const hotbarEl = document.getElementById("hotbar") as HTMLDivElement;
const heartsEl = document.getElementById("hearts-slot") as HTMLDivElement;
const debugEl = document.getElementById("debug") as HTMLDivElement;
const flashEl = document.createElement("div");
flashEl.id = "flash";
hud.appendChild(flashEl);

// ---------- Renderer / scene ----------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
const SKY = new THREE.Color(0x88c4ff);
scene.background = SKY;
scene.fog = new THREE.Fog(SKY, 40, 90);

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
    if (world.getBlock(cx, y, cz) !== 0) {
      return new THREE.Vector3(cx + 0.5, y + 1, cz + 0.5);
    }
  }
  return new THREE.Vector3(cx + 0.5, 30, cz + 0.5);
}

const player = new Player(world, groundSpawn(), "creative");
const hotbar = new Hotbar(hotbarEl);
const hearts = new Hearts(heartsEl);
hearts.set(player.health);

const mobs = new Mobs(world, scene, 8, new THREE.Vector3(WORLD_BLOCKS / 2, 30, WORLD_BLOCKS / 2));

// Block selection highlight.
const highlight = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(1.001, 1.001, 1.001)),
  new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4 })
);
highlight.visible = false;
scene.add(highlight);

// ---------- Modes / menu ----------
let selectedMode: GameMode = "creative";

function selectMode(mode: GameMode): void {
  selectedMode = mode;
  document.getElementById("mode-creative")?.classList.toggle("active", mode === "creative");
  document.getElementById("mode-survival")?.classList.toggle("active", mode === "survival");
}

document.getElementById("mode-creative")?.addEventListener("click", () => selectMode("creative"));
document.getElementById("mode-survival")?.addEventListener("click", () => selectMode("survival"));

player.onDamage = (hp: number): void => {
  hearts.set(hp);
  flashEl.classList.add("on");
  window.setTimeout(() => flashEl.classList.remove("on"), 80);
};
player.onRespawn = (): void => hearts.set(player.health);

// ---------- Input ----------
// Two independent states: `playing` (in the world) and `locked` (mouse captured).
// Pointer lock is the preferred mode, but the game stays fully playable without
// it (e.g. inside an embedded preview) via drag-to-look.
let playing = false;
let locked = false;
let dragging = false;
let dragButton = -1;
let dragMoved = 0;
let touchBound = false;

function tryLock(): void {
  const result = canvas.requestPointerLock() as unknown as Promise<void> | undefined;
  if (result && typeof result.then === "function") result.catch(() => undefined);
}

function startGame(): void {
  playing = true;
  player.setMode(selectedMode);
  hearts.set(player.health);
  document.body.classList.toggle("survival", selectedMode === "survival");
  overlay.classList.add("hidden");
  hud.classList.remove("hidden");
  tryLock();
  if (!touchBound) {
    touchBound = true;
    initTouchControls(player, {
      onBreak: () => doAction(0),
      onPlace: () => doAction(2),
    });
  }
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
    world.setBlock(hit.block.x, hit.block.y, hit.block.z, 0);
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

// touch look: one finger drag anywhere on the world looks around
let lastTouch: { x: number; y: number } | null = null;
canvas.addEventListener(
  "touchstart",
  (e) => {
    if (!playing || lastTouch) return;
    const t = e.touches[0];
    lastTouch = { x: t.clientX, y: t.clientY };
    dragMoved = 0;
  },
  { passive: true }
);
canvas.addEventListener(
  "touchmove",
  (e) => {
    if (!playing || !lastTouch) return;
    const t = e.touches[0];
    const dx = t.clientX - lastTouch.x;
    const dy = t.clientY - lastTouch.y;
    lastTouch = { x: t.clientX, y: t.clientY };
    dragMoved += Math.abs(dx) + Math.abs(dy);
    player.look(dx * 1.8, dy * 1.8);
    e.preventDefault();
  },
  { passive: false }
);
canvas.addEventListener("touchend", () => {
  lastTouch = null;
  if (playing && dragMoved <= 6) doAction(0); // tap breaks like a left click
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

  if (playing) {
    player.update(dt);
    mobs.update(dt);
  }
  world.update(player.pos); // stream chunk meshes around the viewer

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
    `MiniCraft v0.2\n` +
    `${fps} fps · ${player.mode}${player.mode === "survival" ? " · hp " + player.health : ""}\n` +
    `xyz ${player.pos.x.toFixed(1)} ${player.pos.y.toFixed(1)} ${player.pos.z.toFixed(1)}\n` +
    `holding: ${hotbar.name}`;

  renderer.render(scene, player.camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
