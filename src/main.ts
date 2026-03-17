import "./style.css";
import { Chip8 } from "./chip8";

const SCALE = 12;
const CPU_HZ = 600;
const TIMER_HZ = 60;
const MAX_FRAME_DELTA_MS = 100;
const KEY_MAP: Record<string, number> = {
  "1": 0x1,
  "2": 0x2,
  "3": 0x3,
  "4": 0xc,
  q: 0x4,
  w: 0x5,
  e: 0x6,
  r: 0xd,
  a: 0x7,
  s: 0x8,
  d: 0x9,
  f: 0xe,
  z: 0xa,
  x: 0x0,
  c: 0xb,
  v: 0xf,
};

declare global {
  interface Window {
    debugChip8: {
      loadRomBytes: (bytes: number[]) => void;
      loadRomHex: (hex: string) => void;
      getLoadedRomHex: () => string;
      printLoadedRomHex: () => void;
    };
  }
}

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <div class="container">
    <div class="console-shell">
      <p class="eyebrow">Arcade Lab // Virtual Console</p>
      <h1 class="title"><span class="title-icon" aria-hidden="true">👾</span> CHIP-8 Emulator <span class="title-icon" aria-hidden="true">👾</span></h1>
      <p class="subtitle">1980s vibes, browser silicon, glowing phosphor pixels.</p>

      <div class="dashboard">
        <section class="control-panel">
          <div class="panel-header">
            <span class="panel-dot panel-dot-red"></span>
            <span class="panel-dot panel-dot-yellow"></span>
            <span class="panel-dot panel-dot-green"></span>
            <span class="panel-title">ROM BAY</span>
          </div>

          <div class="controls">
            <label class="file-label">
              <span class="file-label-text">ROMを選択</span>
              <span class="file-label-subtext">.ch8 / .rom / .bin</span>
              <input id="rom-input" type="file" accept=".ch8,.rom,.bin" />
            </label>
          </div>

          <p id="status" class="status">ROM未読み込み</p>
        </section>

        <section class="screen-panel">
          <div class="panel-header">
            <span class="panel-dot panel-dot-red"></span>
            <span class="panel-dot panel-dot-yellow"></span>
            <span class="panel-dot panel-dot-green"></span>
            <span class="panel-title">VIDEO OUT</span>
          </div>

          <div class="screen-frame">
            <canvas id="screen"></canvas>
          </div>
        </section>
      </div>

      <section class="debug-panel">
        <div class="panel-header">
          <span class="panel-dot panel-dot-red"></span>
          <span class="panel-dot panel-dot-yellow"></span>
          <span class="panel-dot panel-dot-green"></span>
          <span class="panel-title">SYSTEM MONITOR</span>
        </div>

        <pre id="debug"></pre>
      </section>
    </div>
  </div>
