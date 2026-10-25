/**
 * Lids, ported from boxes.py `boxes/lids.py`.
 *
 * A lid is an optional set of extra parts appended to a box. `flat` is two
 * stacked plates; `flatbrim` is one plate with a rim of strips underneath that
 * drops inside the walls; `flatfang` is one plate held by four small tabs at
 * its corners; `overthetop` is a shallow box that slips over the outside.
 *
 * The `chest` and `ontop` styles from boxes.py are not ported — chest needs the
 * flex/living-hinge edges, which are not in this build; ontop has everything it
 * needs since `polygonWall` arrived, but nobody has ported it yet. They are
 * absent from the style list rather than silently falling back to something
 * else.
 */
import type { Boxes } from './boxes';
import { INNER_CUT } from './geom/colors';
import { Settings } from './edges/settings';

export type LidStyle = 'none' | 'flat' | 'overthetop' | 'flatbrim' | 'flatfang';
export type LidHandle =
  | 'none'
  | 'long_rounded'
  | 'long_trapezoid'
  | 'long_doublerounded'
  | 'knob';

export class LidSettings extends Settings {
  static override absoluteParams = {
    style: ['none', 'flat', 'overthetop', 'flatbrim', 'flatfang'] as const,
    handle: [
      'none',
      'long_rounded',
      'long_trapezoid',
      'long_doublerounded',
      'knob',
    ] as const,
    /** Millimetres, not thickness: the gap between a flat lid's inner part and the walls. */
    brim_spacing: 0.1,
  };

  static override relativeParams = {
    height: 4.0,
    play: 0.1,
    brim_height: 1.0,
    handle_height: 8.0,
    fang_size: 1.0,
  };

  get style(): LidStyle { return this.getStr('style') as LidStyle; }
  get handle(): LidHandle { return this.getStr('handle') as LidHandle; }
  get height(): number { return this.getNum('height'); }
  get play(): number { return this.getNum('play'); }
  get handle_height(): number { return this.getNum('handle_height'); }
  get brim_spacing(): number { return this.getNum('brim_spacing'); }
  get brim_height(): number { return this.getNum('brim_height'); }
  get fang_size(): number { return this.getNum('fang_size'); }
}

export class Lid {
  constructor(
    private boxes: Boxes,
    public settings: LidSettings,
  ) {}

  /** Draw the lid parts. Returns false when the style is "none". */
  call(x: number, y: number, edge?: string): boolean {
    const b = this.boxes;
    const t = b.thickness;
    const s = this.settings;

    if (s.style === 'flat') {
      // The lower plate sits inside the walls, so it is cut a little smaller.
      const bs = s.brim_spacing;
      b.rectangularWall(x - bs * 2, y - bs * 2, 'eeee', {
        callback: [this.handleCallback(x, y)],
        move: 'up',
        label: 'Lid bottom',
      });
      b.rectangularWall(x, y, 'EEEE', {
        callback: [this.handleCallback(x, y)],
        move: 'up',
        label: 'Lid top',
      });
    } else if (s.style === 'flatbrim') {
      // boxes.py also reads the finger and space settings here and derives a
      // `gap` from them, then never uses it; that dead arithmetic is left out.
      const bs = s.brim_spacing;
      const brimX = x - bs * 2;
      const brimY = y - bs * 2 - t * 2;
      // One callback per side; each runs with that side as its baseline, so
      // the four calls trace a rectangle of slots for the brim strips.
      const brimHoles = (spacing: number, length: number) => () =>
        b.fingerHolesAt(spacing + bs, t * 0.5 + bs, length, 0);

      b.rectangularWall(x, y, 'EEEE', {
        callback: [brimHoles(0, brimX), brimHoles(t, brimY), brimHoles(0, brimX), brimHoles(t, brimY)],
        move: 'right',
        label: 'Lid top',
      });
      for (const length of [brimX, brimX, brimY, brimY]) {
        b.rectangularWall(length, s.brim_height, 'feee', { move: 'up', label: 'Lid brim' });
      }
    } else if (s.style === 'flatfang') {
      const bs = s.brim_spacing;
      const fs = s.fang_size;
      // Positions transcribed term for term from boxes.py, including the
      // `- t + t` pairs, so the arithmetic rounds the same way.
      const fangHoles = () => {
        b.rectangularHole(bs - t * 0.5 + t, bs + fs * 0.5 - t + t, t, fs);
        b.rectangularHole(x - bs - fs * 0.5, bs - t * 0.5 + t, fs, t);
        b.rectangularHole(bs + fs / 2 - t + t, y - bs + t * 0.5 - t, fs, t);
        b.rectangularHole(x - bs + t * 0.5 - t, y - bs - fs / 2, t, fs);
      };

      b.rectangularWall(x, y, 'EEEE', { callback: [fangHoles], move: 'up', label: 'Lid top' });
      // boxes.py labels only the first of these; every part needs a name here.
      for (let i = 0; i < 4; i++) {
        b.rectangularWall(fs, s.brim_height + t, 'eeee', { move: 'right', label: 'Lid fang' });
      }
    } else if (s.style === 'overthetop') {
      // Slips over the outside of the box, so it needs clearance all round.
      const x2 = x + 2 * t + s.play;
      const y2 = y + 2 * t + s.play;
      const bottom = edge === 'S' || edge === 'Š' ? 'š' : 'e';

      b.savedContext(() => {
        b.rectangularWall(x2, y2, 'ffff', {
          callback: [this.handleCallback(x2, y2)],
          move: 'up',
          label: 'Lid top',
        });
        b.rectangularWall(x2, s.height, `${bottom}FFF`, {
          ignoreWidths: [1, 2, 5, 6],
          move: 'up upsidedown',
          label: 'Lid front',
        });
        b.rectangularWall(x2, s.height, `${bottom}FFF`, {
          ignoreWidths: [1, 2, 5, 6],
          move: 'up',
          label: 'Lid back',
        });
      });

      b.rectangularWall(x2, y2, 'ffff', { move: 'right only' });
      b.rectangularWall(y2, s.height, `${bottom}fFf`, {
        ignoreWidths: [1, 2, 5, 6],
        move: 'right rotated',
        label: 'Lid left',
      });
      b.rectangularWall(y2, s.height, `${bottom}fFf`, {
        ignoreWidths: [1, 2, 5, 6],
        move: 'right rotated upsidedown',
        label: 'Lid right',
      });
    } else {
      return false;
    }

    this.handleParts(x, y);
    return true;
  }

