/**
 * A generator's diagram in the panel (see lib/chart.ts). One series on one
 * axis, so the title names it and there is no legend; hovering reads off the
 * value and the span it falls in, and the table gives the same at each span
 * boundary for anyone not reading the line.
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import type { ChartData } from '../lib/chart';

const HEIGHT = 150;
const PAD = { top: 18, right: 10, bottom: 22, left: 38 };

/** A 1-2-5 step giving about `count` intervals over `span`. */
function niceStep(span: number, count: number): number {
  const raw = span / Math.max(1, count);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const f = raw / mag;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * mag;
}

const fmt = (v: number) => String(+v.toFixed(Math.abs(v) < 10 ? 1 : 0));

export function Chart({ chart }: { chart: ChartData }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => e && setWidth(Math.max(200, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pts = chart.points;
  if (pts.length < 2) return null;

  const xMin = pts[0]![0];
  const xMax = pts[pts.length - 1]![0];
  const ys = pts.map((p) => p[1]);
  // Lift is measured from zero, so zero is always on the axis.
  const step = niceStep(Math.max(...ys, 0) - Math.min(...ys, 0) || 1, 4);
  const yMin = Math.floor(Math.min(...ys, 0) / step) * step;
  const yMax = Math.ceil(Math.max(...ys, 0) / step) * step || step;

  const plotW = width - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const sx = (x: number) => PAD.left + ((x - xMin) / (xMax - xMin || 1)) * plotW;
  const sy = (y: number) => PAD.top + (1 - (y - yMin) / (yMax - yMin)) * plotH;

  const yTicks: number[] = [];
  for (let v = yMin; v <= yMax + step / 2; v += step) yTicks.push(+v.toFixed(6));
  const xTicks = chart.xTicks ?? [xMin, (xMin + xMax) / 2, xMax];
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p[0]).toFixed(1)},${sy(p[1]).toFixed(1)}`).join('');

  const onMove = (e: PointerEvent) => {
    const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
    const x = xMin + ((e.clientX - rect.left - PAD.left) / plotW) * (xMax - xMin);
    // Points run left to right, so the nearest is found by bisection.
    let lo = 0;
    let hi = pts.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (pts[mid]![0] < x) lo = mid;
      else hi = mid;
    }
    setHover(Math.abs(pts[lo]![0] - x) < Math.abs(pts[hi]![0] - x) ? lo : hi);
  };

  const hp = hover !== null ? pts[hover] : undefined;
  const hSpan = hp && chart.spans?.find((s) => hp[0] >= s.from && hp[0] <= s.to);
  const yAt = (x: number) => pts.reduce((best, p) => (Math.abs(p[0] - x) < Math.abs(best[0] - x) ? p : best))[1];

  return (
    <figure class="chart" ref={wrap}>
      <figcaption class="chart-title">{chart.title}</figcaption>
      <svg
        width={width}
        height={HEIGHT}
        role="img"
        aria-label={`${chart.title}: ${chart.yLabel} against ${chart.xLabel}, ${fmt(Math.min(...ys))} to ${fmt(Math.max(...ys))} ${chart.yUnit}`}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {yTicks.map((v) => (
          <g key={`y${v}`}>
            <line class="chart-grid" x1={PAD.left} x2={width - PAD.right} y1={sy(v)} y2={sy(v)} />
            <text class="chart-tick" x={PAD.left - 6} y={sy(v)} text-anchor="end" dominant-baseline="middle">
              {fmt(v)}
            </text>
          </g>
        ))}
        {chart.spans?.slice(1).map((s) => (
          <line key={`s${s.from}`} class="chart-span" x1={sx(s.from)} x2={sx(s.from)} y1={PAD.top} y2={PAD.top + plotH} />
        ))}
        {xTicks.map((v) => (
          <text
            key={`x${v}`}
            class="chart-tick"
            x={sx(v)}
            y={HEIGHT - PAD.bottom + 14}
            // The end ticks would hang off the plot if centred.
            text-anchor={v === xMin ? 'start' : v === xMax ? 'end' : 'middle'}
          >
            {fmt(v)}
            {chart.xUnit}
          </text>
        ))}
        <text class="chart-tick" x={PAD.left - 6} y={PAD.top - 8} text-anchor="end">
          {chart.yUnit}
        </text>
        <path class="chart-line" d={line} />
        {hp && (
          <g>
            <line class="chart-cross" x1={sx(hp[0])} x2={sx(hp[0])} y1={PAD.top} y2={PAD.top + plotH} />
            <circle class="chart-dot" cx={sx(hp[0])} cy={sy(hp[1])} r={4} />
          </g>
        )}
      </svg>
      {hp && (
        <div
          class="chart-tip"
          // Below the point in the top half of the plot and above it in the
          // bottom half, so it never covers the stretch of line being read.
          style={{
            left: `${Math.min(Math.max(sx(hp[0]), 70), width - 70)}px`,
            top: `${sy(hp[1]) < PAD.top + plotH / 2 ? sy(hp[1]) + 40 : sy(hp[1]) - 30}px`,
          }}
        >
          <strong>
            {fmt(hp[1])} {chart.yUnit}
          </strong>{' '}
          at {Math.round(hp[0])}
          {chart.xUnit}
          {hSpan && <div class="chart-tip-sub">{hSpan.label}</div>}
        </div>
      )}
      {chart.spans && (
        <details class="chart-table">
          <summary>Values</summary>
          <table>
            <thead>
              <tr>
                <th>
                  {chart.xLabel} ({chart.xUnit})
                </th>
                <th>
                  {chart.yLabel} ({chart.yUnit})
                </th>
                <th>Then</th>
              </tr>
            </thead>
            <tbody>
              {chart.spans.map((s) => (
                <tr key={s.from}>
                  <td>{fmt(s.from)}</td>
                  <td>{fmt(yAt(s.from))}</td>
                  <td>{s.label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </figure>
  );
}
