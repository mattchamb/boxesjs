/**
 * Frame loom — ported from boxes.py `boxes/generators/frameloom.py`
 * (class `FrameLoom`).
 *
 * A flat weaving loom cut from one sheet: a frame with a comb of numbered pins
 * at each end and a window in the middle, two feet that snap into it, and a
 * heddle bar that turns in the feet to lift alternate warp threads. Pattern
 * heddles, a comb, needles and shuttles come with it. At sizes near the
 * defaults the loose parts nest inside the frame's window.
 *
 * Unlike most generators this one is all freehand turtle drawing — there are
 * no joints, only `edge` and `corner` — so the shapes are transcribed line for
 * line, constants included.
 */
import { Boxes, type BoxesConfig } from '../boxes';
import { ETCHING, ETCHING_DEEP } from '../geom/colors';
import type { ParamValues } from '../params/schema';
import { b, n, type GeneratorDef } from './types';

const DEG = Math.PI / 180;

type Pattern = number[];

interface FrameLoomOptions {
  warpThreads: number;
  warpSpacing: number;
  outerFrameLength: number;
  includeFrame: boolean;
  includeHeddle: boolean;
  include2by2Heddle: boolean;
  includeDiamondHeddle: boolean;
  includeNeedles: boolean;
  combPins: number;
  numShuttles: number;
}

interface HeddleOptions {
  handle?: boolean;
  holes?: boolean;
  clipons?: boolean;
}

/** Python's `list[-n:] + list[:len(list) - n]`. */
function rotate(list: Pattern, n: number): Pattern {
  return [...list.slice(list.length - n), ...list.slice(0, list.length - n)];
}

/** The seed repeated across the warp, and the same shifted by `shift`. */
function heddlePatterns(seed: Pattern, length: number, shift: number): [Pattern, Pattern] {
  const chunks = Math.ceil(length / seed.length);
  const base: Pattern = [];
  for (let i = 0; i < chunks; i++) base.push(...seed);
  return [base.slice(0, length), rotate(base, shift).slice(0, length)];
}

class FrameLoom extends Boxes {
  constructor(
    private o: FrameLoomOptions,
    config: Partial<BoxesConfig>,
  ) {
    super(config);
  }

  /**
   * Angle at which a pin leaves the frame. boxes.py derives it from the pin
   * shape constants in `frame()` and refuses pin widths outside about 2-5.5 mm,
   * where the flank can no longer reach the tip.
   */
  private static pinFlare(pinWidth: number): { flare: number; tipRadius: number } {
    const tipRadius = Math.max(0.5, (pinWidth * (1 / 2.5)) / 2);
    const a = 0.5 - 4.0;
    const b = 4.0;
    const c = pinWidth / 2 - tipRadius - 4.0;
    const hyp = Math.hypot(a, b);
    const flare = 180.0 - Math.asin(c / hyp) / DEG - Math.atan2(b, a) / DEG;
    return { flare, tipRadius };
  }

