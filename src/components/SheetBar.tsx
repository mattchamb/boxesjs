/**
 * Sheet settings, between the toolbar and the preview.
 *
 * Packing changes where the parts go, not what they are, and its effect is the
 * preview right below; in the parameter panel it sat under every joint and lid
 * setting, out of sight of the sheets it lays out.
 */
import type { CopiesSuggestion } from '../lib/layout/pack';
import type { ParamSpec, ParamValue, ParamValues } from '../lib/params/schema';
import { NumberInput } from './controls';

interface Props {
  specs: ParamSpec[];
  values: ParamValues;
  setValue: (key: string, v: ParamValue) => void;
  hint: CopiesSuggestion | null;
}

export function SheetBar({ specs, values, setValue, hint }: Props) {
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

  const rotate = specs.find((s) => s.key === 'pack_rotate');
  const rate = (sheets: number, copies: number) => (sheets / copies).toFixed(2);

  return (
    <div class="sheetbar">
      <div class="sheet-fields">
        <span class="sheet-size">
          {number('sheet_width', 'Sheet')}
          <span class="times">×</span>
          {number('sheet_height', '', 'mm')}
        </span>
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
      </div>
      {hint && (
        <div class="copies-hint">
          <p>
            {hint.copies} copies fit on {hint.sheets} sheets: {rate(hint.sheets, hint.copies)} sheets per copy
            ({Math.round(hint.used * 100)}% used), against {rate(hint.current.sheets, hint.current.copies)} now.
          </p>
          <button type="button" class="btn" onClick={() => setValue('pack_copies', hint.copies)}>
            Use {hint.copies}
          </button>
        </div>
      )}
    </div>
  );
}
