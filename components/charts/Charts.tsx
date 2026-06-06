/* Theme-aware SVG chart primitives — ported from the design prototype.
   Replace Recharts; colors driven by CSS variables so they follow the theme. */
import React from 'react';
import { areaPath, donut, DonutSegment } from '../../lib/chart';

interface AreaChartProps {
  vals: number[];
  w?: number;
  h?: number;
  stroke?: string;
  id?: string;
  second?: number[];
}

export const AreaChart: React.FC<AreaChartProps> = ({
  vals,
  w = 640,
  h = 230,
  stroke = 'var(--accent)',
  id = 'a',
  second,
}) => {
  if (!vals || vals.length === 0) return null;
  const pad = 6;
  const ih = h - 26;
  const { area, line, x, y } = areaPath(vals, w, ih, pad);
  const grid = [0, 0.25, 0.5, 0.75, 1].map((f) => ih - f * (ih - pad));
  const max = Math.max(...vals);
  const s2 =
    second && second.length
      ? areaPath(
          second.map((v) => (v / (Math.max(...second) || 1)) * (max || 1)),
          w,
          ih,
          pad,
        )
      : null;
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`grad-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={stroke} stopOpacity=".26" />
          <stop offset="1" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      {grid.map((gy, i) => (
        <line key={i} x1="0" y1={gy} x2={w} y2={gy} style={{ stroke: 'var(--line-soft)' }} strokeWidth="1" strokeDasharray="3 6" />
      ))}
      <path d={area} fill={`url(#grad-${id})`} />
      <path d={line} fill="none" stroke={stroke} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      {s2 && <path d={s2.line} fill="none" style={{ stroke: 'var(--faint)' }} strokeWidth="2" strokeDasharray="4 5" />}
      <circle cx={x(vals.length - 1)} cy={y(vals[vals.length - 1])} r="4.5" style={{ fill: 'var(--panel)' }} stroke={stroke} strokeWidth="2.6" />
    </svg>
  );
};

interface SparklineProps {
  vals: number[];
  w?: number;
  h?: number;
  color?: string;
  id: string;
}

export const Sparkline: React.FC<SparklineProps> = ({ vals, w = 150, h = 40, color = 'var(--accent)', id }) => {
  if (!vals || vals.length === 0) return null;
  const { area, line } = areaPath(vals, w, h, 2);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`sp-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity=".22" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#sp-${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
};

interface DonutProps {
  segments: DonutSegment[];
  size?: number;
  stroke?: number;
  center?: { v: string; l: string };
}

export const Donut: React.FC<DonutProps> = ({ segments, size = 200, stroke = 26, center }) => {
  const { r, arcs, cx, cy } = donut(segments, size, stroke);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <g transform={`rotate(-90 ${cx} ${cy})`}>
        <circle cx={cx} cy={cy} r={r} fill="none" style={{ stroke: 'var(--inset)' }} strokeWidth={stroke} />
        {arcs.map((a, i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={a.color}
            strokeWidth={stroke}
            strokeDasharray={a.dash}
            strokeDashoffset={a.offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray .7s cubic-bezier(.2,.8,.2,1)' }}
          />
        ))}
      </g>
      {center && (
        <>
          <text x={cx} y={cy - 3} textAnchor="middle" fontSize="29" fontWeight="800" style={{ fill: 'var(--ink)' }}>
            {center.v}
          </text>
          <text x={cx} y={cy + 18} textAnchor="middle" fontSize="12.5" fontWeight="700" style={{ fill: 'var(--muted)' }}>
            {center.l}
          </text>
        </>
      )}
    </svg>
  );
};

interface BarDatum {
  label: string;
  value: number;
  color: string;
}

interface BarChartProps {
  data: BarDatum[];
  w?: number;
  h?: number;
  max?: number;
}

export const BarChart: React.FC<BarChartProps> = ({ data, w = 540, h = 220, max }) => {
  if (!data || data.length === 0) return null;
  const m = max || Math.max(...data.map((d) => d.value)) || 1;
  const n = data.length;
  const gap = 0.42;
  const bw = w / n;
  const ticks = 4;
  // Show at most ~1 label per 72px so axis labels never overlap.
  const labelStep = Math.ceil(n / Math.max(2, Math.floor(w / 72)));
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      {Array.from({ length: ticks + 1 }).map((_, i) => {
        const gy = h - 28 - (i / ticks) * (h - 38);
        return <line key={i} x1="0" y1={gy} x2={w} y2={gy} style={{ stroke: 'var(--line-soft)' }} strokeWidth="1" strokeDasharray="3 6" />;
      })}
      {data.map((d, i) => {
        const bh = (d.value / m) * (h - 38);
        const x = i * bw + (bw * gap) / 2;
        return (
          <g key={i}>
            <rect x={x} y={h - 28 - bh} width={bw * (1 - gap)} height={bh} rx="6" fill={d.color} style={{ transition: 'height .6s, y .6s' }} />
            {i % labelStep === 0 && (
              <text x={x + (bw * (1 - gap)) / 2} y={h - 8} textAnchor="middle" fontSize="10.5" fontWeight="700" style={{ fill: 'var(--muted)' }}>
                {d.label.length > 10 ? d.label.slice(0, 9) + '…' : d.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
};