  private frame(
    pinWidth: number,
    numWarpThreads: number,
    frameThickness: number,
    outerFrameLength: number,
    footAttachmentXOffset: number,
    move: string,
  ): void {
    const pinBaseRadius = 0.5;
    const pinEaseRadius = 4.0;
    const pinFlank = 4.0;
    const pinShaft = 1.0;
    const { flare: pinFlare, tipRadius: pinTipRadius } = FrameLoom.pinFlare(pinWidth);

    // A tapered spike, exactly pinWidth wide where it meets the frame.
    const drawPin = (): void => {
      this.corner(pinFlare, pinBaseRadius);
      this.edge(pinFlank);
      this.corner(90 - pinFlare, pinEaseRadius);
      this.edge(pinShaft);
      this.corner(-180, pinTipRadius);
      this.edge(pinShaft);
      this.corner(90 - pinFlare, pinEaseRadius);
      this.edge(pinFlank);
      this.corner(pinFlare, pinBaseRadius);
    };

    // A thin slot in the side of the frame to tuck the warp's loose end into.
    const drawThreadHolder = (height: number): void => {
      this.corner(90);
      this.edge(10);
      this.corner(-180, height / 2);
      this.edge(10);
      this.corner(90);
    };

    const threadHolderHeight = 0.33;
    const cornerRadius = 8;
    const cornerInnerRadius = 4;
    const pinAreaHeight = 20;
    const pinAreaWidth = numWarpThreads * pinWidth;
    const heddleEasing = 50;
    const heddleEasingShiftRadius = 3;
    const innerFrameEasing = pinWidth / 2;

    const tw = 2 * frameThickness + pinAreaWidth;
    const th = outerFrameLength;
    if (this.move(tw, th, move, true)) return;

    this.moveTo(frameThickness, 0);

    // Outer frame: pins along each end, numbered so threads can be counted.
    this.savedContext(() => {
      for (let idx = 0; idx < numWarpThreads; idx++) {
        drawPin();
        this.savedContext(() => {
          this.moveTo(-pinWidth / 2, 8);
          this.text(String(idx + 1), 0, 0, 0, 'center', 2, ETCHING);
        });
      }
      this.edge(frameThickness - cornerRadius);
      this.corner(90, cornerRadius);
      drawThreadHolder(threadHolderHeight);
      this.edge(outerFrameLength - 2 * cornerRadius - 2 * threadHolderHeight);
      drawThreadHolder(threadHolderHeight);
      this.corner(90, cornerRadius);
      this.edge(frameThickness - cornerRadius);

      for (let idx = 0; idx < numWarpThreads; idx++) {
        const fontSize = pinWidth < 3 ? 1.5 : 2;
        drawPin();
        this.savedContext(() => {
          this.moveTo(-pinWidth / 2, 10);
          this.text(String(numWarpThreads - idx), 0, 0, 180, 'center', fontSize, ETCHING);
        });
      }

      this.edge(frameThickness - cornerRadius);
      this.corner(90, cornerRadius);
      drawThreadHolder(threadHolderHeight);
      this.edge(outerFrameLength - 2 * cornerRadius - 2 * threadHolderHeight);
      drawThreadHolder(threadHolderHeight);
      this.corner(90, cornerRadius);
      this.edge(frameThickness - cornerRadius);
    });

    // The window, widening near one end so the heddle can turn.
    this.savedContext(() => {
      this.moveTo(0, pinAreaHeight);
      this.moveTo(-innerFrameEasing + cornerInnerRadius, 0);

      const easingAngle = 45;
      const shiftSideways = 2 * heddleEasingShiftRadius * (1 - Math.cos(easingAngle * DEG));
      const shiftVertical = 2 * heddleEasingShiftRadius * Math.sin(easingAngle * DEG);

      const lengthBottom = pinAreaWidth + 2 * innerFrameEasing - 2 * cornerInnerRadius;
      const lengthSide = outerFrameLength - 2 * pinAreaHeight - 2 * cornerInnerRadius;
      const heightBelowEasing = lengthSide - heddleEasing;
      const heightInEasing = heddleEasing - shiftVertical;
      const lengthTop = lengthBottom + 2 * shiftSideways;

      this.edge(lengthBottom);
      this.corner(90, cornerInnerRadius);
      this.edge(heightBelowEasing);
      this.corner(-easingAngle, heddleEasingShiftRadius);
      this.corner(easingAngle, heddleEasingShiftRadius);
      this.edge(heightInEasing);
      this.corner(90, cornerInnerRadius);
      this.edge(lengthTop);
      this.corner(90, cornerInnerRadius);
      this.edge(heightInEasing);
      this.corner(45, heddleEasingShiftRadius);
      this.corner(-45, heddleEasingShiftRadius);
      this.edge(heightBelowEasing);
      this.corner(90, cornerInnerRadius);
    });

    // Slots the feet hook into.
    this.savedContext(() => {
      const holeX = this.thickness;
      const holeY = 23;
      const up = outerFrameLength - holeY / 2 - pinAreaHeight - cornerInnerRadius / 2;
      this.rectangularHole(-footAttachmentXOffset, up, holeX, holeY);
      this.rectangularHole(footAttachmentXOffset + pinAreaWidth, up, holeX, holeY);
    });

    this.move(tw, th, move, false, 'Frame');
  }

