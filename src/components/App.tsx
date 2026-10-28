/**
 * The generator page.
 *
 * There is no Generate button and no round trip: parameters feed the worker,
 * the worker feeds the preview, and the same worker produces the download when
 * asked. Exporting therefore cannot disagree with what is on screen.
 */
import { Fragment } from 'preact';
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { LAYERS, LAYER_INFO, type Layer } from '../lib/geom/colors';
import {
  GROUPS_OPEN_BY_DEFAULT,
  GROUP_LABELS,
  defaultValues,
  visibleParams,
  type ParamGroup,
  type ParamSpec,
  type ParamValue,
  type ParamValues,
} from '../lib/params/schema';
import { paramsFor } from '../lib/generators/registry';
import { matchesQuery } from '../lib/params/search';
import { RenderClient, type Optimising } from '../lib/render-client';
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
import type { NestResult } from '../lib/layout/nest';
import { sheetsPerPanel, type LayoutSuggestion } from '../lib/layout/pack';
import type { PreviewData } from '../lib/preview';
import { Chart } from './Chart';
import { Control } from './controls';
import { Preview } from './Preview';
import { SheetBar, type Optimiser } from './SheetBar';

interface Props {
  generator: string;
  name: string;
  summary: string;
  /** What the design is for and how it goes together, under the summary. */
  description?: string;
  /** Server-rendered preview, inlined so the page is useful before hydration. */
  initial?: PreviewData;
}

