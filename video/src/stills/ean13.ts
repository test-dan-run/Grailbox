// EAN-13 bar patterns, for drawing the barcode scene. 1 is a bar, 0 a space.

const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111'];
const R = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100'];
const PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

/** The 95 modules of a 13-digit code, and which of them are the taller guard bars. */
export function ean13(code: string): { modules: string; guards: Set<number> } {
  if (!/^\d{13}$/.test(code)) throw new Error(`Not a 13-digit code: ${code}`);
  const d = [...code].map(Number);
  const parity = PARITY[d[0]];
  const left = d.slice(1, 7).map((n, i) => (parity[i] === 'L' ? L[n] : G[n])).join('');
  const right = d.slice(7).map((n) => R[n]).join('');
  const modules = `101${left}01010${right}101`;
  const guards = new Set([0, 1, 2, 45, 46, 47, 48, 49, 92, 93, 94]);
  return { modules, guards };
}
