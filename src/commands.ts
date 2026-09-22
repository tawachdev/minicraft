import { HOTBAR, blockName } from "./blocks.js";
import type { GameMode, Player } from "./player.js";
import type { Hotbar } from "./ui.js";

export interface CommandContext {
  player: Player;
  hotbar: Hotbar;
  setMode: (mode: GameMode) => void;
}

const HELP = [
  "/help - list commands",
  "/gamemode creative|survival - switch mode (/gm c|s)",
  "/give <block|1-9> - hold a block",
  "/tp <x> <y> <z> - teleport",
  "/spawn - go to spawn point",
  "/heal - full health",
  "/kill - respawn at spawn",
  "/fly - toggle flight (creative)",
].join("\n");

const MODE_ALIASES: Record<string, GameMode> = {
  c: "creative",
  creative: "creative",
  s: "survival",
  survival: "survival",
};

export function runCommand(line: string, ctx: CommandContext): string {
  const parts = line.replace(/^\//, "").trim().split(/\s+/).filter(Boolean);
  const cmd = (parts.shift() ?? "").toLowerCase();
  switch (cmd) {
    case "help":
      return HELP;
    case "gamemode":
    case "gm":
      return setGameMode(parts[0], ctx);
    case "give":
      return give(parts[0], ctx);
    case "tp":
      return teleportCommand(parts, ctx);
    case "spawn":
      ctx.player.respawn();
      return "Teleported to spawn point";
    case "heal":
      ctx.player.heal();
      return "Healed to full health";
    case "kill":
      ctx.player.respawn();
      return "Respawned at spawn point";
    case "fly":
      return toggleFly(ctx);
    default:
      return `Unknown command: /${cmd}. Try /help`;
  }
}

function setGameMode(arg: string | undefined, ctx: CommandContext): string {
  const mode = arg === undefined ? undefined : MODE_ALIASES[arg.toLowerCase()];
  if (!mode) return "Usage: /gamemode creative|survival (or /gm c|s)";
  ctx.setMode(mode);
  return `Game mode: ${mode}`;
}

function give(arg: string | undefined, ctx: CommandContext): string {
  if (!arg) return "Usage: /give <block name or 1-9>";
  const index = Number(arg);
  if (Number.isInteger(index) && index >= 1 && index <= HOTBAR.length) {
    ctx.hotbar.select(index - 1);
    return `Now holding ${ctx.hotbar.name}`;
  }
  const query = arg.toLowerCase();
  const matches = HOTBAR.map((id, i) => ({ id, i, name: blockName(id).toLowerCase() })).filter(
    (b) => b.name === query || b.name.includes(query) || query.includes(b.name),
  );
  if (matches.length === 1) {
    ctx.hotbar.select(matches[0].i);
    return `Now holding ${blockName(matches[0].id)}`;
  }
  if (matches.length === 0) return `No block named "${arg}". Try /give 1-9 or /help`;
  return `Ambiguous block "${arg}": ${matches.map((m) => blockName(m.id)).join(", ")}`;
}

function teleportCommand(args: string[], ctx: CommandContext): string {
  if (args.length !== 3) return "Usage: /tp <x> <y> <z>";
  const coords = args.map(Number);
  if (coords.some((n) => !Number.isFinite(n))) return "Coordinates must be numbers, e.g. /tp 96 40 96";
  ctx.player.teleport(coords[0]!, coords[1]!, coords[2]!);
  const p = ctx.player.pos;
  return `Teleported to ${Math.round(p.x)} ${Math.round(p.y)} ${Math.round(p.z)}`;
}

function toggleFly(ctx: CommandContext): string {
  if (ctx.player.mode !== "creative") return "Flight is creative-only";
  ctx.player.flying = !ctx.player.flying;
  return ctx.player.flying ? "Flight on: Space up, Shift down" : "Flight off";
}