`;

const canvasElement = document.querySelector<HTMLCanvasElement>("#screen");
const statusElement = document.querySelector<HTMLParagraphElement>("#status");
const debugElement = document.querySelector<HTMLElement>("#debug");
const romInputElement = document.querySelector<HTMLInputElement>("#rom-input");

if (!canvasElement || !statusElement || !debugElement || !romInputElement) {
  throw new Error("Required DOM elements not found");
}

const canvas = canvasElement;
const status = statusElement;
const debug = debugElement;
const romInput = romInputElement;

const chip8 = new Chip8();
let loadedProgramLength = 0;
let loadedProgram: Uint8Array | null = null;
let lastOpcode = 0;
let isRunning = false;
let animationFrameId: number | null = null;
let lastFrameTime = 0;
let cycleAccumulator = 0;
let timerAccumulator = 0;

canvas.width = chip8.getDisplayWidth() * SCALE;
canvas.height = chip8.getDisplayHeight() * SCALE;

const context = canvas.getContext("2d");
if (!context) {
  throw new Error("2D context not available");
}
const ctx = context;

function render(): void {
  const display = chip8.getDisplay();
  const width = chip8.getDisplayWidth();
  const height = chip8.getDisplayHeight();

  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#fff";

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixel = display[y * width + x];

      if (pixel === 1) {
        ctx.fillRect(x * SCALE, y * SCALE, SCALE, SCALE);
      }
    }
  }
}

function toHex(value: number, width = 2): string {
  return value.toString(16).toUpperCase().padStart(width, "0");
}

function programToHex(program: Uint8Array): string {
  return Array.from(program)
    .map((byte) => toHex(byte))
    .join("");
}

function updateDebugInfo(programLength = 0): void {
  const start = chip8.getProgramStart();
  const previewLength = Math.min(programLength, 32);
  const memoryPreview = chip8.getMemorySlice(start, start + previewLength);

  const bytes = Array.from(memoryPreview)
    .map((byte) => toHex(byte))
    .join(" ");

  debug.textContent = [
    `PC: 0x${toHex(chip8.getProgramCounter(), 4)}`,
    `Opcode: 0x${toHex(lastOpcode, 4)}`,
    `I: 0x${toHex(chip8.getIndexRegister(), 4)}`,
    `SP: ${chip8.getStackPointer()}`,
    `Delay Timer: ${chip8.getDelayTimer()}`,
    `Sound Timer: ${chip8.getSoundTimer()}`,
    `Program Start: 0x${toHex(start, 4)}`,
    `Loaded Bytes: ${programLength}`,
    `Memory Preview: ${bytes || "(empty)"}`,
  ].join("\n");
}

function loadProgram(program: Uint8Array, label: string): void {
  chip8.loadRom(program);
  loadedProgram = new Uint8Array(program);
  loadedProgramLength = program.length;
  lastOpcode = 0;
  render();
  updateDebugInfo(loadedProgramLength);
  startExecution();
  status.textContent = `読み込み成功: ${label} (${program.length} bytes)`;
}

function stopExecution(message?: string): void {
  isRunning = false;
  lastFrameTime = 0;
  cycleAccumulator = 0;
  timerAccumulator = 0;

  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  if (message) {
    status.textContent = message;
  }
}

function stepFrame(timestamp: number): void {
  if (!isRunning) {
    return;
  }

  try {
    if (lastFrameTime === 0) {
      lastFrameTime = timestamp;
    }

    const deltaMs = Math.min(timestamp - lastFrameTime, MAX_FRAME_DELTA_MS);
    lastFrameTime = timestamp;

    cycleAccumulator += (deltaMs / 1000) * CPU_HZ;
    timerAccumulator += (deltaMs / 1000) * TIMER_HZ;

    const cyclesToRun = Math.floor(cycleAccumulator);
    cycleAccumulator -= cyclesToRun;

    const timerTicks = Math.floor(timerAccumulator);
    timerAccumulator -= timerTicks;

    for (let cycle = 0; cycle < cyclesToRun; cycle += 1) {
      lastOpcode = chip8.cycle();
    }

    if (timerTicks > 0) {
      chip8.tickTimers(timerTicks);
    }

    render();
    updateDebugInfo(loadedProgramLength);
    animationFrameId = requestAnimationFrame(stepFrame);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "実行中に不明なエラーが発生しました。";

    render();
    updateDebugInfo(loadedProgramLength);
    stopExecution(`実行停止: ${message}`);
  }
}

function startExecution(): void {
  stopExecution();
  isRunning = true;
  lastFrameTime = 0;
  animationFrameId = requestAnimationFrame(stepFrame);
}

function handleKeyEvent(event: KeyboardEvent, isPressed: boolean): void {
  const chip8Key = KEY_MAP[event.key.toLowerCase()];

  if (chip8Key === undefined) {
    return;
  }

  event.preventDefault();
  chip8.setKeyState(chip8Key, isPressed);
}

romInput.addEventListener("change", async (event) => {
  const input = event.currentTarget as HTMLInputElement;
  const file = input.files?.[0];

  if (!file) {
    return;
  }

  try {
    const buffer = await file.arrayBuffer();
    const program = new Uint8Array(buffer);

    loadProgram(program, file.name);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "ROMの読み込みに失敗しました。";

    stopExecution();
    loadedProgram = null;
    loadedProgramLength = 0;
    lastOpcode = 0;
    status.textContent = `エラー: ${message}`;
    debug.textContent = "";
  }
});

window.addEventListener("keydown", (event) => {
  handleKeyEvent(event, true);
});

window.addEventListener("keyup", (event) => {
  handleKeyEvent(event, false);
});

window.debugChip8 = {
  loadRomBytes(bytes: number[]): void {
    loadProgram(new Uint8Array(bytes), "console bytes");
  },

  loadRomHex(hex: string): void {
    const sanitized = hex.replaceAll(/\s+/g, "");

    if (sanitized.length === 0 || sanitized.length % 2 !== 0) {
      throw new Error("Hex string must contain an even number of characters.");
    }

    const program = new Uint8Array(sanitized.length / 2);

    for (let index = 0; index < sanitized.length; index += 2) {
      const value = Number.parseInt(sanitized.slice(index, index + 2), 16);

      if (Number.isNaN(value)) {
        throw new Error(
          `Invalid hex byte: ${sanitized.slice(index, index + 2)}`,
        );
      }

      program[index / 2] = value;
    }

    loadProgram(program, "console hex");
  },

  getLoadedRomHex(): string {
    if (!loadedProgram) {
      throw new Error("No ROM is currently loaded.");
    }

    return programToHex(loadedProgram);
  },

  printLoadedRomHex(): void {
    console.log(window.debugChip8.getLoadedRomHex());
  },
};

// 初期表示
chip8.clearDisplay();
chip8.setPixel(2, 2, 1);
chip8.setPixel(3, 2, 1);
chip8.setPixel(4, 2, 1);
chip8.setPixel(4, 3, 1);
chip8.setPixel(4, 4, 1);
chip8.setPixel(3, 4, 1);
chip8.setPixel(2, 4, 1);

render();
updateDebugInfo();
