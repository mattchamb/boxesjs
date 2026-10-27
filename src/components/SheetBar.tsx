/**
 * Sheet settings, between the toolbar and the preview.
 *
 * Packing changes where the parts go, not what they are, and its effect is the
 * preview right below; in the parameter panel it sat under every joint and lid
 * setting, out of sight of the sheets it lays out.
 *
 * It keeps to one line, the settings most changed, so the preview below does
 * not shrink by a third when packing is on; the rest open under "More". The
 * suggestion shares that line, in short, rather than taking one of its own:
 * it comes and goes as the settings change, and would move the preview.
 */
import type { NestResult } from '../lib/layout/nest';
import type { LayoutSuggestion } from '../lib/layout/pack';
import type { ParamSpec, ParamValue, ParamValues } from '../lib/params/schema';
import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { NumberInput } from './controls';

interface Props {
  specs: ParamSpec[];
  values: ParamValues;
  setValue: (key: string, v: ParamValue) => void;
  hint: LayoutSuggestion | null;
  applyHint: (hint: LayoutSuggestion) => void;
  optimiser: Optimiser;
}

/** The layout search, as the sheet bar shows and drives it. */
export interface Optimiser {
  /** A search under way: how long it has run, and the best layout yet. */
  running: { elapsedMs: number; best: NestResult | null } | null;
  result: NestResult | null;
  /** The preview is laid out by `result`, which still fits the settings. */
  applied: boolean;
  start: () => void;
  stop: () => void;
  discard: () => void;
}