  private foot(holeRadius: number, move: string): void {
    const t = this.thickness;
    const width = 33;
    const height = 40;
    const neck = 23;
    const cutoutTabHeight = 2;
    const cutoutDepth = 0.75 * height;
    const cutoutAngle = 178;
    const cutoutRadius = 0.5;

    const residualAngle = (180 - cutoutAngle) * DEG;
    const cutoutReturnLength =
      cutoutDepth / Math.cos(residualAngle) + cutoutRadius * Math.tan(residualAngle);
    const cutoutWidth =
      cutoutDepth * Math.tan(residualAngle) + cutoutRadius * (1.0 + 1.0 / Math.cos(residualAngle));

    const tw = width;
    const th = height + t + 3;
    if (this.move(tw, th, move, true)) return;

    this.moveTo(5 + 2, 3, 90);

    this.edge(t);
    this.corner(90);
    this.edge(5);
    // body
    this.corner(-90, 2);
    this.edge(height - width / 2 - 2);
    this.corner(-180, width / 2);
    this.edge(height - width / 2 - 0.5);
    this.corner(-90, 0.5);

    this.edge(2.5);
    this.corner(90);
    this.edge(t);
    // small tab
    this.corner(90);
    this.corner(-180, 1.5);
    this.edge(cutoutTabHeight);
    this.corner(-90);
    // the springy cut that lets the foot snap into the frame
    this.edge(cutoutDepth);
    this.corner(cutoutAngle, cutoutRadius);
    this.edge(cutoutReturnLength);
    this.corner(90 - cutoutAngle);
    this.edge(neck - cutoutTabHeight - cutoutWidth);
    // large tab
    this.corner(-180, 1.5);

    // axle hole for the heddle
    this.corner(90);
    this.hole(t + 6.2, -1.3, holeRadius);

    this.move(tw, th, move, false, 'Foot');
  }

  /** The heddle's teeth: 1 is a tooth with a slot, 0 a gap at the root. */
  private drawHeddlePinsFromPattern(
    nibRadius: number,
    heddleCornerRadius: number,
    heddleHeight: number,
    pinWidth: number,
    pattern: Pattern,
  ): void {
    let previous = 0;
    for (const point of pattern) {
      if (previous === 0 && point === 1) {
        this.corner(-90, heddleCornerRadius);
        this.edge(heddleHeight - heddleCornerRadius);
        this.corner(90, nibRadius);
      } else if (previous === 1 && point === 0) {
        this.corner(90, nibRadius);
        this.edge(heddleHeight - heddleCornerRadius);
        this.corner(-90, heddleCornerRadius);
      }

      if (point === 1) {
        this.corner(90, nibRadius);
        this.corner(-90, nibRadius);
        this.edge(pinWidth - 4 * nibRadius);
        this.corner(-90, nibRadius);
        this.corner(90, nibRadius);
      } else if (point === 0) {
        if (previous === 0) this.edge(pinWidth);
        else this.edge(pinWidth - 2 * nibRadius - 2 * heddleCornerRadius);
      }
      previous = point;
    }

    if (previous === 1) {
      this.corner(90, nibRadius);
      this.edge(heddleHeight - heddleCornerRadius);
      this.corner(-90, heddleCornerRadius);
    } else {
      this.edge(pinWidth - nibRadius - heddleCornerRadius);
    }
  }

