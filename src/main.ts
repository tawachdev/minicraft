import * as THREE from "three";
import { World, WORLD_BLOCKS, HEIGHT } from "./world.js";
import { Block, blockFx } from "./blocks.js";
import { Player, type GameMode } from "./player.js";
import { Hotbar, Hearts } from "./ui.js";
import { makeAtlasTexture } from "./textures.js";
import { Mobs } from "./mobs.js";
import { Sfx } from "./audio.js";
import { BlockFx } from "./fx.js";
import { initTouchControls, isTouchDevice } from "./touch.js";
import { runCommand, type CommandContext } from "./commands.js";

const canvas = document.getElementById("game") as HTMLCanvasElement;
const overlay = document.getElementById("overlay") as HTMLDivElement;
const hud = document.getElementById("hud") as HTMLDivElement;
const playBtn = document.getElementById("play") as HTMLButtonElement;
const hotbarEl = document.getElementById("hotbar") as HTMLDivElement;
const heartsEl = document.getElementById("hearts-slot") as HTMLDivElement;
const debugEl = document.getElementById("debug") as HTMLDivElement;
const cmdInput = document.getElementById("cmd") as HTMLInputElement;
const cmdLog = document.getElementById("cmd-log") as HTMLDivElement;
const flashEl = document.createElement("div");
flashEl.id = "flash";
hud.appendChild(flashEl);

// ---------- Renderer / scene ----------
const isTouch = isTouchDevice();
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isTouch });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isTouch ? 1.5 : 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
const SKY = new THREE.Color(0x88c4ff);
scene.background = SKY;
scene.fog = new THREE.Fog(SKY, 40, 90);

const atlas = makeAtlasTexture();
const world = new World(scene, atlas);
const sfx = new Sfx();
const fx = new BlockFx(scene);

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

const player = new Player(world, groundSpawn(), "creative");
scene.add(player.model);
const hotbar = new Hotbar(hotbarEl);
const hearts = new Hearts(heartsEl);
hearts.set(player.health);

const mobs = new Mobs(world, scene, 8, new THREE.Vector3(WORLD_BLOCKS / 2, 30, WORLD_BLOCKS / 2), fx);

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
  sfx.hurt();
  flashEl.classList.add("on");
  window.setTimeout(() => flashEl.classList.remove("on"), 80);
};
player.onRespawn = (): void => hearts.set(player.health);

// ---------- Sound / mining / camera state ----------
let playing = false;
let locked = false;
let dragging = false;
let dragButton = -1;
let dragMoved = 0;
let touchBound = false;
/** Survival hold-to-mine: true while the mining input (mouse or touch) is held. */
let mineHeld = false;
let mining: { x: number; y: number; z: number; progress: number; total: number } | null = null;
let pendingPillar: { x: number; y: number; z: number } | null = null;
let cameraMode: "first" | "third" = "first";
let zoomIndex = 0;
let stepDistance = 0;

function tryLock(): void {
  const result = canvas.requestPointerLock() as unknown as Promise<void> | undefined;
  if (result && typeof result.then === "function") result.catch(() => undefined);
}

function startGame(): void {
  playing = true;
  sfx.resume();
  applyMode(selectedMode);
  overlay.classList.add("hidden");
  hud.classList.remove("hidden");
  tryLock();
  if (!touchBound) {
    touchBound = true;
    initTouchControls(player, {
      onBreakDown: () => {
        if (player.mode === "creative") swingAction();
        else mineHeld = true;
      },
      onBreakUp: () => {
        mineHeld = false;
        fx.hideCrack();
      },
      onPlace: () => doPlace(),
      onPause: () => pauseGame(),
      onCommands: () => openCmd(),
    });
  }
}

function pauseGame(): void {
  playing = false;
  dragging = false;
  mineHeld = false;
  mining = null;
  fx.hideCrack();
  closeCmd();
  overlay.classList.remove("hidden");
  hud.classList.add("hidden");
  player.clearKeys();
  mineHeld = false;
  fx.hideCrack();
  if (document.pointerLockElement === canvas) document.exitPointerLock();
}

/** Mode switch shared by the menu and the /gamemode command. */
function applyMode(mode: GameMode): void {
  player.setMode(mode);
  hearts.set(player.health);
  document.body.classList.toggle("survival", mode === "survival");
}

// ---------- Command bar ----------
const cmdCtx: CommandContext = { player, hotbar, setMode: applyMode };
let chatOpen = false;
let logTimer = 0;

function showLog(text: string): void {
  cmdLog.textContent = text;
  cmdLog.classList.add("on");
  window.clearTimeout(logTimer);
  logTimer = window.setTimeout(() => cmdLog.classList.remove("on"), 6000);
}

