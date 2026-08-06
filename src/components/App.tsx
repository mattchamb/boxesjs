/**
 * The generator page.
 *
 * There is no Generate button and no round trip: parameters feed the worker,
 * the worker feeds the preview, and the same worker produces the download when
 * asked. Exporting therefore cannot disagree with what is on screen.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { LAYERS, LAYER_INFO, type Layer } from '../lib/geom/colors';
import { GROUPS_OPEN_BY_DEFAULT, GROUP_LABELS, type ParamGroup, type ParamSpec, type ParamValue, type ParamValues } from '../lib/params/schema';
import { paramsFor } from '../lib/generators/registry';
import { RenderClient } from '../lib/render-client';
import { decodeParams, encodeParams, permalinkFor, pinnedKeys } from '../lib/permalink';
import {
  findMaterial,
  formatDuration,
  estimateSeconds,
  getSelectedMaterialId,
  loadMaterials,
  setSelectedMaterialId,
  type Material,
} from '../lib/materials';
import type { PreviewData } from '../lib/preview';
import { Control } from './controls';
import { Preview } from './Preview';

interface Props {
  generator: string;
  name: string;
  summary: string;
  /** Server-rendered preview, inlined so the page is useful before hydration. */
  initial?: PreviewData;
}

export default function App({ generator, name, summary, initial }: Props) {
  const specs = useMemo(() => paramsFor(generator), [generator]);

  const [values, setValues] = useState<ParamValues>(() =>
    decodeParams(generator, typeof location !== 'undefined' ? location.hash : ''),
  );
  const [data, setData] = useState<PreviewData | null>(initial ?? null);
  const [error, setError] = useState<string | null>(null);
  const [visibleLayers, setVisibleLayers] = useState<Set<Layer>>(() => new Set(LAYERS));
  const [showGrid, setShowGrid] = useState(false);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [materialId, setMaterialId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const client = useRef<RenderClient>();

  useEffect(() => {
    const c = new RenderClient();
    c.onPreview((res) => {
      if (res.ok) {
        setData(res.data);
        setError(null);
      } else {
        // Keep the last good drawing on screen; an error should not blank the
        // canvas when you are midway through typing a number.
        setError(res.error);
      }
    });
    client.current = c;
    return () => c.dispose();
  }, []);

  useEffect(() => {
    const all = loadMaterials();
    setMaterials(all);
    const saved = getSelectedMaterialId();
    const id = saved && all.some((m) => m.id === saved) ? saved : (all[0]?.id ?? null);
    setMaterialId(id);

    // The preset drives the geometry, so the one selected on arrival has to
    // reach the parameters too — otherwise the panel would show a preset whose
    // thickness the model is not using. A permalink that names thickness or
    // kerf outright still wins: that was a deliberate choice by whoever shared
    // it, not a value waiting to be filled in.
    const m = all.find((x) => x.id === id);
    if (!m) return;
    const pinned = pinnedKeys(typeof location !== 'undefined' ? location.hash : '');
    setValues((prev) => ({
      ...prev,
      ...(pinned.has('thickness') ? {} : { thickness: m.thickness }),
      ...(pinned.has('burn') ? {} : { burn: m.kerf }),
    }));
  }, []);

  // Every parameter change re-renders. The client coalesces, so this is safe
  // to fire on every keystroke and every pixel of slider drag.
  useEffect(() => {
    client.current?.requestPreview({ generator, values });
  }, [generator, values]);

  // Keep the URL in step without flooding history.
  useEffect(() => {
    const q = encodeParams(generator, values);
    const url = `${location.pathname}${q ? `#${q}` : ''}`;
    history.replaceState(null, '', url);
  }, [generator, values]);

  const setValue = useCallback((key: string, v: ParamValue) => {
    setValues((prev) => (prev[key] === v ? prev : { ...prev, [key]: v }));
  }, []);

  const material = findMaterial(materialId) ?? materials[0];

  /** Selecting a material is the single setup step: it drives the geometry. */
  const applyMaterial = (id: string) => {
    const m = findMaterial(id);
    setMaterialId(id);
    setSelectedMaterialId(id);
    if (m) setValues((prev) => ({ ...prev, thickness: m.thickness, burn: m.kerf }));
  };

  const download = async (format: 'svg' | 'lbrn2') => {
    if (!client.current || !material) return;
    setBusy(true);
    try {
      const result = await client.current.requestExport({
        generator,
        values,
        format,
        material,
        layers: LAYERS.filter((l) => visibleLayers.has(l)),
        permalink: permalinkFor(generator, values),
        title: name,
      });
      const blob = new Blob([result.text], { type: result.mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(permalinkFor(generator, values));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable; the URL bar already has the link */
    }
  };

  const grouped = useMemo(() => groupSpecs(specs), [specs]);
  const warningFor = (key: string) => data?.warnings.find((w) => w.param === key)?.message;
  const generalWarnings = data?.warnings.filter((w) => !w.param) ?? [];

  return (
    <div class="app">
      <div class="panel">
        <div class="panel-head">
          <h2>{name}</h2>
          <p>{summary}</p>
        </div>

        {grouped.map(({ group, items }) => (
          <details class="group" key={group} open={GROUPS_OPEN_BY_DEFAULT.includes(group)}>
            <summary>{GROUP_LABELS[group]}</summary>
            <div class="group-body">
              {group === 'material' && material && (
                <div class="field">
                  <div class="field-label">
                    <label for="material">Preset</label>
                  </div>
                  <select
                    id="material"
                    value={material.id}
                    onChange={(e) => applyMaterial((e.target as HTMLSelectElement).value)}
                  >
                    {materials.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                  <p class="field-help">
                    Sets thickness and kerf below, and fills in the speed and power of every
                    layer in the exported LightBurn file.
                  </p>
                </div>
              )}
              {items.map((spec) => (
                <Control
                  key={spec.key}
                  spec={spec}
                  value={values[spec.key] ?? spec.default}
                  onChange={(v) => setValue(spec.key, v)}
                  warning={warningFor(spec.key)}
                />
              ))}
            </div>
          </details>
        ))}
      </div>

      <div class="stage">
        <div class="toolbar">
          <div class="layer-toggles">
            {LAYERS.filter((l) => data?.layers[l] || l === 'annotate').map((l) => {
              const info = LAYER_INFO[l];
              const on = visibleLayers.has(l);
              return (
                <button
                  key={l}
                  type="button"
                  class="layer-chip"
                  aria-pressed={on}
                  title={`${info.description} — LightBurn ${info.isTool ? 'T1' : `C${String(info.lightburnIndex).padStart(2, '0')}`}`}
                  onClick={() =>
                    setVisibleLayers((prev) => {
                      const next = new Set(prev);
                      if (next.has(l)) next.delete(l);
                      else next.add(l);
                      return next;
                    })
                  }
                >
                  <span class="dot" style={{ background: info.css }} />
                  {info.name}
                  <span class="idx">
                    {info.isTool ? 'T1' : `C${String(info.lightburnIndex).padStart(2, '0')}`}
                  </span>
                </button>
              );
            })}
          </div>

          <div class="spacer" />

          <button type="button" class="btn" aria-pressed={showGrid} onClick={() => setShowGrid((g) => !g)}>
            Grid
          </button>
          <button type="button" class="btn" onClick={copyLink}>
            {copied ? 'Copied' : 'Copy link'}
          </button>
          <button type="button" class="btn" disabled={busy} onClick={() => download('svg')}>
            SVG
          </button>
          <button
            type="button"
            class="btn btn-primary"
            disabled={busy || !material}
            onClick={() => download('lbrn2')}
          >
            Download .lbrn2
          </button>
        </div>

        <Preview data={data} error={error} visibleLayers={visibleLayers} showGrid={showGrid} />

        {generalWarnings.length > 0 && (
          <div class="warnbar">
            <ul>
              {generalWarnings.map((w) => (
                <li key={w.message}>{w.message}</li>
              ))}
            </ul>
          </div>
        )}

        <div class="statsbar">
          <Stat k="Sheet" v={data ? `${data.bbox.width.toFixed(0)} × ${data.bbox.height.toFixed(0)} mm` : '—'} />
          <Stat k="Parts" v={data ? String(data.stats.partCount) : '—'} />
          <Stat k="Cut length" v={data ? `${(data.stats.cutLengthMm / 1000).toFixed(2)} m` : '—'} />
          <Stat
            k="Est. time"
            v={data && material ? formatDuration(estimateSeconds(data.stats.lengthByLayer, material)) : '—'}
          />
          <div class="spacer" />
          <span class="stat">
            <span class="k">scroll to zoom · drag to pan · F to fit · click a part to isolate</span>
          </span>
        </div>
      </div>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <span class="stat">
      <span class="k">{k}</span>
      <span class="v">{v}</span>
    </span>
  );
}

const GROUP_ORDER: ParamGroup[] = ['dimensions', 'material', 'joints', 'top', 'advanced'];

function groupSpecs(specs: ParamSpec[]): { group: ParamGroup; items: ParamSpec[] }[] {
  const map = new Map<ParamGroup, ParamSpec[]>();
  for (const s of specs) {
    const list = map.get(s.group) ?? [];
    list.push(s);
    map.set(s.group, list);
  }
  return GROUP_ORDER.filter((g) => map.has(g)).map((g) => ({ group: g, items: map.get(g)! }));
}
