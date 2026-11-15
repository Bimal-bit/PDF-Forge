export type MathNode =
  | { kind: 'row'; children: MathNode[] }
  | { kind: 'text'; text: string; upright?: boolean }
  | { kind: 'fraction'; numerator: MathNode; denominator: MathNode }
  | { kind: 'root'; content: MathNode }
  | { kind: 'scripts'; base: MathNode; upper?: MathNode; lower?: MathNode };

const symbols: Record<string, string> = {
  alpha: 'α',
  beta: 'β',
  gamma: 'γ',
  delta: 'δ',
  epsilon: 'ε',
  theta: 'θ',
  lambda: 'λ',
  mu: 'μ',
  pi: 'π',
  rho: 'ρ',
  sigma: 'σ',
  phi: 'φ',
  omega: 'ω',
  Gamma: 'Γ',
  Delta: 'Δ',
  Theta: 'Θ',
  Lambda: 'Λ',
  Pi: 'Π',
  Sigma: 'Σ',
  Phi: 'Φ',
  Omega: 'Ω',
  sum: '∑',
  prod: '∏',
  int: '∫',
  infty: '∞',
  times: '×',
  cdot: '·',
  pm: '±',
  le: '≤',
  leq: '≤',
  ge: '≥',
  geq: '≥',
  ne: '≠',
  neq: '≠',
  approx: '≈',
  partial: '∂',
  nabla: '∇',
  to: '→',
  rightarrow: '→',
  leftarrow: '←',
  in: '∈',
  notin: '∉',
  cup: '∪',
  cap: '∩',
};

export function parseEquation(latex: string): MathNode {
  if (!latex.trim()) throw new Error('Enter an equation.');
  if (latex.length > 2000) throw new Error('Equations support up to 2,000 input characters.');
  let position = 0;
  let depth = 0;
  const spaces = () => {
    while (/\s/.test(latex[position] ?? '') && position < latex.length) position += 1;
  };
  const group = (): MathNode => {
    spaces();
    if (position >= latex.length) throw new Error('An equation argument is missing.');
    if (latex[position] !== '{') return atom();
    position += 1;
    const result = sequence(true);
    return result;
  };
  const atom = (): MathNode => {
    spaces();
    if (latex[position] === '{') return group();
    const character = latex[position++];
    if (!character || character === '}' || character === '^' || character === '_')
      throw new Error('Check the braces and script arguments.');
    if (character !== '\\') return { kind: 'text', text: character };
    const command = /^[a-zA-Z]+/.exec(latex.slice(position))?.[0] ?? latex[position++] ?? '';
    if (/^[a-zA-Z]+$/.test(command)) position += command.length;
    if (command === 'frac') return { kind: 'fraction', numerator: group(), denominator: group() };
    if (command === 'sqrt') return { kind: 'root', content: group() };
    if (command === 'text' || command === 'mathrm') {
      spaces();
      if (latex[position++] !== '{') throw new Error(`\\${command} needs a braced argument.`);
      const end = latex.indexOf('}', position);
      if (end < 0 || latex.slice(position, end).includes('{'))
        throw new Error('Text arguments need balanced, unnested braces.');
      const text = latex.slice(position, end);
      position = end + 1;
      return { kind: 'text', text, upright: true };
    }
    if (['left', 'right', 'displaystyle'].includes(command)) return { kind: 'row', children: [] };
    if (['sin', 'cos', 'tan', 'log', 'ln', 'lim', 'exp'].includes(command))
      return { kind: 'text', text: command, upright: true };
    if ([' ', ',', ';', ':', 'quad'].includes(command))
      return { kind: 'text', text: command === 'quad' ? '  ' : ' ', upright: true };
    if (['{', '}', '%', '_', '#', '$', '|'].includes(command))
      return { kind: 'text', text: command, upright: true };
    if (symbols[command]) return { kind: 'text', text: symbols[command] };
    throw new Error(`Unsupported LaTeX command \\${command}.`);
  };
  const sequence = (braced: boolean): MathNode => {
    if (++depth > 32) throw new Error('The equation has too many nested groups.');
    const children: MathNode[] = [];
    while (position < latex.length) {
      spaces();
      if (position >= latex.length) break;
      if (latex[position] === '}') {
        if (!braced) throw new Error('An opening brace is missing.');
        position += 1;
        depth -= 1;
        return { kind: 'row', children };
      }
      let base = atom();
      spaces();
      const scripts: { upper?: MathNode; lower?: MathNode } = {};
      while (latex[position] === '^' || latex[position] === '_') {
        const property = latex[position++] === '^' ? 'upper' : 'lower';
        if (scripts[property]) throw new Error('Use one superscript and one subscript per term.');
        scripts[property] = group();
        spaces();
      }
      if (scripts.upper || scripts.lower) base = { kind: 'scripts', base, ...scripts };
      children.push(base);
    }
    depth -= 1;
    if (braced) throw new Error('A closing brace is missing.');
    return { kind: 'row', children };
  };
  return sequence(false);
}