function openCmd(prefill = ""): void {
  chatOpen = true;
  player.clearKeys();
  cmdLog.classList.remove("on");
  cmdInput.classList.remove("hidden");
  cmdInput.value = prefill;
  cmdInput.focus();
}

function closeCmd(): void {
  if (!chatOpen) return;
  chatOpen = false;
  cmdInput.classList.add("hidden");
  cmdInput.value = "";
  cmdInput.blur();
}

function submitCmd(): void {
  const line = cmdInput.value.trim();
  closeCmd();
  if (line) showLog(runCommand(line, cmdCtx));
}

cmdInput.addEventListener("keydown", (e) => {
  e.stopPropagation();
  if (e.key === "Enter") submitCmd();
  else if (e.key === "Escape") closeCmd();
});
cmdInput.addEventListener("focusout", () => closeCmd());

/** Left click (or BREAK button): hunt first, else mine the block. */
function swingAction(): void {
  const dir = new THREE.Vector3();
  player.camera.getWorldDirection(dir);
  const mob = mobs.raycastHit(player.camera.position, dir, 4.2);
  if (mob) {
    const now = performance.now();
    const dead = mobs.hit(mob, now);
    if (dead) sfx.mobDeath();
    else sfx.mobHit();
    return;
  }
  const hit = player.raycast();
  if (!hit) return;
  const fxInfo = blockFx(world.getBlock(hit.block.x, hit.block.y, hit.block.z));
  world.setBlock(hit.block.x, hit.block.y, hit.block.z, Block.Air);
  fx.burst(hit.block.x, hit.block.y, hit.block.z, fxInfo.particle, 14);
  sfx.breakBlock(fxInfo.sound);
}

function doPlace(): void {
  const hit = player.raycast();
  const p = hit?.place;
  if (!p) return;
  if (!player.intersectsCell(p.x, p.y, p.z)) {
    world.setBlock(p.x, p.y, p.z, hotbar.block);
    fx.placePop(p.x, p.y, p.z);
    sfx.place();
    return;
  }
  // looking straight down at your own feet: hop and pillar like in Minecraft
  if (player.getPitch() < -1.2 && player.onGroundFlag) {
    player.setKey("Space", true);
    window.setTimeout(() => player.setKey("Space", false), 60);
    pendingPillar = { x: p.x, y: p.y, z: p.z };
  }
}

/** Places the pillar block the moment the jump lifts the player clear of it. */
function tryPendingPillar(): void {
  if (!pendingPillar) return;
  if (player.onGroundFlag) {
    pendingPillar = null; // landed without clearing the cell
    return;
  }
  if (!player.intersectsCell(pendingPillar.x, pendingPillar.y, pendingPillar.z)) {
    world.setBlock(pendingPillar.x, pendingPillar.y, pendingPillar.z, hotbar.block);
    fx.placePop(pendingPillar.x, pendingPillar.y, pendingPillar.z);
    sfx.place();
    pendingPillar = null;
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
    // the hold turned into a look-drag: cancel survival mining
    if (dragMoved > 6 && mineHeld) {
      mineHeld = false;
      fx.hideCrack();
    }
  }
});

canvas.addEventListener("mousedown", (e) => {
  if (!playing) return;
  e.preventDefault();
  if (locked) {
    if (e.button === 0) {
      if (player.mode === "creative") swingAction();
      else mineHeld = true; // survival mines while the button is held
    } else if (e.button === 2) {
      doPlace();
    }
  } else {
    dragging = true;
    dragButton = e.button;
    dragMoved = 0;
    // survival fallback: press-and-hold mines, drag looks instead
    if (e.button === 0 && player.mode === "survival") mineHeld = true;
  }
});

