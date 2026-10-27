/**
 * The generator page.
 *
 * There is no Generate button and no round trip: parameters feed the worker,
 * the worker feeds the preview, and the same worker produces the download when
 * asked. Exporting therefore cannot disagree with what is on screen.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { LAYERS, LAYER_INFO, type Layer } from '../lib/geom/colors';
import {
  GROUPS_OPEN_BY_DEFAULT,
  GROUP_LABELS,
  visibleParams,
  type ParamGroup,
  type ParamSpec,
  type ParamValue,
  type ParamValues,
} from '../lib/params/schema';
import { paramsFor } from '../lib/generators/registry';
import { RenderClient } from '../lib/render-client';
import { decodeParams, encodeParams, permalinkFor } from '../lib/permalink';
import {
  findMaterial,
  formatDuration,
  estimateSeconds,
  getSelectedMaterialId,
  loadMaterials,
  setSelectedMaterialId,
  type Material,
} from '../lib/materials';
import type { CopiesSuggestion } from '../lib/layout/pack';
import type { PreviewData } from '../lib/preview';
import { Control } from './controls';
import { Preview } from './Preview';
import { SheetBar } from './SheetBar';

interface Props {
  generator: string;
  name: string;
  summary: string;
  /** Server-rendered preview, inlined so the page is useful before hydration. */
  initial?: PreviewData;
}