export default function App({ generator, name, summary, description, initial }: Props) {
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
  const [layoutHint, setLayoutHint] = useState<LayoutSuggestion | null>(null);
  // An optimised layout lasts until it is dropped; it applies only while the
  // settings it was made for are back, so undoing a change brings it back too.
  const [nested, setNested] = useState<NestResult | null>(null);
  const [optimising, setOptimising] = useState<Optimiser['running']>(null);
  const search = useRef<Optimising | null>(null);
  const [query, setQuery] = useState('');
  const [onlyChanged, setOnlyChanged] = useState(false);
  // Which groups you have opened or closed, so that a search, which opens
  // everything it finds, can hand the panel back as you left it.
  const [openState, setOpenState] = useState<Record<string, boolean>>({});

  const client = useRef<RenderClient>();

  // Undo history. The URL is replaced rather than pushed on every change, so
  // the browser's back button cannot step through edits; this does. A drag
  // or a run of keystrokes is one step: a state is recorded once it has
  // stood for a moment.
  const edits = useRef({
    past: [] as ParamValues[],
    future: [] as ParamValues[],
    /** The last recorded state; `values` differs from it while an edit settles. */
    committed: null as ParamValues | null,
    /** Take the next state as the starting point rather than an edit. */
    rebase: false,
  });
  const [, setHistoryTick] = useState(0);
  const valuesRef = useRef(values);
  valuesRef.current = values;

  useEffect(() => {
    const h = edits.current;
    if (h.committed === null || h.rebase || h.committed === values) {
      if (h.committed !== null) h.rebase = false;
      h.committed = values;
      return;
    }
    const timer = setTimeout(() => {
      h.past.push(h.committed!);
      h.future = [];
      h.committed = values;
      setHistoryTick((t) => t + 1);
    }, 400);
    return () => clearTimeout(timer);
  }, [values]);

  const travel = (to: ParamValues) => {
    edits.current.committed = to;
    setValues(to);
    setHistoryTick((t) => t + 1);
  };
  const undo = () => {
    const h = edits.current;
    const now = valuesRef.current;
    // An edit still settling is undone back to where it started.
    if (now !== h.committed) {
      h.future = [now];
      travel(h.committed!);
    } else if (h.past.length > 0) {
      h.future.unshift(now);
      travel(h.past.pop()!);
    }
  };
  const redo = () => {
    const h = edits.current;
    if (valuesRef.current !== h.committed || h.future.length === 0) return;
    h.past.push(valuesRef.current);
    travel(h.future.shift()!);
  };
  const canUndo = edits.current.past.length > 0 || (edits.current.committed !== null && values !== edits.current.committed);
  const canRedo = edits.current.future.length > 0 && values === edits.current.committed;

  const undoRef = useRef({ undo, redo });
  undoRef.current = { undo, redo };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z' && e.key.toLowerCase() !== 'y') return;
      // Text fields keep their own undo for what is being typed.
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'TEXTAREA' || (t.tagName === 'INPUT' && /^(text|search)$/.test((t as HTMLInputElement).type)))) return;
      e.preventDefault();
      if (e.key.toLowerCase() === 'y' || e.shiftKey) undoRef.current.redo();
      else undoRef.current.undo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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
    if (m) {
      setValues((prev) => ({ ...prev, thickness: m.thickness, burn: m.kerf }));
      // Arriving is not an edit: undo should not take the preset back off.
      edits.current.rebase = true;
    }
  }, []);

  // Every parameter change re-renders. The client coalesces, so this is safe
  // to fire on every keystroke and every pixel of slider drag.
  useEffect(() => {
    client.current?.requestPreview({ generator, values, nest: nested });
  }, [generator, values, nested]);

  // A search started before a change is searching for the old settings.
  useEffect(() => () => search.current?.stop(), [generator, values]);

  const startOptimise = () => {
    if (!client.current || search.current) return;
    setOptimising({ elapsedMs: 0, best: null });
    const seconds = Number(values['optimise_seconds'] ?? 10);
    const run = client.current.optimise({ generator, values, budgetMs: seconds * 1000 }, (best, elapsedMs) => {
      setNested(best);
      setOptimising({ elapsedMs, best });
    });
    search.current = run;
    // The elapsed time moves on between better layouts too.
    const began = Date.now();
    const tick = setInterval(() => setOptimising((r) => r && { ...r, elapsedMs: Date.now() - began }), 200);
    run.done
      .then((best) => best && setNested(best))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => {
        clearInterval(tick);
        search.current = null;
        setOptimising(null);
      });
  };

  // The layout search packs the design many times over, so it waits for the
  // parameters to settle; asked on every change, previews would queue behind it.
  useEffect(() => {
    setLayoutHint(null);
    if (values['pack'] !== true) return;
    let live = true;
    const timer = setTimeout(() => {
      client.current
        ?.requestLayout({ generator, values })
        .then((hint) => live && setLayoutHint(hint))
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

  // What arriving fresh with this preset would give. The preset sets thickness
  // and kerf, so choosing one is not a change from it; typing over it is.
  const baseline = useMemo(() => {
    const d = defaultValues(specs);
    if (material && 'thickness' in d) d['thickness'] = material.thickness;
    if (material && 'burn' in d) d['burn'] = material.kerf;
    return d;
  }, [specs, material?.thickness, material?.kerf]);
  const isChanged = (s: ParamSpec) => (values[s.key] ?? s.default) !== baseline[s.key];
  const resetKeys = (keys: string[]) =>
    setValues((prev) => ({ ...prev, ...Object.fromEntries(keys.map((k) => [k, baseline[k]!])) }));

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
        nest: nested,
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
  const filtering = query.trim() !== '' || onlyChanged;
  const listed = visible.filter(
    (s) => matchesQuery(s, query, GROUP_LABELS[s.group]) && (!onlyChanged || isChanged(s)),
  );
  // The preset is not a parameter, so it is matched on what it is called.
  const presetListed =
    !onlyChanged && matchesQuery({ ...PRESET_SPEC, help: PRESET_HELP }, query, GROUP_LABELS.material);
  const grouped = groupSpecs(listed, presetListed ? ['material'] : []);
  const anyChanged = visible.some(isChanged);
  const shown = useMemo(() => new Set(visible.map((s) => s.key)), [visible]);
  const warningFor = (key: string) => data?.warnings.find((w) => w.param === key)?.message;
  // A warning on a hidden field would otherwise go unseen.
  const generalWarnings = data?.warnings.filter((w) => !w.param || !shown.has(w.param)) ?? [];
  const warned = (items: ParamSpec[]) => items.some((s) => warningFor(s.key));

  const layerChips = LAYERS.filter((l) => data?.layers[l] || l === 'annotate');
  // Downloads carry only the layers shown, so a layer hidden to tidy the view
  // is missing from the file too; say so where the file is made.
  const leftOut = layerChips.filter((l) => !visibleLayers.has(l)).map((l) => LAYER_INFO[l].name);

  const control = (spec: ParamSpec) => {
    const field = (
      <Control
        key={spec.key}
        spec={spec}
        value={values[spec.key] ?? spec.default}
        onChange={(v) => setValue(spec.key, v)}
        warning={warningFor(spec.key)}
        reset={isChanged(spec) ? { to: baseline[spec.key]!, apply: () => resetKeys([spec.key]) } : undefined}
      />
    );
    // A generator's diagram sits under the setting it illustrates.
    const charts = data?.charts?.filter((c) => c.param === spec.key) ?? [];
    if (!charts.length) return field;
    return (
      <Fragment key={spec.key}>
        {field}
        {charts.map((c) => <Chart key={c.title} chart={c} />)}
      </Fragment>
    );
  };

  // While searching, every group with a match is open; what you open or close
  // is only remembered while you are not.
  const isOpen = (id: string, byDefault: boolean) => filtering || (openState[id] ?? byDefault);
  const remember = (id: string) => (e: Event) => {
    if (filtering) return;
    const open = (e.currentTarget as HTMLDetailsElement).open;
    setOpenState((prev) => (prev[id] === open ? prev : { ...prev, [id]: open }));
  };
  // Closing a group mid-search would hide a match the search just showed.
  const holdOpen = (e: Event) => filtering && e.preventDefault();

  const changedCount = (items: ParamSpec[]) => {
    const n = items.filter(isChanged).length;
    return n > 0 && !onlyChanged ? <span class="count-badge">{n} changed</span> : null;
  };
  const resetThese = (items: ParamSpec[]) => {
    const keys = items.filter(isChanged).map((s) => s.key);
    return keys.length > 1 ? (
      <button type="button" class="link-btn group-reset" onClick={() => resetKeys(keys)}>
        Reset these {keys.length}
      </button>
    ) : null;
  };

  return (
    <div class="app">
      <div class="panel">
        <div class="panel-head">
          <h2>{name}</h2>
          <p>{summary}</p>
          {description && <p class="panel-desc">{description}</p>}
        </div>

        <div class="panel-search">
          <input
            type="search"
            value={query}
            placeholder="Find a setting"
            aria-label="Find a setting"
            autocomplete="off"
            spellcheck={false}
            onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
            onKeyDown={(e) => e.key === 'Escape' && setQuery('')}
          />
          <button
            type="button"
            class="btn"
            aria-pressed={onlyChanged}
            disabled={!anyChanged && !onlyChanged}
            title="Show only the settings you have changed"
            onClick={() => setOnlyChanged((c) => !c)}
          >
            Changed
          </button>
          {anyChanged && (
            <button
              type="button"
              class="link-btn"
              title="Put every setting shown back to its default"
              onClick={() => resetKeys(visible.filter(isChanged).map((s) => s.key))}
            >
              Reset all
            </button>
          )}
        </div>

        {grouped.length === 0 && (
          <p class="panel-empty">
            {onlyChanged && !query.trim()
              ? 'Nothing is changed from the defaults.'
              : `No settings match “${query.trim()}”${onlyChanged ? ' among those changed' : ''}.`}
          </p>
        )}

        {grouped.map(({ group, items, sections }) => (
          <details
            class="group"
            key={group}
            open={isOpen(group, GROUPS_OPEN_BY_DEFAULT.includes(group))}
            onToggle={remember(group)}
          >
            <summary onClick={holdOpen}>
              {GROUP_LABELS[group]}
              {changedCount([...items, ...sections.flatMap((x) => x.items)])}
              {warned([...items, ...sections.flatMap((x) => x.items)]) && <WarnMark />}
            </summary>
            <div class="group-body">
              {resetThese([...items, ...sections.flatMap((x) => x.items)])}
              {group === 'material' && material && presetListed && (
                <div class="field">
                  <div class="field-label">
                    <label for="material">Preset</label>
                  </div>
                  <select
                    id="material"
                    value={material.id}
                    autocomplete="off"
                    onChange={(e) => applyMaterial((e.target as HTMLSelectElement).value)}
                  >
                    {materials.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                  <p class="field-help">{PRESET_HELP}</p>
                </div>
              )}
              {items.map(control)}
              {sections.map(({ section, items: sectionItems }) => (
                <details
                  class="subgroup"
                  key={section}
                  open={isOpen(`${group}:${section}`, false)}
                  onToggle={remember(`${group}:${section}`)}
                >
                  <summary onClick={holdOpen}>
                    {section}
                    {changedCount(sectionItems)}
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
            {layerChips.map((l) => {
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

          <span class="undo-redo">
            <button type="button" class="icon-btn" title="Undo (⌘Z / Ctrl+Z)" aria-label="Undo" disabled={!canUndo} onClick={undo}>
              ↶
            </button>
            <button type="button" class="icon-btn" title="Redo (⇧⌘Z / Ctrl+Y)" aria-label="Redo" disabled={!canRedo} onClick={redo}>
              ↷
            </button>
          </span>
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
          {leftOut.length > 0 && (
            <span class="export-note" title="Downloads contain only the layers shown. Turn a layer back on to include it.">
              Leaves out {leftOut.join(', ')}
            </span>
          )}
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

        {packed && (
          <SheetBar
            specs={specs}
            values={values}
            setValue={setValue}
            hint={layoutHint}
            applyHint={(h) =>
              setValues((prev) => ({
                ...prev,
                sheet_width: h.sheetWidth,
                sheet_height: h.sheetHeight,
                pack_copies: h.copies,
              }))
            }
            optimiser={{
              running: optimising,
              result: nested,
              applied: data?.optimised === true,
              start: startOptimise,
              stop: () => search.current?.stop(),
              discard: () => setNested(null),
            }}
          />
        )}

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
          <Stat k="Sheet" v={data ? sheetSummary(data, values) : '—'} />
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

function sheetSummary(data: PreviewData, values: ParamValues): string {
  const s = data.sheets?.[0];
  if (!data.sheets || !s) return `${data.bbox.width.toFixed(0)} × ${data.bbox.height.toFixed(0)} mm`;
  const used = data.sheets.reduce((t, x) => t + x.used, 0) / data.sheets.length;
  const sheets = `${data.sheets.length} × ${mm(s.width)} × ${mm(s.height)} mm`;
  const per =
    values['use_panels'] === true
      ? sheetsPerPanel(s.width, s.height, { width: Number(values['panel_width']), height: Number(values['panel_height']) })
      : 0;
  const count = per > 0 ? Math.ceil(data.sheets.length / per) : 0;
  const panels = per > 0 ? ` · ${count} panel${count === 1 ? '' : 's'} (${per} sheets each)` : '';
  return `${sheets}${panels} · ${Math.round(used * 100)}% used`;
}

/** Sheet sides from a panel division can be fractional (1200 / 7); a tenth is enough. */
function mm(n: number): string {
  return String(Math.round(n * 10) / 10);
}

/** LightBurn's name for a layer: C00–C29 cut layers, T1 and T2 tool layers from index 30. */
function lightburnName(index: number, isTool: boolean): string {
  return isTool ? `T${index - 29}` : `C${String(index).padStart(2, '0')}`;
}

const PRESET_HELP =
  'Sets thickness and kerf below, and fills in the speed and power of every layer in the exported LightBurn file.';
/** The preset dressed as a parameter, so search finds it like any other. */
const PRESET_SPEC: ParamSpec = { key: 'preset', kind: 'text', label: 'Preset', default: '', group: 'material' };

const GROUP_ORDER: ParamGroup[] = ['dimensions', 'material', 'joints', 'top', 'advanced'];

interface Grouped {
  group: ParamGroup;
  /** The group's own fields: the decisions, shown first. */
  items: ParamSpec[];
  /** Tuning for one kind of joint each, collapsed, in first-seen order. */
  sections: { section: string; items: ParamSpec[] }[];
}

/** `always` are groups shown even with no parameters, for fields that are not one. */
function groupSpecs(specs: ParamSpec[], always: ParamGroup[] = []): Grouped[] {
  const map = new Map<ParamGroup, Grouped>();
  for (const g of always) map.set(g, { group: g, items: [], sections: [] });
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
