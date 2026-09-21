import type { Player } from "./player.js";

const JOY_RADIUS = 44;

export interface TouchHooks {
  onBreakDown: () => void;
  onBreakUp: () => void;
  onPlace: () => void;
}

function isTouchDevice(): boolean {
  return "ontouchstart" in window || window.matchMedia("(pointer: coarse)").matches;
}

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`missing #${id}`);
  return node as T;
}

/**
 * Mobile controls: a left thumb joystick to move, drag anywhere else to look,
 * and JUMP / BREAK / PLACE buttons. Only activates on touch devices.
 */
export function initTouchControls(player: Player, hooks: TouchHooks): void {
  if (!isTouchDevice()) return;

  const root = el<HTMLDivElement>("touch");
  root.classList.remove("hidden");

  const base = el<HTMLDivElement>("joy-base");
  const stick = el<HTMLDivElement>("joy-stick");
  let joyId: number | null = null;
  let centerX = 0;
  let centerY = 0;

  const joyEnd = (): void => {
    joyId = null;
    stick.style.transform = "translate(-50%, -50%)";
    player.setTouchMove(0, 0);
  };

  base.addEventListener(
    "pointerdown",
    (e) => {
      if (joyId !== null) return;
      joyId = e.pointerId;
      base.setPointerCapture(e.pointerId);
      const box = base.getBoundingClientRect();
      centerX = box.left + box.width / 2;
      centerY = box.top + box.height / 2;
      e.preventDefault();
    },
    { passive: false }
  );
  base.addEventListener(
    "pointermove",
    (e) => {
      if (e.pointerId !== joyId) return;
      let dx = e.clientX - centerX;
      let dy = e.clientY - centerY;
      const len = Math.hypot(dx, dy);
      if (len > JOY_RADIUS) {
        dx = (dx / len) * JOY_RADIUS;
        dy = (dy / len) * JOY_RADIUS;
      }
      stick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      player.setTouchMove(dx / JOY_RADIUS, dy / JOY_RADIUS);
    },
    { passive: true }
  );
  const joyStop = (e: PointerEvent): void => {
    if (e.pointerId === joyId) joyEnd();
  };
  base.addEventListener("pointerup", joyStop);
  base.addEventListener("pointercancel", joyStop);

  const hold = (id: string, code: string): void => {
    const node = el<HTMLButtonElement>(id);
    node.addEventListener(
      "pointerdown",
      (e) => {
        e.preventDefault();
        player.setKey(code, true);
      },
      { passive: false }
    );
    node.addEventListener("pointerup", () => player.setKey(code, false));
    node.addEventListener("pointercancel", () => player.setKey(code, false));
    node.addEventListener("pointerleave", () => player.setKey(code, false));
  };

  hold("btn-jump", "Space");

  el<HTMLButtonElement>("btn-break").addEventListener(
    "pointerdown",
    (e) => {
      e.preventDefault();
      hooks.onBreakDown();
    },
    { passive: false }
  );
  const breakEnd = (): void => hooks.onBreakUp();
  el<HTMLButtonElement>("btn-break").addEventListener("pointerup", breakEnd);
  el<HTMLButtonElement>("btn-break").addEventListener("pointercancel", breakEnd);
  el<HTMLButtonElement>("btn-break").addEventListener("pointerleave", breakEnd);
  el<HTMLButtonElement>("btn-place").addEventListener(
    "pointerdown",
    (e) => {
      e.preventDefault();
      hooks.onPlace();
    },
    { passive: false }
  );
}
