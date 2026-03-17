export class Chip8 {
  static readonly MEMORY_SIZE = 4096;
  static readonly DISPLAY_WIDTH = 64;
  static readonly DISPLAY_HEIGHT = 32;
  static readonly REGISTER_COUNT = 16;
  static readonly STACK_SIZE = 16;
  static readonly FONT_START = 0x50;
  static readonly FONT_CHAR_BYTES = 5;
  static readonly PROGRAM_START = 0x200;
  static readonly KEYPAD_SIZE = 16;
  static readonly FONT_SET = new Uint8Array([
    0xf0, 0x90, 0x90, 0x90, 0xf0, // 0
    0x20, 0x60, 0x20, 0x20, 0x70, // 1
    0xf0, 0x10, 0xf0, 0x80, 0xf0, // 2
    0xf0, 0x10, 0xf0, 0x10, 0xf0, // 3
    0x90, 0x90, 0xf0, 0x10, 0x10, // 4
    0xf0, 0x80, 0xf0, 0x10, 0xf0, // 5
    0xf0, 0x80, 0xf0, 0x90, 0xf0, // 6
    0xf0, 0x10, 0x20, 0x40, 0x40, // 7
    0xf0, 0x90, 0xf0, 0x90, 0xf0, // 8
    0xf0, 0x90, 0xf0, 0x10, 0xf0, // 9
    0xf0, 0x90, 0xf0, 0x90, 0x90, // A
    0xe0, 0x90, 0xe0, 0x90, 0xe0, // B
    0xf0, 0x80, 0x80, 0x80, 0xf0, // C
    0xe0, 0x90, 0x90, 0x90, 0xe0, // D
    0xf0, 0x80, 0xf0, 0x80, 0xf0, // E
    0xf0, 0x80, 0xf0, 0x80, 0x80, // F
  ]);

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
    this.loadFontSet();
  }

  cycle(): number {
    const opcode = this.fetchOpcode();
    this.pc = (this.pc + 2) & 0xffff;
    this.executeOpcode(opcode);
    return opcode;
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
    this.loadFontSet();
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

  getRegister(index: number): number {
    if (index < 0 || index >= Chip8.REGISTER_COUNT) {
      throw new Error(`Register index out of range: V${index.toString(16)}`);
    }

    return this.v[index];
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

  private fetchOpcode(): number {
    if (this.pc < 0 || this.pc + 1 >= Chip8.MEMORY_SIZE) {
      throw new Error(`Program counter out of bounds: 0x${this.pc.toString(16)}`);
    }

    return (this.memory[this.pc] << 8) | this.memory[this.pc + 1];
  }

  private executeOpcode(opcode: number): void {
    const x = (opcode & 0x0f00) >> 8;
    const y = (opcode & 0x00f0) >> 4;
    const n = opcode & 0x000f;
    const nn = opcode & 0x00ff;
    const nnn = opcode & 0x0fff;

    switch (opcode & 0xf000) {
      case 0x0000:
        switch (opcode) {
          case 0x00e0:
            // 00E0: Clear the display.
            this.clearDisplay();
            return;
          case 0x00ee:
            // 00EE: Return from a subroutine.
            if (this.sp === 0) {
              throw new Error("Stack underflow on RET");
            }

            this.sp -= 1;
            this.pc = this.stack[this.sp];
            return;
          default:
            throw new Error(`Unsupported opcode: 0x${opcode.toString(16).padStart(4, "0")}`);
        }

      case 0x1000:
        // 1NNN: Jump to address NNN.
        this.pc = nnn;
        return;

      case 0x2000:
        // 2NNN: Call subroutine at address NNN.
        if (this.sp >= Chip8.STACK_SIZE) {
          throw new Error("Stack overflow on CALL");
        }

        this.stack[this.sp] = this.pc;
        this.sp += 1;
        this.pc = nnn;
        return;

      case 0x3000:
        // 3XNN: Skip the next instruction if VX equals NN.
        if (this.v[x] === nn) {
          this.pc = (this.pc + 2) & 0xffff;
        }
        return;

      case 0x4000:
        // 4XNN: Skip the next instruction if VX does not equal NN.
        if (this.v[x] !== nn) {
          this.pc = (this.pc + 2) & 0xffff;
        }
        return;

      case 0x5000:
        if (n !== 0) {
          break;
        }

        // 5XY0: Skip the next instruction if VX equals VY.
        if (this.v[x] === this.v[y]) {
          this.pc = (this.pc + 2) & 0xffff;
        }
        return;

      case 0x6000:
        // 6XNN: Set VX to NN.
        this.v[x] = nn;
        return;

      case 0x7000:
        // 7XNN: Add NN to VX.
        this.v[x] = (this.v[x] + nn) & 0xff;
        return;

      case 0x8000:
        this.executeMathOpcode(opcode, x, y, n);
        return;

      case 0x9000:
        if (n !== 0) {
          break;
        }

        // 9XY0: Skip the next instruction if VX does not equal VY.
        if (this.v[x] !== this.v[y]) {
          this.pc = (this.pc + 2) & 0xffff;
        }
        return;

      case 0xa000:
        // ANNN: Set I to address NNN.
        this.i = nnn;
        return;

      case 0xb000:
        // BNNN: Jump to address NNN plus V0.
        this.pc = (nnn + this.v[0]) & 0x0fff;
        return;

      case 0xc000:
        // CXNN: Set VX to a random byte AND NN.
        this.v[x] = (Math.floor(Math.random() * 0x100) & nn) & 0xff;
        return;

      case 0xd000:
        // DXYN: Draw an N-byte sprite at (VX, VY).
        this.drawSprite(this.v[x], this.v[y], n);
        return;

      case 0xf000:
        switch (nn) {
          case 0x29:
            // FX29: Set I to the sprite address for the digit stored in VX.
            this.i = this.getFontAddress(this.v[x]);
            return;
          case 0x33:
            // FX33: Store the BCD digits of VX at memory[I..I+2].
            this.storeBcd(this.v[x]);
            return;
          case 0x1e:
            // FX1E: Add VX to I.
            this.i = (this.i + this.v[x]) & 0x0fff;
            return;
          case 0x55:
            // FX55: Store registers V0 through VX in memory starting at I.
            this.storeRegisters(x);
            return;
          case 0x65:
            // FX65: Load registers V0 through VX from memory starting at I.
            this.loadRegisters(x);
            return;
          default:
            break;
        }
        break;
    }

    throw new Error(`Unsupported opcode: 0x${opcode.toString(16).padStart(4, "0")}`);
  }

  private executeMathOpcode(opcode: number, x: number, y: number, n: number): void {
    switch (n) {
      case 0x0:
        // 8XY0: Set VX to VY.
        this.v[x] = this.v[y];
        return;

      case 0x1:
        // 8XY1: Set VX to VX OR VY.
        this.v[x] |= this.v[y];
        return;

      case 0x2:
        // 8XY2: Set VX to VX AND VY.
        this.v[x] &= this.v[y];
        return;

      case 0x3:
        // 8XY3: Set VX to VX XOR VY.
        this.v[x] ^= this.v[y];
        return;

      case 0x4: {
        // 8XY4: Add VY to VX and set VF on carry.
        const sum = this.v[x] + this.v[y];
        this.v[0xf] = sum > 0xff ? 1 : 0;
        this.v[x] = sum & 0xff;
        return;
      }

      case 0x5: {
        // 8XY5: Subtract VY from VX and set VF when no borrow occurs.
        const difference = this.v[x] - this.v[y];
        this.v[0xf] = this.v[x] >= this.v[y] ? 1 : 0;
        this.v[x] = difference & 0xff;
        return;
      }

      case 0x6: {
        // 8XY6: Shift VX right by one and store the dropped bit in VF.
        this.v[0xf] = this.v[x] & 0x1;
        this.v[x] = this.v[x] >> 1;
        return;
      }

      case 0x7: {
        // 8XY7: Set VX to VY minus VX and set VF when no borrow occurs.
        const difference = this.v[y] - this.v[x];
        this.v[0xf] = this.v[y] >= this.v[x] ? 1 : 0;
        this.v[x] = difference & 0xff;
        return;
      }

      case 0xe:
        // 8XYE: Shift VX left by one and store the dropped bit in VF.
        this.v[0xf] = (this.v[x] & 0x80) >> 7;
        this.v[x] = (this.v[x] << 1) & 0xff;
        return;

      default:
        throw new Error(`Unsupported opcode: 0x${opcode.toString(16).padStart(4, "0")}`);
    }
  }

  private drawSprite(x: number, y: number, height: number): void {
    this.v[0xf] = 0;

    for (let row = 0; row < height; row += 1) {
      const sprite = this.memory[this.i + row];

      for (let bit = 0; bit < 8; bit += 1) {
        if ((sprite & (0x80 >> bit)) === 0) {
          continue;
        }

        const px = (x + bit) % Chip8.DISPLAY_WIDTH;
        const py = (y + row) % Chip8.DISPLAY_HEIGHT;
        const index = py * Chip8.DISPLAY_WIDTH + px;
        const previous = this.display[index];
        const next = previous ^ 1;

        if (previous === 1 && next === 0) {
          this.v[0xf] = 1;
        }

        this.display[index] = next;
      }
    }
  }

  private loadFontSet(): void {
    this.memory.set(Chip8.FONT_SET, Chip8.FONT_START);
  }

  private getFontAddress(digit: number): number {
    const normalizedDigit = digit & 0x0f;
    return Chip8.FONT_START + normalizedDigit * Chip8.FONT_CHAR_BYTES;
  }

  private storeBcd(value: number): void {
    if (this.i + 2 >= Chip8.MEMORY_SIZE) {
      throw new Error(`BCD store out of bounds at I=0x${this.i.toString(16)}`);
    }

    this.memory[this.i] = Math.floor(value / 100);
    this.memory[this.i + 1] = Math.floor((value % 100) / 10);
    this.memory[this.i + 2] = value % 10;
  }

  private storeRegisters(lastRegister: number): void {
    if (this.i + lastRegister >= Chip8.MEMORY_SIZE) {
      throw new Error(`Register store out of bounds at I=0x${this.i.toString(16)}`);
    }

    for (let register = 0; register <= lastRegister; register += 1) {
      this.memory[this.i + register] = this.v[register];
    }
  }

  private loadRegisters(lastRegister: number): void {
    if (this.i + lastRegister >= Chip8.MEMORY_SIZE) {
      throw new Error(`Register load out of bounds at I=0x${this.i.toString(16)}`);
    }

    for (let register = 0; register <= lastRegister; register += 1) {
      this.v[register] = this.memory[this.i + register];
    }
  }
}
