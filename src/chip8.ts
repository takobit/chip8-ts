export class Chip8 {
  static readonly MEMORY_SIZE = 4096;
  static readonly DISPLAY_WIDTH = 64;
  static readonly DISPLAY_HEIGHT = 32;
  static readonly REGISTER_COUNT = 16;
  static readonly STACK_SIZE = 16;
  static readonly PROGRAM_START = 0x200;
  static readonly KEYPAD_SIZE = 16;

  private memory: Uint8Array;
  private v: Uint8Array;
  private i: number;
  private pc: number;
  private stack: Uint16Array;
  private sp: number;
  private delayTimer: number;
  private soundTimer: number;
  private keypad: Uint8Array;
  private display: Uint8Array;

  constructor() {
    this.memory = new Uint8Array(Chip8.MEMORY_SIZE);
    this.v = new Uint8Array(Chip8.REGISTER_COUNT);
    this.i = 0;
    this.pc = Chip8.PROGRAM_START;
    this.stack = new Uint16Array(Chip8.STACK_SIZE);
    this.sp = 0;
    this.delayTimer = 0;
    this.soundTimer = 0;
    this.keypad = new Uint8Array(Chip8.KEYPAD_SIZE);
    this.display = new Uint8Array(Chip8.DISPLAY_WIDTH * Chip8.DISPLAY_HEIGHT);
  }

  reset(): void {
    this.memory.fill(0);
    this.v.fill(0);
    this.i = 0;
    this.pc = Chip8.PROGRAM_START;
    this.stack.fill(0);
    this.sp = 0;
    this.delayTimer = 0;
    this.soundTimer = 0;
    this.keypad.fill(0);
    this.display.fill(0);
  }

  clearDisplay(): void {
    this.display.fill(0);
  }

  setPixel(x: number, y: number, value: 0 | 1): void {
    if (
      x < 0 ||
      x >= Chip8.DISPLAY_WIDTH ||
      y < 0 ||
      y >= Chip8.DISPLAY_HEIGHT
    ) {
      return;
    }

    this.display[y * Chip8.DISPLAY_WIDTH + x] = value;
  }

  getDisplay(): Uint8Array {
    return this.display;
  }

  getDisplayWidth(): number {
    return Chip8.DISPLAY_WIDTH;
  }

  getDisplayHeight(): number {
    return Chip8.DISPLAY_HEIGHT;
  }

  getProgramStart(): number {
    return Chip8.PROGRAM_START;
  }

  getProgramCounter(): number {
    return this.pc;
  }

  getIndexRegister(): number {
    return this.i;
  }

  getStackPointer(): number {
    return this.sp;
  }

  getDelayTimer(): number {
    return this.delayTimer;
  }

  getSoundTimer(): number {
    return this.soundTimer;
  }

  getMemorySlice(start: number, end: number): Uint8Array {
    return this.memory.slice(start, end);
  }

  loadRom(program: Uint8Array): void {
    const start = Chip8.PROGRAM_START;
    const maxSize = Chip8.MEMORY_SIZE - start;

    if (program.length > maxSize) {
      throw new Error(
        `ROM is too large. Max size is ${maxSize} bytes, got ${program.length} bytes.`,
      );
    }

    this.reset();
    this.memory.set(program, start);
    this.pc = Chip8.PROGRAM_START;
  }
}
