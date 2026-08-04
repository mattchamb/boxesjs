/**
 * The live preview.
 *
 * Two decisions make this fast:
 *
 * 1. One `<path>` per layer, not per shape. The worker merges every path of a
 *    layer into a single `d` string, so a parameter change is four attribute
 *    writes no matter how complex the box. Building thousands of nodes per
 *    keystroke is what makes naive versions of this crawl.
 *
 * 2. Pan and zoom are a `transform` on an inner group rather than a viewBox
 *    change, so the browser composites instead of re-laying-out.
 *
 * `vector-effect: non-scaling-stroke` keeps lines hairline at any zoom, which
 * is both faster and a truer picture of what the laser will do.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { LAYERS, LAYER_INFO, type Layer } from '../lib/geom/colors';
import type { PreviewData, PreviewPart } from '../lib/preview';

interface Props {
  data: PreviewData | null;
  error: string | null;
  visibleLayers: Set<Layer>;
  showGrid: boolean;
}

interface View {
  scale: number;
  x: number;
  y: number;
}

const MIN_SCALE = 0.05;
const MAX_SCALE = 60;

export function Preview({ data, error, visibleLayers, showGrid }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>({ scale: 1, x: 0, y: 0 });
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [hover, setHover] = useState<{ part: PreviewPart; cx: number; cy: number } | null>(null);
  const [isolated, setIsolated] = useState<string | null>(null);
  const [grabbing, setGrabbing] = useState(false);

  // Keep the SVG viewport matched to the element so nothing is letterboxed.
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setSize({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fit = useRef<() => void>(() => {});
  fit.current = () => {
    if (!data || data.bbox.width <= 0 || data.bbox.height <= 0) return;
    const pad = 24;
    const scale = Math.min(
      (size.w - pad * 2) / data.bbox.width,
      (size.h - pad * 2) / data.bbox.height,
    );
    const s = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));
    setView({
      scale: s,
      x: (size.w - data.bbox.width * s) / 2,
      y: (size.h - data.bbox.height * s) / 2,
    });
  };

  // Fit when the drawing's size changes, but not on every parameter tweak —
  // the view should stay put while you nudge a slider.
  const fitKey = data ? `${Math.round(data.bbox.width)}x${Math.round(data.bbox.height)}` : '';
  const lastFit = useRef<string>('');
  useEffect(() => {
    if (!data || !fitKey) return;
    if (lastFit.current === fitKey && view.scale !== 1) return;
    lastFit.current = fitKey;
    fit.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, size.w, size.h]);

  // Wheel zoom toward the cursor.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;

      setView((v) => {
        const factor = Math.exp(-e.deltaY * 0.0015);
        const next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, v.scale * factor));
        const k = next / v.scale;
        // Hold the point under the cursor still.
        return { scale: next, x: px - (px - v.x) * k, y: py - (py - v.y) * k };
      });
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      if (e.key === 'f' || e.key === 'F') fit.current();
      if (e.key === '1') setView((v) => ({ ...v, scale: 1 }));
      if (e.key === 'Escape') setIsolated(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    setGrabbing(true);

    const startX = e.clientX;
    const startY = e.clientY;
    const start = view;
    let moved = false;

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;
      setView({ scale: start.scale, x: start.x + dx, y: start.y + dy });
    };

    const onUp = (ev: PointerEvent) => {
      el.releasePointerCapture(ev.pointerId);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      setGrabbing(false);
      // A drag should not also count as a click on a part.
      if (!moved) {
        const target = ev.target as SVGElement;
        const name = target?.getAttribute?.('data-part');
        setIsolated((cur) => (name && cur !== name ? name : null));
      }
    };

    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
  };

  const transform = `translate(${view.x} ${view.y}) scale(${view.scale})`;

  return (
    <div
      class={`canvas-wrap${grabbing ? ' grabbing' : ''}`}
      ref={wrapRef}
      onPointerDown={onPointerDown as unknown as (e: Event) => void}
      onDblClick={() => fit.current()}
    >
      <svg width={size.w} height={size.h} role="img" aria-label="Cutting layout preview">
        {showGrid && <GridDefs />}
        <g transform={transform}>
          {data && (
            <>
              <rect class="sheet" x={0} y={0} width={data.bbox.width} height={data.bbox.height} />
              {showGrid && (
                <rect x={0} y={0} width={data.bbox.width} height={data.bbox.height} fill="url(#grid)" />
              )}

              {LAYERS.filter((l) => visibleLayers.has(l) && data.layers[l]).map((l) => (
                <path
                  key={l}
                  class={`layer-path${isolated ? ' dimmed' : ''}`}
                  d={data.layers[l]}
                  stroke={LAYER_INFO[l].css}
                />
              ))}

              {/* Part labels, so what you see matches what the export contains. */}
              <g class={isolated ? 'dimmed' : undefined}>
                {data.texts
                  .filter((t) => visibleLayers.has(t.layer))
                  .map((t, i) => (
                    <text
                      // Labels have no stable identity beyond their position.
                      // eslint-disable-next-line react/no-array-index-key
                      key={i}
                      transform={`matrix(${t.matrix.join(' ')})`}
                      font-size={t.size}
                      text-anchor={t.anchor}
                      dominant-baseline="hanging"
                      fill={LAYER_INFO[t.layer].css}
                      stroke="none"
                      style={{ userSelect: 'none' }}
                    >
                      {t.text}
                    </text>
                  ))}
              </g>

              {isolated &&
                data.parts
                  .filter((p) => p.name === isolated)
                  .map((p) => (
                    <g key={p.name}>
                      <rect
                        class="part-outline"
                        x={p.bbox.x}
                        y={p.bbox.y}
                        width={p.bbox.width}
                        height={p.bbox.height}
                      />
                    </g>
                  ))}

              <g class="hit">
                {data.parts.map((p) => (
                  <rect
                    key={p.name}
                    data-part={p.name}
                    x={p.bbox.x}
                    y={p.bbox.y}
                    width={p.bbox.width}
                    height={p.bbox.height}
                    onPointerEnter={() =>
                      setHover({
                        part: p,
                        cx: view.x + (p.bbox.x + p.bbox.width / 2) * view.scale,
                        cy: view.y + p.bbox.y * view.scale,
                      })
                    }
                    onPointerLeave={() => setHover(null)}
                  />
                ))}
              </g>
            </>
          )}
        </g>
      </svg>

      {hover && (
        <div class="hover-tip" style={{ left: `${hover.cx}px`, top: `${hover.cy}px` }}>
          {hover.part.name || 'Part'} — {hover.part.bbox.width.toFixed(1)} ×{' '}
          {hover.part.bbox.height.toFixed(1)} mm
        </div>
      )}

      {error && (
        <div class="overlay-msg">
          <div class="card">
            <h3>Cannot build this box</h3>
            <code>{error}</code>
          </div>
        </div>
      )}
    </div>
  );
}

function GridDefs() {
  return (
    <defs>
      <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
        <path
          d="M 10 0 L 0 0 0 10"
          fill="none"
          stroke="var(--grid)"
          stroke-width="0.5"
          vector-effect="non-scaling-stroke"
        />
      </pattern>
    </defs>
  );
}