  private heddle(
    patternLeft: Pattern,
    patternRight: Pattern,
    pinWidth: number,
    numWarpThreads: number,
    footAttachmentXOffset: number,
    footHoleRadius: number,
    { handle = true, holes = false, clipons = false }: HeddleOptions,
    move: string,
    label: string,
  ): void {
    const t = this.thickness;
    // Patterns arrive bottom to top, so the far side is reversed.
    const patterns = [patternLeft, [...patternRight].reverse()];

    const handleLength = 20;
    const heddleHeight = 18;
    const heddleCornerRadius = 0.25 * pinWidth;
    const nibRadius = 0.33;
    const lipSize = 1;

    // The axle is the heddle's own cross-section, sized to turn in the foot.
    const handleWidth = Math.sqrt(4 * footHoleRadius ** 2 - t ** 2);
    const handleRadius = handleWidth / 2;
    const pinArea = pinWidth * numWarpThreads;
    const axleSideLength = footAttachmentXOffset - t / 2;

    let holeLength = pinArea / 8;
    let numHoles = 3;
    if (holeLength < t) {
      numHoles = 1;
      holeLength = Math.max(3 * holeLength, 2 * t);
    } else if (holeLength < 2 * t) {
      numHoles = 2;
      holeLength *= 2;
    }

    const tw = 2 * heddleHeight + handleWidth + 2;
    const th = 2 * handleLength + 2 * axleSideLength + pinArea;
    if (this.move(tw, th, move, true)) return;

    this.moveTo(heddleHeight, handleLength);

    for (let idx = 0; idx < 2; idx++) {
      this.edge(lipSize);
      if (handle) {
        this.corner(-90);
        this.edge(handleLength - handleRadius);
        this.corner(180, handleRadius);
        this.edge(handleLength - handleRadius);
        this.corner(-90);
      } else if (clipons) {
        // A gap the width of the material, where the mating heddle slots in.
        this.edge(handleRadius - 0.5 * t);
        this.moveTo(t);
        this.edge(handleRadius - 0.5 * t);
      } else {
        this.edge(2 * handleRadius);
      }
      this.edge(lipSize);
      this.corner(90);

      this.edge(axleSideLength - heddleCornerRadius - nibRadius);
      this.drawHeddlePinsFromPattern(nibRadius, heddleCornerRadius, heddleHeight, pinWidth, patterns[idx]!);
      this.edge(axleSideLength - heddleCornerRadius - nibRadius);

      this.corner(90);
    }

    if (holes) {
      this.savedContext(() => {
        this.moveTo(lipSize + handleRadius, pinArea / 2 + axleSideLength);
        if (numHoles !== 2) this.rectangularHole(0, 0, t, holeLength);
        if (numHoles !== 1) {
          this.rectangularHole(0, pinArea / 3, t, holeLength);
          this.rectangularHole(0, -pinArea / 3, t, holeLength);
        }
        this.moveTo(-t / 2, -pinArea / 3 - holeLength / 2);
        this.text('>', 0, 0, 0, 'right', 4, ETCHING_DEEP);
      });
    }

    if (clipons) {
      // Tabs along the centre line that mate with the holes in the other half.
      const ha = holeLength / 2;
      const a = axleSideLength + pinArea / 6 - ha;
      const bLen = pinArea / 3 - ha;
      const c = pinArea / 3 - ha;
      const d = axleSideLength + pinArea / 6;

      this.savedContext(() => {
        this.moveTo(lipSize + handleRadius + t / 2, a);
        this.text('<', 0, 0, 0, 'left', 4, ETCHING_DEEP);
      });

      this.savedContext(() => {
        this.moveTo(lipSize + handleRadius - t / 2, 0, 90);

        const zig = (): void => {
          this.savedContext(() => {
            this.moveTo(0, 0, -90);
            this.edge(t);
            this.moveTo(0, holeLength / 2, 180);
            this.edge(t / 2);
          });
        };

        for (let i = 0; i < 2; i++) {
          this.edge(a);
          if (numHoles !== 1) {
            zig();
            this.moveTo(ha);
          } else {
            this.edge(ha);
          }
          this.edge(bLen);
          if (numHoles !== 2) {
            zig();
            this.moveTo(ha);
          } else {
            this.edge(ha);
          }
          this.edge(c);
          if (numHoles !== 1) {
            zig();
            this.moveTo(ha);
          } else {
            this.edge(ha);
          }
          this.edge(d);
          this.moveTo(0, -t, 180);
        }
      });
    }

    this.move(tw, th, move, false, label);
  }

  /** Flat shuttle with a notch at each end to wind the weft onto. */
  private shuttle(shuttleLength: number, move: string): void {
    const cutoutDepth = Math.min(20, 0.2 * shuttleLength);
    const outerRadius = 2;
    const innerRadius = 4;
    const lengthEdge = shuttleLength - 2 * outerRadius;
    const cutoutEdge = cutoutDepth - outerRadius - innerRadius;

    const tw = outerRadius * 4 + innerRadius * 2;
    const th = shuttleLength;
    if (this.move(tw, th, move, true)) return;

    this.moveTo(0, outerRadius, 90);
    for (let i = 0; i < 2; i++) {
      this.edge(lengthEdge);
      this.corner(-180, outerRadius);
      this.edge(cutoutEdge);
      this.corner(180, innerRadius);
      this.edge(cutoutEdge);
      this.corner(-180, outerRadius);
    }

    this.move(tw, th, move, false, 'Shuttle');
  }

