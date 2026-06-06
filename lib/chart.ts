/* Tiny SVG chart math helpers — ported from the design prototype. */

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

export interface AreaPathResult {
  area: string;
  line: string;
  x: (i: number) => number;
  y: (v: number) => number;
}

/** Smooth-ish area + line path for a series of values. */
export function areaPath(vals: number[], w: number, h: number, pad = 0): AreaPathResult {
  const n = vals.length;
  if (n === 0) return { area: '', line: '', x: () => 0, y: () => h };

  const max = (Math.max(...vals) * 1.1) || 1;
  const min = 0;
  const range = (max - min) || 1;
  const denom = n > 1 ? n - 1 : 1;

  const x = (i: number) => pad + (i * (w - pad * 2)) / denom;
  const y = (v: number) => h - pad - ((v - min) / range) * (h - pad * 2);

  let d = `M ${x(0)} ${y(vals[0])}`;
  for (let i = 1; i < n; i++) {
    const xc = (x(i - 1) + x(i)) / 2;
    d += ` C ${xc} ${y(vals[i - 1])}, ${xc} ${y(vals[i])}, ${x(i)} ${y(vals[i])}`;
  }
  const line = d;
  d += ` L ${x(n - 1)} ${h} L ${x(0)} ${h} Z`;
  return { area: d, line, x, y };
}

export interface DonutArc extends DonutSegment {
  dash: string;
  offset: number;
  pct: number;
}

export interface DonutResult {
  r: number;
  c: number;
  arcs: DonutArc[];
  total: number;
  cx: number;
  cy: number;
}

/** Compute stroke-dash arcs for a donut chart. */
export function donut(segments: DonutSegment[], size: number, stroke: number): DonutResult {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  let acc = 0;
  const arcs: DonutArc[] = segments.map((s) => {
    const frac = s.value / total;
    const dash = `${frac * c} ${c}`;
    const offset = -acc * c;
    acc += frac;
    return { ...s, dash, offset, pct: Math.round(frac * 100) };
  });
  return { r, c, arcs, total, cx: size / 2, cy: size / 2 };
}