export function SheetBar({ specs, values, setValue, hint, applyHint, optimiser }: Props) {
  const number = (key: string, label: string, unit?: string) => {
    const spec = specs.find((s) => s.key === key);
    if (!spec || (spec.kind !== 'length' && spec.kind !== 'number')) return null;
    return (
      <label class="sheet-field" title={spec.help}>
        <span class="k">{label}</span>
        <NumberInput spec={spec} value={Number(values[key] ?? spec.default)} onChange={(v) => setValue(key, v)} />
        {unit && <span class="unit">{unit}</span>}
      </label>
    );
  };

  const pair = (a: string, b: string, label: string) => (
    <span class="sheet-size">
      {number(a, label)}
      <span class="times">×</span>
      {number(b, '', 'mm')}
    </span>
  );

  const rotate = specs.find((s) => s.key === 'pack_rotate');
  const step = specs.find((s) => s.key === 'pack_angle_step');
  const usePanels = specs.find((s) => s.key === 'use_panels');
  const panels = values['use_panels'] === true;

  const [more, setMore] = useState(false);
  // A suggestion waved away stays away until there is a different one.
  const [dismissed, setDismissed] = useState<string | null>(null);
  const hintKey = hint && `${hint.sheetWidth}x${hint.sheetHeight}x${hint.copies}`;

  return (
    <div class="sheetbar">
      <div class="sheet-fields">
        {pair('sheet_width', 'sheet_height', 'Sheet')}
        {number('pack_copies', 'Copies')}
        <Optimise {...optimiser} />
        <span class="spacer" />
        {hint && hintKey !== dismissed && (
          <Hint hint={hint} values={values} panels={panels} onUse={() => applyHint(hint)} onDismiss={() => setDismissed(hintKey)} />
        )}
        <button type="button" class="btn" aria-expanded={more} onClick={() => setMore((m) => !m)}>
          {more ? 'Less' : 'More'}
        </button>
      </div>
      {more && (
        <div class="sheet-fields">
          {number('sheet_margin', 'Edge offset', 'mm')}
          {number('pack_gap', 'Gap', 'mm')}
          {rotate && (
            <label class="sheet-check" title={rotate.help}>
              <input
                autocomplete="off"
                type="checkbox"
                checked={values['pack_rotate'] !== false}
                onChange={(e) => setValue('pack_rotate', (e.target as HTMLInputElement).checked)}
              />
              Rotate parts
            </label>
          )}
          {step?.kind === 'enum' && values['pack_rotate'] !== false && (
            <label class="sheet-field" title={step.help}>
              <span class="k">Optimise turns by</span>
              <select
                autocomplete="off"
                value={String(values['pack_angle_step'] ?? step.default)}
                onChange={(e) => setValue('pack_angle_step', (e.target as HTMLSelectElement).value)}
              >
                {step.choices.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          {!optimiser.running && number('optimise_seconds', 'Optimise for', 's')}
          {usePanels && (
            <label class="sheet-check" title={usePanels.help}>
              <input
                autocomplete="off"
                type="checkbox"
                checked={panels}
                onChange={(e) => setValue('use_panels', (e.target as HTMLInputElement).checked)}
              />
              Plan from stock panels
            </label>
          )}
        </div>
      )}
      {/* Planning from panels is a mode, so its sizes stay out while it is on. */}
      {panels && (
        <div class="sheet-fields">
          {pair('panel_width', 'panel_height', 'Stock panel')}
          {pair('bed_width', 'bed_height', 'Laser bed')}
        </div>
      )}
    </div>
  );
}

const sheetCount = (n: number) => `${n} sheet${n === 1 ? '' : 's'}`;

const OPTIMISE_HELP =
  'Parts are packed by their bounding boxes. Optimise nests them by outline and searches for fewer sheets.';

/** Nesting by outline: start it, watch it, and keep or drop what it finds. */
function Optimise({ running, result, applied, start, stop, discard }: Optimiser) {
  if (running) {
    const best = running.best;
    return (
      <span class="optimise">
        <span class="status">
          Optimising… {best ? `${sheetCount(best.sheets)}, ${Math.round(best.used * 100)}% used` : 'starting'} ·{' '}
          {(running.elapsedMs / 1000).toFixed(1)} s
        </span>
        <button type="button" class="btn" onClick={stop}>
          Stop
        </button>
      </span>
    );
  }
  if (result && applied) {
    return (
      <span class="optimise">
        <span class="status" title={`Packed by box it takes ${sheetCount(result.baseline)}.`}>
          Optimised: {sheetCount(result.sheets)}, {Math.round(result.used * 100)}% used
        </span>
        <button type="button" class="btn" onClick={start}>
          Again
        </button>
        <button type="button" class="btn" title="Drop the optimised layout and pack by bounding box" onClick={discard}>
          Pack by box
        </button>
      </span>
    );
  }
  return (
    <span class="optimise">
      {result && (
        <span class="status" title="The settings have changed since the layout was optimised, so parts are packed by box again.">
          Optimised layout out of date
        </span>
      )}
      <button type="button" class="btn" title={OPTIMISE_HELP} onClick={start}>
        {result ? 'Optimise again' : 'Optimise layout'}
      </button>
    </span>
  );
}

/** A sheet size and copy count that waste less stock than the ones chosen. */
function Hint({
  hint,
  values,
  panels: byPanel,
  onUse,
  onDismiss,
}: {
  hint: LayoutSuggestion;
  values: ParamValues;
  /** Counting panels; otherwise every sheet is bought on its own. */
  panels: boolean;
  onUse: () => void;
  onDismiss: () => void;
}) {
  const mm = (n: number) => String(Math.round(n * 10) / 10);
  // Two places at most, and no trailing zeros: "3", not "3.00".
  const rate = (panels: number, copies: number) => String(Math.round((panels / copies) * 100) / 100);
  const resize =
    Math.abs(hint.sheetWidth - Number(values['sheet_width'])) > 1e-6 ||
    Math.abs(hint.sheetHeight - Number(values['sheet_height'])) > 1e-6;
  const size = `${mm(hint.sheetWidth)} × ${mm(hint.sheetHeight)}`;
  const panels = `${hint.panels} panel${hint.panels === 1 ? '' : 's'}`;

  // The whole reasoning is in the tooltip; the line says what changes.
  if (!byPanel) {
    const full =
      `${hint.copies} copies fit on ${hint.sheets} sheets, ${Math.round(hint.used * 100)}% used. That is ` +
      `${rate(hint.sheets, hint.copies)} sheets per copy, down from ${rate(hint.current.sheets, hint.current.copies)} per copy now.`;
    return (
      <span class="copies-hint" title={full}>
        <span>
          {hint.copies} copies: {rate(hint.sheets, hint.copies)} sheets each, down from{' '}
          {rate(hint.current.sheets, hint.current.copies)}
        </span>
        <button type="button" class="btn" onClick={onUse}>
          Use {hint.copies}
        </button>
        <DismissButton onClick={onDismiss} />
      </span>
    );
  }

  const full =
    (resize
      ? `Cut each ${mm(Number(values['panel_width']))} × ${mm(Number(values['panel_height']))} panel into ` +
        `${hint.perPanel} sheets of ${size}: `
      : '') +
    `${hint.copies} ${hint.copies === 1 ? 'copy uses' : 'copies use'} ${panels}, ${Math.round(hint.used * 100)}% used. ` +
    `That is ${rate(hint.panels, hint.copies)} panels per copy, down from ${rate(hint.current.panels, hint.current.copies)} per copy now.`;
  return (
    <span class="copies-hint" title={full}>
      <span>
        {resize && `${size} sheets, `}
        {hint.copies} {hint.copies === 1 ? 'copy' : 'copies'}: {rate(hint.panels, hint.copies)} panels each, down from{' '}
        {rate(hint.current.panels, hint.current.copies)}
      </span>
      <button type="button" class="btn" onClick={onUse}>
        Use
      </button>
      <DismissButton onClick={onDismiss} />
    </span>
  );
}

function DismissButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" class="reset-btn" title="Dismiss" aria-label="Dismiss suggestion" onClick={onClick}>
      ×
    </button>
  );
}