window.addEventListener("mouseup", (e) => {
  if (!playing) return;
  if (e.button === 0) {
    if (mineHeld) {
      mineHeld = false;
      fx.hideCrack();
    }
    if (dragging && dragMoved <= 6 && player.mode === "creative" && e.button === dragButton) {
      swingAction(); // a tap, not a drag-look
    }
    if (dragging) tryLock();
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
  if (playing && dragMoved <= 6) swingAction(); // tap breaks or hunts
});

window.addEventListener("keydown", (e) => {
  if (chatOpen) return;
  if (e.code === "Escape") {
    if (playing) pauseGame();
    return;
  }
  if (!playing) return;
  if (e.code === "KeyT" || e.code === "Slash") {
    e.preventDefault();
    openCmd(e.code === "Slash" ? "/" : "");
    return;
  }
  if (e.code === "KeyV" || e.code === "F5") {
    e.preventDefault();
    cameraMode = cameraMode === "first" ? "third" : "first";
    player.setModelVisible(cameraMode === "third");
    return;
  }
  if (e.code === "KeyC") {
    zoomIndex = (zoomIndex + 1) % ZOOM_LEVELS.length;
    player.camera.fov = ZOOM_LEVELS[zoomIndex];
    player.camera.updateProjectionMatrix();
    return;
  }
  if (e.code === "KeyM") {
    sfx.muted = sfx.toggleMute();
    return;
  }
  if (e.code.startsWith("Digit")) {
    const n = Number(e.code.slice(5));
    if (n >= 1 && n <= 9) hotbar.select(n - 1);
  }
  player.setKey(e.code, true);
  if (e.code === "Space") e.preventDefault();
});
window.addEventListener("keyup", (e) => player.setKey(e.code, false));

window.addEventListener("wheel", (e) => {
  if (!playing || chatOpen) return;
  hotbar.cycle(e.deltaY > 0 ? 1 : -1);
});

canvas.addEventListener("contextmenu", (e) => e.preventDefault());

window.addEventListener("resize", () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  player.camera.aspect = window.innerWidth / window.innerHeight;
  player.camera.updateProjectionMatrix();
});

// ---------- Loop ----------
const ZOOM_LEVELS = [72, 55, 38];
let last = performance.now();
let fpsAcc = 0;
let fpsFrames = 0;
let fps = 0;
let prevPos = new THREE.Vector3().copy(player.pos);

function updateMining(dt: number): void {
  const held = mineHeld;
  if (!held) {
    if (mining) {
      mining = null;
      fx.hideCrack();
    }
    return;
  }
  const hit = player.raycast();
  if (!hit) {
    mining = null;
    fx.hideCrack();
    return;
  }
  const id = world.getBlock(hit.block.x, hit.block.y, hit.block.z) as Parameters<typeof blockFx>[0];
  const info = blockFx(id);
  if (!mining || mining.x !== hit.block.x || mining.y !== hit.block.y || mining.z !== hit.block.z) {
    mining = { x: hit.block.x, y: hit.block.y, z: hit.block.z, progress: 0, total: info.hardness };
  }
  mining.progress += dt;
  fx.crack(hit.block.x, hit.block.y, hit.block.z, mining.progress / mining.total);
  if (mining.progress >= mining.total) {
    world.setBlock(mining.x, mining.y, mining.z, Block.Air);
    fx.burst(mining.x, mining.y, mining.z, info.particle, 14);
    sfx.breakBlock(info.sound);
    mining = null;
    fx.hideCrack();
  }
}

function updateCamera(): void {
  player.camera.fov = ZOOM_LEVELS[zoomIndex];
  if (cameraMode === "first") {
    player.syncCameraOnly();
    return;
  }
  const eye = player.eyePosition();
  const dir = player.lookDirection();
  // pull the camera in front of any wall between the player and the ideal spot
  let dist = 4;
  const step = 0.15;
  const probe = new THREE.Vector3();
  for (let t = step; t <= dist; t += step) {
    probe.copy(eye).addScaledVector(dir, -t);
    if (world.getBlock(Math.floor(probe.x), Math.floor(probe.y), Math.floor(probe.z)) !== Block.Air) {
      dist = Math.max(0.8, t - step);
      break;
    }
  }
  player.camera.position.copy(eye).addScaledVector(dir, -dist);
  player.camera.lookAt(eye.clone().addScaledVector(dir, 2));
}

function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (playing) {
    player.update(dt);
    mobs.update(dt, now, player);
    fx.update(dt); // particle + pop lifecycles
    tryPendingPillar();
    world.update(player.pos); // stream chunk meshes around the viewer

    if (mineHeld && player.mode === "survival") updateMining(dt);

    // footsteps
    const moved = player.pos.distanceTo(prevPos);
    stepDistance += moved;
    if (player.onGroundFlag && moved > 0.001 && stepDistance > 2.1) {
      stepDistance = 0;
      sfx.step();
    }
    prevPos.copy(player.pos);
  }

  updateCamera();

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
    `MiniCraft v0.3\n` +
    `${fps} fps · ${player.mode}${player.mode === "survival" ? " · hp " + player.health : ""} · ${cameraMode === "third" ? "3rd" : "1st"}\n` +
    `xyz ${player.pos.x.toFixed(1)} ${player.pos.y.toFixed(1)} ${player.pos.z.toFixed(1)}\n` +
    `holding: ${hotbar.name}`;

  renderer.render(scene, player.camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