  private needle(needleLength: number, move: string, bigRadius = 3, smallRadius = 0.75): void {
    const holeClearance = 2;

    const drawNeedleShape = (length: number, big: number, small: number): void => {
      const lengthCenters = length - big - small;
      const angleR = Math.asin((big - small) / lengthCenters);
      const angle = angleR / DEG;
      const sideLength = lengthCenters * Math.cos(angleR);
      this.savedContext(() => {
        this.moveTo(0, big, -90 - angle);
        this.corner(180 + 2 * angle, big);
        this.edge(sideLength);
        this.corner(180 - 2 * angle, small);
        this.edge(sideLength);
      });
    };

    const tw = bigRadius * 2;
    const th = needleLength;
    if (this.move(tw, th, move, true)) return;

    this.savedContext(() => drawNeedleShape(needleLength, bigRadius, smallRadius));
    // The eye is a smaller needle outline cut inside the head.
    this.moveTo(bigRadius + holeClearance / 2 + 0.25, 10 + holeClearance, 180);
    drawNeedleShape(10, bigRadius - holeClearance, 0.1);

    this.move(tw, th, move, false, 'Needle');
  }

  /** Beater comb with pins matching the loom's pin spacing. */
  private comb(combNumPins: number, loomPinWidth: number, move: string): void {
    const combPinLength = 10;
    const combPinRadius = Math.max(0.5, 0.2 * loomPinWidth);
    const combGapRadius = (loomPinWidth - 2 * combPinRadius) / 2;
    const combHandleRadius = 10;

    const tw = combPinLength + combPinRadius + combGapRadius + 2 * combHandleRadius;
    const th = 2 * combHandleRadius + combNumPins * loomPinWidth;
    if (this.move(tw, th, move, true)) return;

    this.moveTo(0, combHandleRadius, -90);
    this.corner(180, combHandleRadius);
    for (let i = 0; i < combNumPins; i++) {
      this.corner(-90, combGapRadius);
      this.edge(combPinLength);
      this.corner(180, combPinRadius);
      this.edge(combPinLength);
      this.corner(-90, combGapRadius);
    }
    this.corner(180, combHandleRadius);
    this.edge(combNumPins * loomPinWidth);

    this.move(tw, th, move, false, 'Comb');
  }

  render(): void {
    const o = this.o;
    const pinWidth = o.warpSpacing;
    const footAttachmentXOffset = 8;
    const footHoleRadius = 4.25;
    const numWarpThreads = o.warpThreads;
    const frameThickness = 15;
    const transverseLength = numWarpThreads * pinWidth + 2 * frameThickness + 20;

    const { flare } = FrameLoom.pinFlare(pinWidth);
    if (o.includeFrame && !(flare > 0.0 && flare <= 90.0)) {
      // boxes.py raises here and draws nothing at all. Only the frame's pins
      // depend on it, so the port warns and carries on without the frame.
      this.warn('Warp spacing is outside the 2–5.5 mm the pin shape supports.', 'warpspacing');
    } else if (o.includeFrame) {
      this.frame(pinWidth, numWarpThreads, frameThickness, o.outerFrameLength, footAttachmentXOffset, 'right');
      this.savedContext(() => {
        this.foot(footHoleRadius, 'up');
        this.foot(footHoleRadius, 'up');
        if (o.combPins > 0) this.comb(o.combPins, pinWidth, 'up');
      });
      this.foot(footHoleRadius, 'right only');
    } else if (o.combPins > 0) {
      this.comb(o.combPins, pinWidth, 'right');
    }

    const heddle = (left: Pattern, right: Pattern, opts: HeddleOptions, label: string): void =>
      this.heddle(
        left,
        right,
        pinWidth,
        numWarpThreads,
        footAttachmentXOffset,
        footHoleRadius,
        opts,
        'right',
        label,
      );

    if (o.includeHeddle) {
      const [right, left] = heddlePatterns([0, 1], numWarpThreads, 1);
      heddle(right, left, {}, 'Heddle');
    }

    if (o.include2by2Heddle) {
      const [right, left] = heddlePatterns([1, 1, 0, 0], numWarpThreads, 2);
      const [right2, left2] = heddlePatterns([1, 0, 0, 1], numWarpThreads, 2);
      heddle(right, left, { holes: true }, '2x2 heddle');
      heddle(right2, left2, { handle: false, clipons: true }, '2x2 clip-on');
    }

    if (o.includeDiamondHeddle) {
      // boxes.py notes these differ from the original Rocket Loom's in a few
      // end teeth, without knowing why; reproduced as boxes.py draws them.
      const [up, right] = heddlePatterns([0, 1, 0, 0, 1, 1, 1, 0], numWarpThreads, 4);
      const [down, left] = heddlePatterns([1, 0, 1, 1, 0, 0, 0, 1], numWarpThreads, 4);
      heddle(up, down, { holes: true }, 'Diamond heddle');
      heddle(right, left, { handle: false, clipons: true }, 'Diamond clip-on');
    }

    if (o.includeNeedles) {
      this.needle(transverseLength, 'right');
      this.needle(50, 'right');
    }

    for (let i = 0; i < o.numShuttles; i++) this.shuttle(transverseLength, 'right');
  }
}

