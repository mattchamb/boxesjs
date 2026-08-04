/**
 * Parameter controls.
 *
 * boxes.py renders every parameter as the same bare text input, so choosing a
 * joint style and typing a width feel identical and "50*3" is something you
 * have to know. Each control here is picked from the parameter's declared kind,
 * which is what makes the panel readable.
 */
import { useEffect, useState } from 'preact/hooks';
import { EDGE_INFO, type ParamSpec, type ParamValue } from '../lib/params/schema';
import { formatSections, parseSections } from '../lib/params/sections';

interface ControlProps {
  spec: ParamSpec;
  value: ParamValue;
  onChange: (v: ParamValue) => void;
  warning?: string;
}

export function Control({ spec, value, onChange, warning }: ControlProps) {
  return (
    <div class="field">
      {spec.kind !== 'bool' && (
        <div class="field-label">
          <label for={`p-${spec.key}`}>{spec.label}</label>
          {'unit' in spec && spec.unit && <span class="unit">{spec.unit}</span>}
        </div>
      )}

      {spec.kind === 'length' || spec.kind === 'number' ? (
        <NumberSlider spec={spec} value={Number(value)} onChange={onChange} />
      ) : spec.kind === 'bool' ? (
        <Switch spec={spec} value={Boolean(value)} onChange={onChange} />
      ) : spec.kind === 'sections' ? (
        <SectionEditor value={String(value)} onChange={onChange} itemLabel={spec.itemLabel} />
      ) : spec.kind === 'edge' ? (
        <EdgePicker choices={spec.choices} value={String(value)} onChange={onChange} />
      ) : spec.kind === 'enum' ? (
        <EnumControl spec={spec} value={String(value)} onChange={onChange} />
      ) : (
        <TextControl spec={spec} value={String(value)} onChange={onChange} />
      )}

      {spec.help && <p class="field-help">{spec.help}</p>}
      {warning && <p class="field-warning">{warning}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ number */

function NumberSlider({
  spec,
  value,
  onChange,
}: {
  spec: Extract<ParamSpec, { kind: 'length' | 'number' }>;
  value: number;
  onChange: (v: ParamValue) => void;
}) {
  // The text box holds its own string so a partially typed number
  // (like "1." or "-") is not rewritten under the cursor.
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);

  const step = spec.step ?? 1;
  const commit = (raw: string) => {
    setText(raw);
    const n = Number(raw);
    if (raw.trim() !== '' && Number.isFinite(n)) onChange(clamp(n, spec.min, spec.max));
  };

  return (
    <div class="slider-row">
      <input
        type="range"
        min={spec.min}
        max={spec.max}
        step={step}
        value={value}
        aria-label={spec.label}
        onInput={(e) => onChange(Number((e.target as HTMLInputElement).value))}
      />
      <input
        id={`p-${spec.key}`}
        type="number"
        min={spec.min}
        max={spec.max}
        step={step}
        value={text}
        onInput={(e) => commit((e.target as HTMLInputElement).value)}
        onBlur={() => setText(String(value))}
      />
    </div>
  );
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/* ------------------------------------------------------------------- bool */

function Switch({
  spec,
  value,
  onChange,
}: {
  spec: ParamSpec;
  value: boolean;
  onChange: (v: ParamValue) => void;
}) {
  return (
    <label class="switch">
      <input
        id={`p-${spec.key}`}
        type="checkbox"
        checked={value}
        onChange={(e) => onChange((e.target as HTMLInputElement).checked)}
      />
      <span class="track" />
      <span>{spec.label}</span>
    </label>
  );
}

/* -------------------------------------------------------------- sections */

/**
 * Compartment editor.
 *
 * The underlying value is boxes.py's section string ("50*3", "120/3"). Editing
 * it as a list of sizes removes the need to know that syntax, while the text
 * field underneath keeps it available for anyone who does.
 */
function SectionEditor({
  value,
  onChange,
  itemLabel = 'section',
}: {
  value: string;
  onChange: (v: ParamValue) => void;
  itemLabel?: string;
}) {
  const [raw, setRaw] = useState(value);
  useEffect(() => setRaw(value), [value]);

  let sizes: number[] = [];
  let parseError: string | null = null;
  try {
    sizes = parseSections(raw);
  } catch (e) {
    parseError = e instanceof Error ? e.message : 'Cannot read that';
  }

  const push = (next: number[]) => {
    const s = formatSections(next);
    setRaw(s);
    onChange(s);
  };

  const setAt = (i: number, n: number) => {
    const next = [...sizes];
    next[i] = n;
    push(next);
  };

  const total = sizes.reduce((a, b) => a + b, 0);

  return (
    <div class="sections">
      {sizes.map((s, i) => (
        // Position is the identity here: sections have no other key.
        // eslint-disable-next-line react/no-array-index-key
        <div class="section-row" key={i}>
          <span class="idx">{i + 1}</span>
          <input
            type="number"
            min={1}
            step={1}
            value={s}
            aria-label={`${itemLabel} ${i + 1} size in mm`}
            onInput={(e) => {
              const n = Number((e.target as HTMLInputElement).value);
              if (Number.isFinite(n) && n > 0) setAt(i, n);
            }}
          />
          <button
            type="button"
            class="icon-btn"
            aria-label={`Remove ${itemLabel} ${i + 1}`}
            disabled={sizes.length <= 1}
            onClick={() => push(sizes.filter((_, j) => j !== i))}
          >
            ×
          </button>
        </div>
      ))}

      <div class="section-actions">
        <button
          type="button"
          class="btn"
          onClick={() => push([...sizes, sizes[sizes.length - 1] ?? 50])}
        >
          + Add {itemLabel}
        </button>
        <button
          type="button"
          class="btn"
          title="Give every compartment the same size, keeping the total"
          disabled={sizes.length < 2}
          onClick={() => push(sizes.map(() => Math.round((total / sizes.length) * 100) / 100))}
        >
          Equalise
        </button>
      </div>

      <input
        type="text"
        value={raw}
        aria-label="Section sizes as text"
        spellcheck={false}
        onInput={(e) => {
          const v = (e.target as HTMLInputElement).value;
          setRaw(v);
          try {
            parseSections(v);
            onChange(v);
          } catch {
            /* keep typing; the row above shows the problem */
          }
        }}
      />
      {parseError ? (
        <p class="field-warning">{parseError}</p>
      ) : (
        <p class="field-help">
          {sizes.length} × {itemLabel}, {Math.round(total * 10) / 10} mm total
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ edges */

/**
 * Edge profiles drawn to scale-ish, so the choice is visual rather than a
 * matter of remembering that "F" and "f" are two halves of the same joint.
 */
const EDGE_GLYPHS: Record<string, string> = {
  e: 'M2 14 H46',
  E: 'M2 10 H46',
  f: 'M2 14 H12 V6 H22 V14 H26 V6 H36 V14 H46',
  F: 'M2 14 H12 V22 H22 V14 H26 V22 H36 V14 H46',
  h: 'M2 14 H46 M10 9 h8 v-4 h-8 z M30 9 h8 v-4 h-8 z',
  s: 'M2 18 h6 a4 4 0 0 1 4 -4 h24 a4 4 0 0 1 4 4 h6 M10 9 h8 v-4 h-8 z M30 9 h8 v-4 h-8 z',
  S: 'M2 10 h6 a4 4 0 0 0 4 4 h24 a4 4 0 0 0 4 -4 h6',
  š: 'M2 18 h6 a4 4 0 0 1 4 -4 h24 a4 4 0 0 1 4 4 h6',
  Š: 'M2 10 h6 a4 4 0 0 0 4 4 h24 a4 4 0 0 0 4 -4 h6 M10 20 h8 v-4 h-8 z',
  g: 'M2 14 q4 -8 8 0 q4 -8 8 0 q4 -8 8 0 q4 -8 8 0 q4 -8 8 0',
  t: 'M2 14 H14 L24 3 L34 14 H46 M24 9 a2 2 0 1 0 0.1 0',
  T: 'M2 14 H14 L24 3 L34 14 H46 M8 14 v4 M40 14 v4',
  G: 'M2 14 H46 M14 10 a3 3 0 1 0 0.1 0 M14 10 v-5 M34 10 a3 3 0 1 0 0.1 0 M34 10 v-5',
};

function EdgePicker({
  choices,
  value,
  onChange,
}: {
  choices: string;
  value: string;
  onChange: (v: ParamValue) => void;
}) {
  return (
    <div class="edge-picker" role="group">
      {Array.from(choices).map((c) => {
        const info = EDGE_INFO[c];
        return (
          <button
            key={c}
            type="button"
            class="edge-option"
            aria-pressed={value === c}
            title={info?.description ?? c}
            onClick={() => onChange(c)}
          >
            <svg viewBox="0 0 48 26" width="48" height="26" aria-hidden="true">
              <path d={EDGE_GLYPHS[c] ?? 'M2 14 H46'} />
            </svg>
            <span class="name">{info?.name ?? c}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------- enum */

function EnumControl({
  spec,
  value,
  onChange,
}: {
  spec: Extract<ParamSpec, { kind: 'enum' }>;
  value: string;
  onChange: (v: ParamValue) => void;
}) {
  // Short lists read better as segments; long ones need a select.
  if (spec.choices.length <= 3 && spec.choices.every((c) => c.label.length <= 12)) {
    return (
      <div class="segmented" role="group" aria-label={spec.label}>
        {spec.choices.map((c) => (
          <button
            key={c.value}
            type="button"
            aria-pressed={value === c.value}
            onClick={() => onChange(c.value)}
          >
            {c.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <select
      id={`p-${spec.key}`}
      value={value}
      onChange={(e) => onChange((e.target as HTMLSelectElement).value)}
    >
      {spec.choices.map((c) => (
        <option key={c.value} value={c.value}>
          {c.label}
        </option>
      ))}
    </select>
  );
}

/* ------------------------------------------------------------------- text */

function TextControl({
  spec,
  value,
  onChange,
}: {
  spec: Extract<ParamSpec, { kind: 'text' }>;
  value: string;
  onChange: (v: ParamValue) => void;
}) {
  if (spec.multiline) {
    return (
      <textarea
        id={`p-${spec.key}`}
        value={value}
        placeholder={spec.placeholder}
        spellcheck={false}
        onInput={(e) => onChange((e.target as HTMLTextAreaElement).value)}
      />
    );
  }
  return (
    <input
      id={`p-${spec.key}`}
      type="text"
      value={value}
      placeholder={spec.placeholder}
      onInput={(e) => onChange((e.target as HTMLInputElement).value)}
    />
  );
}
