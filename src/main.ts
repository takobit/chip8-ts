import "./style.css";
import { Chip8 } from "./chip8";

const SCALE = 12;

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

function updateDebugInfo(programLength = 0): void {
  const start = chip8.getProgramStart();
  const previewLength = Math.min(programLength, 32);
  const memoryPreview = chip8.getMemorySlice(start, start + previewLength);

  const bytes = Array.from(memoryPreview)
    .map((byte) => toHex(byte))
    .join(" ");

  debug.textContent = [
    `PC: 0x${toHex(chip8.getProgramCounter(), 4)}`,
    `I: 0x${toHex(chip8.getIndexRegister(), 4)}`,
    `SP: ${chip8.getStackPointer()}`,
    `Delay Timer: ${chip8.getDelayTimer()}`,
    `Sound Timer: ${chip8.getSoundTimer()}`,
    `Program Start: 0x${toHex(start, 4)}`,
    `Loaded Bytes: ${programLength}`,
    `Memory Preview: ${bytes || "(empty)"}`,
  ].join("\n");
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

    chip8.loadRom(program);
    render();
    updateDebugInfo(program.length);

    status.textContent = `読み込み成功: ${file.name} (${program.length} bytes)`;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "ROMの読み込みに失敗しました。";

    status.textContent = `エラー: ${message}`;
    debug.textContent = "";
  }
});

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