export const frameLoom: GeneratorDef = {
  meta: {
    id: 'frameloom',
    name: 'Frame Loom',
    group: 'Misc',
    summary: 'Flat weaving loom with a turning heddle bar',
    description:
      'A frame loom with numbered pins at each end, two snap-in feet and a heddle ' +
      'bar that turns in them to open the shed. Pattern heddles for 2×2 and diamond ' +
      'weaves, a comb, needles and shuttles are included; at sizes near the defaults ' +
      'they all fit inside the frame’s window. Sand the heddle, shuttles and needles ' +
      'smooth so they do not catch the yarn. Glue each pattern heddle pair with the ' +
      'etched > and < facing each other.',
  },
  params: [
    {
      key: 'warpthreads',
      kind: 'number',
      label: 'Warp threads',
      default: 38,
      min: 2,
      max: 120,
      step: 1,
      group: 'dimensions',
      help: 'Maximum number of threads in the warp. Sets the width of the frame.',
    },
    {
      key: 'warpspacing',
      kind: 'length',
      label: 'Warp spacing',
      unit: 'mm',
      default: 3.5,
      min: 2,
      max: 5.5,
      step: 0.1,
      group: 'dimensions',
      help: 'Distance between pins. The pin shape only works from 2 to 5.5 mm.',
    },
    {
      key: 'outerframelength',
      kind: 'length',
      label: 'Frame length',
      unit: 'mm',
      default: 235,
      // The window's lower sides are length - 98 mm; leave them some room.
      min: 110,
      max: 1000,
      step: 1,
      group: 'dimensions',
    },
    { key: 'includeframe', kind: 'bool', label: 'Frame and feet', default: true, group: 'dimensions' },
    { key: 'includeheddle', kind: 'bool', label: 'Plain heddle', default: true, group: 'dimensions' },
    {
      key: 'include2by2heddle',
      kind: 'bool',
      label: '2×2 pattern heddle',
      default: false,
      group: 'dimensions',
    },
    {
      key: 'includediamondheddle',
      kind: 'bool',
      label: 'Diamond pattern heddle',
      default: false,
      group: 'dimensions',
    },
    { key: 'includeneedles', kind: 'bool', label: 'Needles', default: true, group: 'dimensions' },
    {
      key: 'combpins',
      kind: 'number',
      label: 'Comb pins',
      default: 12,
      min: 0,
      max: 60,
      step: 1,
      group: 'dimensions',
      help: 'Zero leaves the comb out. For bracelets, use one fewer than your warp threads.',
    },
    {
      key: 'numshuttles',
      kind: 'number',
      label: 'Shuttles',
      default: 2,
      min: 0,
      max: 10,
      step: 1,
      group: 'dimensions',
    },
  ],
  create: (v: ParamValues, config: BoxesConfig) =>
    new FrameLoom(
      {
        warpThreads: n(v, 'warpthreads', 38),
        warpSpacing: n(v, 'warpspacing', 3.5),
        outerFrameLength: n(v, 'outerframelength', 235),
        includeFrame: b(v, 'includeframe', true),
        includeHeddle: b(v, 'includeheddle', true),
        include2by2Heddle: b(v, 'include2by2heddle', false),
        includeDiamondHeddle: b(v, 'includediamondheddle', false),
        includeNeedles: b(v, 'includeneedles', true),
        combPins: n(v, 'combpins', 12),
        numShuttles: n(v, 'numshuttles', 2),
      },
      config,
    ),
};
