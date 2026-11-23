// Tiny stack VM for make.fun's tiny stack ISA v1, written from the ISA spec in the kit.
// runVM(program, input) -> { stdout, exit }; main() drives one set: /input/<id> -> /output/<id>.
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Trap codes (ISA.md "Traps"): 2 underflow, 3 overflow, 4 div by zero, 5 bad opcode,
// 6 bad memory address, 7 call depth, 8 RET on empty call stack, 9 pc/immediate,
// 10 step limit, 11 output limit. A trap keeps the output written before it.

export function runVM(program: Uint8Array, input: Uint8Array): { stdout: Uint8Array; exit: number } {
  const st: number[] = [];
  const cs: number[] = [];
  const mem = new Int32Array(256);
  const out: number[] = [];
  const plen = program.length;
  let pc = 0, ip = 0, steps = 0, exit = 0;
  const under = (n: number) => st.length < n && (exit = 2);
  const over = () => st.length >= 256 && (exit = 3);
  const s16 = (lo: number, hi: number) => ((lo | (hi << 8)) << 16) >> 16;

  for (;;) {
    // Step order (ISA.md): step limit, pc range, opcode known, immediate fits, then execute.
    if (steps >= 1e6) { exit = 10; break; }
    if (pc < 0 || pc >= plen) { exit = 9; break; }
    const op = program[pc];
    const known = op <= 0x07 || (op >= 0x10 && op <= 0x1e) || (op >= 0x20 && op <= 0x22) ||
      (op >= 0x30 && op <= 0x34) || (op >= 0x40 && op <= 0x41) || (op >= 0x50 && op <= 0x53);
    if (!known) { exit = 5; break; }
    const imm = op === 0x01 ? 1 : op === 0x02 ? 4 : op >= 0x30 && op <= 0x33 ? 2 : 0;
    if (pc + 1 + imm > plen) { exit = 9; break; }
    steps++;
    const at = pc;
    pc = at + 1 + imm;

    switch (op) {
      case 0x00: return { stdout: Uint8Array.from(out), exit: 0 };
      case 0x01:
        if (over()) break;
        st.push((program[at + 1] << 24) >> 24);
        break;
      case 0x02:
        if (over()) break;
        st.push(program[at + 1] | (program[at + 2] << 8) | (program[at + 3] << 16) | (program[at + 4] << 24));
        break;
      case 0x03:
        if (under(1)) break;
        st.pop();
        break;
      case 0x04:
        if (under(1) || over()) break;
        st.push(st[st.length - 1]);
        break;
      case 0x05: {
        if (under(2)) break;
        const t = st[st.length - 1];
        st[st.length - 1] = st[st.length - 2];
        st[st.length - 2] = t;
        break;
      }
      case 0x06:
        if (under(2) || over()) break;
        st.push(st[st.length - 2]);
        break;
      case 0x07: {
        if (under(3)) break;
        const n = st.length, a = st[n - 3];
        st[n - 3] = st[n - 2];
        st[n - 2] = st[n - 1];
        st[n - 1] = a;
        break;
      }
      case 0x10: case 0x11: case 0x12: case 0x13: case 0x14: case 0x15: case 0x16:
      case 0x18: case 0x19: case 0x1a: case 0x1c: case 0x1d: case 0x1e:
      case 0x20: case 0x21: case 0x22: {
        if (under(2)) break;
        const b = st.pop() as number, a = st.pop() as number;
        if (op >= 0x13 && op <= 0x16 && b === 0) { exit = 4; break; }
        let r: number;
        if (op === 0x10) r = (a + b) | 0;
        else if (op === 0x11) r = (a - b) | 0;
        else if (op === 0x12) r = Math.imul(a, b);
        else if (op === 0x13) r = (a / b) | 0;
        else if (op === 0x14) r = (a % b) | 0;
        else if (op === 0x15) r = Number(BigInt(a >>> 0) / BigInt(b >>> 0)) | 0;
        else if (op === 0x16) r = Number(BigInt(a >>> 0) % BigInt(b >>> 0)) | 0;
        else if (op === 0x18) r = a & b;
        else if (op === 0x19) r = a | b;
        else if (op === 0x1a) r = a ^ b;
        else if (op === 0x1c) r = a << (b & 31);
        else if (op === 0x1d) r = a >> (b & 31);
        else if (op === 0x1e) r = (a >>> (b & 31)) | 0;
        else if (op === 0x20) r = a === b ? 1 : 0;
        else if (op === 0x21) r = a < b ? 1 : 0;
        else r = (a >>> 0) < (b >>> 0) ? 1 : 0;
        st.push(r);
        break;
      }
      case 0x17:
        if (under(1)) break;
        st.push((-st.pop() as number) | 0);
        break;
      case 0x1b:
        if (under(1)) break;
        st.push(~(st.pop() as number));
        break;
      case 0x30:
        pc = pc + s16(program[at + 1], program[at + 2]);
        break;
      case 0x31:
      case 0x32: {
        if (under(1)) break;
        const v = st.pop() as number;
        if ((op === 0x31 && v === 0) || (op === 0x32 && v !== 0)) pc = pc + s16(program[at + 1], program[at + 2]);
        break;
      }
      case 0x33:
        if (cs.length >= 64) { exit = 7; break; }
        cs.push(pc);
        pc = program[at + 1] | (program[at + 2] << 8);
        break;
      case 0x34:
        if (cs.length === 0) { exit = 8; break; }
        pc = cs.pop() as number;
        break;
      case 0x40: {
        if (under(1)) break;
        const addr = st.pop() as number;
        if (addr < 0 || addr > 255) { exit = 6; break; }
        st.push(mem[addr]);
        break;
      }
      case 0x41: {
        if (under(2)) break;
        const addr = st.pop() as number, v = st.pop() as number;
        if (addr < 0 || addr > 255) { exit = 6; break; }
        mem[addr] = v;
        break;
      }
      case 0x50: {
        if (under(1)) break;
        const s = String(st.pop() as number);
        if (out.length + s.length > 65536) { exit = 11; break; }
        for (let i = 0; i < s.length; i++) out.push(s.charCodeAt(i));
        break;
      }
      case 0x51:
        if (under(1)) break;
        if (out.length + 1 > 65536) { exit = 11; break; }
        out.push((st.pop() as number) & 255);
        break;
      case 0x52:
        if (over()) break;
        st.push(ip < input.length ? input[ip++] : -1);
        break;
      case 0x53:
        if (under(1)) break;
        return { stdout: Uint8Array.from(out), exit: (st.pop() as number) & 255 };
    }
    if (exit !== 0) break;
  }
  return { stdout: Uint8Array.from(out), exit };
}

function main(): void {
  const I = process.env.MAKEFUN_INPUT_DIR ?? '/input';
  const O = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
  const ids = readdirSync(I, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
  for (const id of ids) {
    const program = readFileSync(join(I, id, 'program.bin'));
    let input: Uint8Array;
    try {
      input = readFileSync(join(I, id, 'input.bin'));
    } catch {
      input = new Uint8Array(0);
    }
    const { stdout, exit } = runVM(program, input);
    mkdirSync(join(O, id), { recursive: true });
    writeFileSync(join(O, id, 'stdout.bin'), stdout);
    writeFileSync(join(O, id, 'exit.txt'), exit + '\n');
  }
}

if (process.env.TINYSTACK_NO_MAIN !== '1') main();