export default function App({ generator, name, summary, initial }: Props) {
  const specs = useMemo(() => paramsFor(generator), [generator]);

  // The server renders the defaults, and hydration keeps the server's
  // attributes rather than patching them; so start from the same defaults and
  // apply the link's values as an ordinary update below, or a shared link shows
  // its geometry with the default choices still highlighted.
  const [values, setValues] = useState<ParamValues>(() => decodeParams(generator, ''));
  useEffect(() => {
    if (location.hash) setValues(decodeParams(generator, location.hash));
  }, [generator]);
  const [data, setData] = useState<PreviewData | null>(initial ?? null);
  const [error, setError] = useState<string | null>(null);
  const [visibleLayers, setVisibleLayers] = useState<Set<Layer>>(() => new Set(LAYERS));
  const [showGrid, setShowGrid] = useState(false);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [materialId, setMaterialId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiesHint, setCopiesHint] = useState<CopiesSuggestion | null>(null);

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
    // thickness the model is not using. It wins over whatever the hash carried:
    // the preset is the single source of truth for stock, and a thickness typed
    // by hand is one edit away from being typed again.
    const m = all.find((x) => x.id === id);
    if (m) setValues((prev) => ({ ...prev, thickness: m.thickness, burn: m.kerf }));
  }, []);

  // Every parameter change re-renders. The client coalesces, so this is safe
  // to fire on every keystroke and every pixel of slider drag.
  useEffect(() => {
    client.current?.requestPreview({ generator, values });
  }, [generator, values]);

  // The copy search packs the design up to twenty times, so it waits for the
  // parameters to settle; asked on every change, previews would queue behind it.
  useEffect(() => {
    setCopiesHint(null);
    if (values['pack'] !== true) return;
    let live = true;
    const timer = setTimeout(() => {
      client.current
        ?.requestCopies({ generator, values })
        .then((hint) => live && setCopiesHint(hint))
        .catch(() => {
          /* a failed search just means no hint; the preview reports the error */
        });
    }, 400);
    return () => {
      live = false;
      clearTimeout(timer);
    };
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

  // Only what applies to the current choices; the rest keep their values. The
  // sheet layout lives in the sheet bar above the preview, not in the panel.
  const visible = useMemo(
    () => visibleParams(specs, values).filter((s) => s.group !== 'layout'),
    [specs, values],
  );
  const packed = values['pack'] === true;
  const grouped = useMemo(() => groupSpecs(visible), [visible]);
  const shown = useMemo(() => new Set(visible.map((s) => s.key)), [visible]);
  const warningFor = (key: string) => data?.warnings.find((w) => w.param === key)?.message;
  // A warning on a hidden field would otherwise go unseen.
  const generalWarnings = data?.warnings.filter((w) => !w.param || !shown.has(w.param)) ?? [];
  const warned = (items: ParamSpec[]) => items.some((s) => warningFor(s.key));

  const control = (spec: ParamSpec) => (
    <Control
      key={spec.key}
      spec={spec}
      value={values[spec.key] ?? spec.default}
      onChange={(v) => setValue(spec.key, v)}
      warning={warningFor(spec.key)}
    />
  );

  return (
    <div class="app">
      <div class="panel">
        <div class="panel-head">
          <h2>{name}</h2>
          <p>{summary}</p>
        </div>

        {grouped.map(({ group, items, sections }) => (
          <details class="group" key={group} open={GROUPS_OPEN_BY_DEFAULT.includes(group)}>
            <summary>
              {GROUP_LABELS[group]}
              {warned([...items, ...sections.flatMap((x) => x.items)]) && <WarnMark />}
            </summary>
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
              {items.map(control)}
              {sections.map(({ section, items: sectionItems }) => (
                <details class="subgroup" key={section}>
                  <summary>
                    {section}
                    {warned(sectionItems) && <WarnMark />}
                  </summary>
                  <div class="subgroup-body">{sectionItems.map(control)}</div>
                </details>
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
                  title={`${info.description} — LightBurn ${lightburnName(info.lightburnIndex, info.isTool)}`}
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
                  <span class="idx">{lightburnName(info.lightburnIndex, info.isTool)}</span>
                </button>
              );
            })}
          </div>

          <div class="spacer" />

          <button
            type="button"
            class="btn"
            aria-pressed={packed}
            title="Rearrange the parts onto as few sheets of your stock as possible. LightBurn gets one page per sheet."
            onClick={() => setValue('pack', !packed)}
          >
            Pack onto sheets
          </button>
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

        {packed && <SheetBar specs={specs} values={values} setValue={setValue} hint={copiesHint} />}

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
          <Stat k="Sheet" v={data ? sheetSummary(data) : '—'} />
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

/** Marks a collapsed heading whose fields carry a warning. */
function WarnMark() {
  return (
    <span class="warn-mark" title="A setting in here has a warning" aria-label="has a warning">
      !
    </span>
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

function sheetSummary(data: PreviewData): string {
  const s = data.sheets?.[0];
  if (!data.sheets || !s) return `${data.bbox.width.toFixed(0)} × ${data.bbox.height.toFixed(0)} mm`;
  const used = data.sheets.reduce((t, x) => t + x.used, 0) / data.sheets.length;
  return `${data.sheets.length} × ${s.width.toFixed(0)} × ${s.height.toFixed(0)} mm · ${Math.round(used * 100)}% used`;
}

/** LightBurn's name for a layer: C00–C29 cut layers, T1 and T2 tool layers from index 30. */
function lightburnName(index: number, isTool: boolean): string {
  return isTool ? `T${index - 29}` : `C${String(index).padStart(2, '0')}`;
}

const GROUP_ORDER: ParamGroup[] = ['dimensions', 'material', 'joints', 'top', 'advanced'];

interface Grouped {
  group: ParamGroup;
  /** The group's own fields: the decisions, shown first. */
  items: ParamSpec[];
  /** Tuning for one kind of joint each, collapsed, in first-seen order. */
  sections: { section: string; items: ParamSpec[] }[];
}

function groupSpecs(specs: ParamSpec[]): Grouped[] {
  const map = new Map<ParamGroup, Grouped>();
  for (const s of specs) {
    let g = map.get(s.group);
    if (!g) map.set(s.group, (g = { group: s.group, items: [], sections: [] }));
    if (!s.section) {
      // How the piece is held together decides what the rest of the group
      // means, so it leads whatever order the generator declared.
      if (s.key === 'assembly') g.items.unshift(s);
      else g.items.push(s);
      continue;
    }
    let sec = g.sections.find((x) => x.section === s.section);
    if (!sec) g.sections.push((sec = { section: s.section, items: [] }));
    sec.items.push(s);
  }
  return GROUP_ORDER.filter((g) => map.has(g)).map((g) => map.get(g)!);
}
