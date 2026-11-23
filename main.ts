// Tiny stack VM (ISA v1) for make.fun tiny-stack-vm-01-run-20261122.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';

const STEP_LIMIT = 1000000;
const STACK_LIMIT = 256;
const CALL_LIMIT = 64;
const OUT_LIMIT = 65536;

// Run one program; return its output bytes and exit code. Endings are
// thrown as plain numbers and turned into the result by the catch below.
function runVm(prog: Uint8Array, input: Uint8Array) {
  const stack: number[] = [];
  const calls: number[] = [];
  const mem = new Int32Array(256);
  const bytes: number[] = [];
  const n = prog.length;
  let pc = 0;
  let steps = 0;
  let ip = 0;
  const need = (k: number) => {
    if (stack.length < k) throw 2;
  };
  const room = () => {
    if (stack.length >= STACK_LIMIT) throw 3;
  };
  const pop = (): number => stack.pop() as number;
  const push = (v: number) => {
    stack.push(v | 0);
  };
  const binop = (f: any) => {
    need(2);
    const b = pop();
    push(f(pop(), b));
  };
  const unop = (f: any) => {
    need(1);
    push(f(pop()));
  };
  let code = 0;
  try {
    for (;;) {
      if (steps >= STEP_LIMIT) throw 10;
      if (pc < 0 || pc >= n) throw 9;
      const op = prog[pc];
      switch (op) {
        case 0x00:
          throw 0;
        case 0x01: {
          if (pc + 1 >= n) throw 9;
          room();
          const b = prog[pc + 1];
          push(b >= 128 ? b - 256 : b);
          pc += 2;
          break;
        }
        case 0x02: {
          if (pc + 4 >= n) throw 9;
          room();
          push(prog[pc + 1] | (prog[pc + 2] << 8) | (prog[pc + 3] << 16) | (prog[pc + 4] << 24));
          pc += 5;
          break;
        }
        case 0x03: need(1); pop(); pc++; break;
        case 0x04: need(1); room(); push(stack[stack.length - 1]); pc++; break;
        case 0x05: {
          need(2);
          const t = stack.length - 1;
          const tmp = stack[t];
          stack[t] = stack[t - 1];
          stack[t - 1] = tmp;
          pc++;
          break;
        }
        case 0x06: need(2); room(); push(stack[stack.length - 2]); pc++; break;
        case 0x07: {
          need(3);
          const t = stack.length - 1;
          const a = stack[t - 2];
          stack[t - 2] = stack[t - 1];
          stack[t - 1] = stack[t];
          stack[t] = a;
          pc++;
          break;
        }
        case 0x10: binop((a, b) => a + b); pc++; break;
        case 0x11: binop((a, b) => a - b); pc++; break;
        case 0x12: binop((a, b) => Math.imul(a, b)); pc++; break;
        case 0x13:
          binop((a, b) => {
            if (b === 0) throw 4;
            return (a / b) | 0;
          });
          pc++;
          break;
        case 0x14:
          binop((a, b) => {
            if (b === 0) throw 4;
            return a % b;
          });
          pc++;
          break;
        case 0x15:
          binop((a, b) => {
            if (b === 0) throw 4;
            return (a >>> 0) / (b >>> 0);
          });
          pc++;
          break;
        case 0x16:
          binop((a, b) => {
            if (b === 0) throw 4;
            return (a >>> 0) % (b >>> 0);
          });
          pc++;
          break;
        case 0x17: unop((a) => -a); pc++; break;
        case 0x18: binop((a, b) => a & b); pc++; break;
        case 0x19: binop((a, b) => a | b); pc++; break;
        case 0x1a: binop((a, b) => a ^ b); pc++; break;
        case 0x1b: unop((a) => ~a); pc++; break;
        case 0x1c: binop((a, b) => a << (b & 31)); pc++; break;
        case 0x1d: binop((a, b) => a >> (b & 31)); pc++; break;
        case 0x1e: binop((a, b) => a >>> (b & 31)); pc++; break;
        case 0x20: binop((a, b) => (a === b ? 1 : 0)); pc++; break;
        case 0x21: binop((a, b) => (a < b ? 1 : 0)); pc++; break;
        case 0x22: binop((a, b) => ((a >>> 0) < (b >>> 0) ? 1 : 0)); pc++; break;
        case 0x30: {
          if (pc + 2 >= n) throw 9;
          const off = ((prog[pc + 1] | (prog[pc + 2] << 8)) << 16) >> 16;
          pc = pc + 3 + off;
          break;
        }
        case 0x31: {
          if (pc + 2 >= n) throw 9;
          need(1);
          const v = pop();
          const off = ((prog[pc + 1] | (prog[pc + 2] << 8)) << 16) >> 16;
          pc = v === 0 ? pc + 3 + off : pc + 3;
          break;
        }
        case 0x32: {
          if (pc + 2 >= n) throw 9;
          need(1);
          const v = pop();
          const off = ((prog[pc + 1] | (prog[pc + 2] << 8)) << 16) >> 16;
          pc = v !== 0 ? pc + 3 + off : pc + 3;
          break;
        }
        case 0x33: {
          if (pc + 2 >= n) throw 9;
          if (calls.length >= CALL_LIMIT) throw 7;
          calls.push(pc + 3);
          pc = prog[pc + 1] | (prog[pc + 2] << 8);
          break;
        }
        case 0x34: if (calls.length === 0) throw 8; pc = calls.pop() as number; break;
        case 0x40: {
          need(1);
          const addr = pop();
          if (addr < 0 || addr > 255) throw 6;
          push(mem[addr]);
          pc++;
          break;
        }
        case 0x41: {
          need(2);
          const addr = pop();
          const v = pop();
          if (addr < 0 || addr > 255) throw 6;
          mem[addr] = v;
          pc++;
          break;
        }
        case 0x50: {
          need(1);
          const v = pop();
          const s = String(v);
          if (bytes.length + s.length > OUT_LIMIT) throw 11;
          for (let i = 0; i < s.length; i++) bytes.push(s.charCodeAt(i));
          pc++;
          break;
        }
        case 0x51: {
          need(1);
          const v = pop();
          if (bytes.length + 1 > OUT_LIMIT) throw 11;
          bytes.push(v & 255);
          pc++;
          break;
        }
        case 0x52: room(); push(ip < input.length ? input[ip++] : -1); pc++; break;
        case 0x53: {
          need(1);
          const v = pop();
          throw v & 255;
        }
        default:
          throw 5;
      }
      steps++;
    }
  } catch (e) {
    code = typeof e === 'number' ? e : 255;
  }
  return { out: Buffer.from(bytes), code };
}

// Driver: answer every instance of the set in one run.
const inDir = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
for (const id of readdirSync(inDir).sort()) {
  const prog = readFileSync(path.join(inDir, id, 'program.bin'));
  const input = readFileSync(path.join(inDir, id, 'input.bin'));
  const { out, code } = runVm(prog, input);
  const dir = path.join(outDir, id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'stdout.bin'), out);
  writeFileSync(path.join(dir, 'exit.txt'), String(code) + '\n');
}
