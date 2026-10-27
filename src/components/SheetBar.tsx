/**
 * Sheet settings, between the toolbar and the preview.
 *
 * Packing changes where the parts go, not what they are, and its effect is the
 * preview right below; in the parameter panel it sat under every joint and lid
 * setting, out of sight of the sheets it lays out.
 */
import type { NestResult } from '../lib/layout/nest';
import type { LayoutSuggestion } from '../lib/layout/pack';
import type { ParamSpec, ParamValue, ParamValues } from '../lib/params/schema';
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

  return (
    <div class="sheetbar">
      <div class="sheet-fields">
        {pair('sheet_width', 'sheet_height', 'Sheet')}
        {number('sheet_margin', 'Edge offset', 'mm')}
        {number('pack_gap', 'Gap', 'mm')}
        {number('pack_copies', 'Copies')}
        {rotate && (
          <label class="sheet-check" title={rotate.help}>
            <input
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
        {usePanels && (
          <label class="sheet-check" title={usePanels.help}>
            <input
              type="checkbox"
              checked={panels}
              onChange={(e) => setValue('use_panels', (e.target as HTMLInputElement).checked)}
            />
            Plan from stock panels
          </label>
        )}
      </div>
      {panels && (
        <div class="sheet-fields">
          {pair('panel_width', 'panel_height', 'Stock panel')}
          {pair('bed_width', 'bed_height', 'Laser bed')}
        </div>
      )}
      {hint && <Hint hint={hint} values={values} panels={panels} onUse={() => applyHint(hint)} />}
      <Optimise {...optimiser} />
    </div>
  );
}

const sheetCount = (n: number) => `${n} sheet${n === 1 ? '' : 's'}`;

/** Nesting by outline: start it, watch it, and keep or drop what it finds. */
function Optimise({ running, result, applied, start, stop, discard }: Optimiser) {
  if (running) {
    const best = running.best;
    return (
      <div class="optimise">
        <p>
          Optimising… {best ? `${sheetCount(best.sheets)}, ${Math.round(best.used * 100)}% used` : 'starting'} ·{' '}
          {(running.elapsedMs / 1000).toFixed(1)} s
        </p>
        <button type="button" class="btn" onClick={stop}>
          Stop
        </button>
      </div>
    );
  }
  if (result && applied) {
    return (
      <div class="optimise">
        <p>
          Optimised layout: {sheetCount(result.sheets)}, {Math.round(result.used * 100)}% used, against{' '}
          {sheetCount(result.baseline)} packed by box.
        </p>
        <button type="button" class="btn" onClick={start}>
          Optimise again
        </button>
        <button type="button" class="btn" onClick={discard}>
          Pack by box
        </button>
      </div>
    );
  }
  return (
    <div class="optimise">
      <p>
        {result
          ? 'Settings have changed since the layout was optimised, so parts are packed by box again.'
          : 'Parts are packed by their boxes. Optimise nests them by outline and searches for fewer sheets, for about ten seconds.'}
      </p>
      <button type="button" class="btn" onClick={start}>
        {result ? 'Optimise again' : 'Optimise layout'}
      </button>
    </div>
  );
}

/** A sheet size and copy count that waste less stock than the ones chosen. */
function Hint({
  hint,
  values,
  panels: byPanel,
  onUse,
}: {
  hint: LayoutSuggestion;
  values: ParamValues;
  /** Counting panels; otherwise every sheet is bought on its own. */
  panels: boolean;
  onUse: () => void;
}) {
  const mm = (n: number) => String(Math.round(n * 10) / 10);
  const rate = (panels: number, copies: number) => (panels / copies).toFixed(2);
  const resize =
    Math.abs(hint.sheetWidth - Number(values['sheet_width'])) > 1e-6 ||
    Math.abs(hint.sheetHeight - Number(values['sheet_height'])) > 1e-6;
  const size = `${mm(hint.sheetWidth)} × ${mm(hint.sheetHeight)}`;
  const panels = `${hint.panels} panel${hint.panels === 1 ? '' : 's'}`;

  if (!byPanel) {
    return (
      <div class="copies-hint">
        <p>
          {hint.copies} copies fit on {hint.sheets} sheets: {rate(hint.sheets, hint.copies)} sheets per copy (
          {Math.round(hint.used * 100)}% used), against {rate(hint.current.sheets, hint.current.copies)} now.
        </p>
        <button type="button" class="btn" onClick={onUse}>
          Use {hint.copies}
        </button>
      </div>
    );
  }

  return (
    <div class="copies-hint">
      <p>
        {resize && (
          <>
            Cut each {mm(Number(values['panel_width']))} × {mm(Number(values['panel_height']))} panel into{' '}
            {hint.perPanel} sheets of {size}:{' '}
          </>
        )}
        {hint.copies} {hint.copies === 1 ? 'copy uses' : 'copies use'} {panels}, {rate(hint.panels, hint.copies)} per
        copy ({Math.round(hint.used * 100)}% used), against {rate(hint.current.panels, hint.current.copies)} now.
      </p>
      <button type="button" class="btn" onClick={onUse}>
        {resize ? `Use ${size}, ${hint.copies} ${hint.copies === 1 ? 'copy' : 'copies'}` : `Use ${hint.copies}`}
      </button>
    </div>
  );
}