  /** Cuts the opening the handle passes through. */
  private handleCallback(x: number, y: number): (() => void) | null {
    const b = this.boxes;
    const t = b.thickness;
    const handle = this.settings.handle;
    if (handle === 'none') return null;

    return () => {
      if (handle.startsWith('long')) {
        b.rectangularHole(x / 2, y / 2, x / 2, t);
      } else if (handle === 'knob') {
        const h = 3 * t;
        const v = 3 * t;
        b.moveTo((x - t) / 2 + b.burn, (y - t) / 2 + b.burn, 180);
        b.ctx.stroke();
        b.savedContext(() => {
          b.setSourceColor(INNER_CUT);
          for (const l of [h, v, h, v]) {
            b.polyline(l, -90, t, -90, l, 90);
          }
        });
        b.ctx.stroke();
      }
    };
  }

  private handleParts(x: number, y: number): void {
    const handle = this.settings.handle;
    if (handle.startsWith('long')) this.longHandle(x, handle);
    else if (handle === 'knob') this.knobHandle();
  }

  private longHandle(x: number, style: LidHandle): void {
    const b = this.boxes;
    const t = this.settings.thickness;
    const hh = this.settings.handle_height;
    const tw = x / 2 + 2 * t;
    const th = hh + 2 * t;

    if (b.move(tw, th, 'up', true)) return;

    b.moveTo(0.5 * t);

    let poly: Array<number | [number, number]> = [[90, t / 2], t / 2, 90, t, -90];
    let l: number;

    if (style === 'long_trapezoid') {
      poly = [...poly, t, [45, t], (hh - t) * Math.SQRT2, [45, t]];
      l = x / 2 - 2 * hh;
    } else if (style === 'long_doublerounded') {
      poly = [...poly, t, 90, 0, [-90, hh / 2], 0, [90, hh / 2]];
      l = x / 2 - 2 * hh;
    } else {
      const r = Math.min(hh / 2, x / 4);
      poly = [...poly, t + hh - r, [90, r]];
      l = x / 2 - 2 * r;
    }

    b.polyline(x / 2 + t, ...poly, l, ...[...poly].reverse());
    b.move(tw, th, 'up', false, 'Handle');
  }

  private knobHandle(): void {
    const b = this.boxes;
    const t = this.settings.thickness;
    const hh = this.settings.handle_height;
    const tw = 2 * 7 * t + b.spacing;
    const th = hh + 2 * t;

    if (b.move(tw, th, 'up', true)) return;

    const poly: Array<number | [number, number]> = [
      [90, t / 2], t / 2, 90, t / 2, -90, hh - 2 * t, [90, 3 * t],
    ];

    const shapes: [Array<number | [number, number]>, Array<number | [number, number]>][] = [
      [[3 * t, 90, 2 * t + hh / 2, -90, t, -90, hh / 2 + 2 * t, 90, 3 * t], [t]],
      [[7 * t], [0, 90, hh / 2, -90, t, -90, hh / 2, 90, 0]],
    ];

    for (const [bottom, top] of shapes) {
      b.moveTo(0.5 * t);
      b.polyline(...bottom, ...poly, ...top, ...[...poly].reverse());
      b.moveTo(tw / 2 + b.spacing);
    }

    b.move(tw, th, 'up', false, 'Knob');
  }
}
