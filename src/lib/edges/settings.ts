/**
 * Edge settings, ported from `Settings` in boxes.py `boxes/edges.py`.
 *
 * Settings come in two flavours. Absolute params are plain values. Relative
 * params are expressed in multiples of material thickness, so a joint designed
 * for 3 mm ply keeps its proportions when you switch to 6 mm MDF. That rescaling
 * is the whole reason this class exists.
 */

export type SettingValue = number | string | boolean;
/** A tuple of strings declares an enum; the first entry is the default. */
export type ParamDefault = SettingValue | readonly string[];

export type SettingsOverrides = Record<string, SettingValue>;

export class Settings {
  /** Values used as-is. */
  static absoluteParams: Record<string, ParamDefault> = {};
  /** Values multiplied by thickness when `relative` is true. */
  static relativeParams: Record<string, number> = {};

  values: Record<string, SettingValue> = {};
  thickness: number;

  constructor(thickness: number, relative = true, overrides: SettingsOverrides = {}) {
    const ctor = this.constructor as typeof Settings;

    for (const [name, value] of Object.entries(ctor.absoluteParams)) {
      const v = Array.isArray(value) ? value[0] : value;
      if (typeof v !== 'boolean' && typeof v !== 'number' && typeof v !== 'string') {
        throw new Error(`Unsupported setting type for ${name}: ${String(v)}`);
      }
      this.values[name] = v as SettingValue;
    }

    this.thickness = thickness;
    const factor = relative ? thickness : 1.0;
    for (const [name, value] of Object.entries(ctor.relativeParams)) {
      this.values[name] = value * factor;
    }

    this.setValues(thickness, relative, overrides);
  }

  setValues(thickness: number, relative = true, overrides: SettingsOverrides = {}): void {
    const ctor = this.constructor as typeof Settings;
    const factor = relative ? thickness : 1.0;

    for (const [name, value] of Object.entries(overrides)) {
      if (value === undefined) continue;
      if (name in ctor.absoluteParams) {
        this.values[name] = value;
      } else if (name in ctor.relativeParams) {
        this.values[name] = (value as number) * factor;
      } else if (name in this) {
        // Class-level knobs such as FingerJointSettings.angle.
        (this as unknown as Record<string, SettingValue>)[name] = value;
      } else {
        throw new Error(`Unknown parameter for ${ctor.name}: ${name}`);
      }
    }
    this.checkValues();
  }

  /**
   * Independent copy, standing in for boxes.py's `copy.deepcopy`. RegularBox
   * clones one settings object three times and retunes each to a different
   * joint angle; sharing `values` between them would make the last angle win
   * everywhere. `structuredClone` is no use here — it drops the prototype, and
   * with it the getters and `edgeObjects`.
   */
  clone(): this {
    const copy = Object.assign(Object.create(Object.getPrototypeOf(this)), this) as this;
    copy.values = { ...this.values };
    return copy;
  }

  /** Override to reject value combinations that cannot produce valid geometry. */
  checkValues(): void {}

  // Named with a `get` prefix so subclasses stay free to expose settings as
  // properties called `num`, `width`, `style` and so on.
  getNum(name: string): number {
    const v = this.values[name];
    if (typeof v !== 'number') {
      throw new Error(`Setting ${name} is not a number (got ${typeof v})`);
    }
    return v;
  }

  getStr(name: string): string {
    const v = this.values[name];
    if (typeof v !== 'string') {
      throw new Error(`Setting ${name} is not a string (got ${typeof v})`);
    }
    return v;
  }

  getBool(name: string): boolean {
    return Boolean(this.values[name]);
  }
}
