/**
 * Agricola insert — ported from boxes.py
 * `boxes/generators/agricolainsert.py` (class `AgricolaInsert`).
 *
 * A fixed set of trays and boxes that fit the Agricola Revised Edition game
 * box with the Farmers of the Moor and 5–6 player expansions. Every size is
 * built in; only the material and joints can be changed.
 */
import { Boxes, type BoxesConfig, type Callback } from '../boxes';
import { BaseEdge, NoopEdge } from '../edges/base';
import type { ParamValues } from '../params/schema';
import { DividerSlotsEdge, generateAllSameAngles } from './dividertray';
import type { GeneratorDef } from './types';

const DEG = Math.PI / 180;

/** Top of the moor box's long sides, with one corner lowered for the tokens. */
class MoorBoxSideEdge extends BaseEdge {
  constructor(
    boxes: Boxes,
    private cornerLength: number,
    private cornerHeight: number,
    private lowerCorner: boolean,
  ) {
    super(boxes, null);
  }

  call(length: number): void {
    const radius = this.cornerHeight / 2;
    if (this.lowerCorner) {
      this.polyline(length - this.cornerHeight - this.cornerLength, [90, radius], 0, [-90, radius], this.cornerLength);
    } else {
      this.polyline(length);
    }
  }

  override startWidth(): number {
    return this.cornerHeight;
  }

  override endWidth(): number {
    return this.lowerCorner ? 0.0 : this.cornerHeight;
  }
}

/** Top of the moor box's ends: a finger notch into each row of tiles. */
class MoorBoxHoleEdge extends BaseEdge {
  constructor(
    boxes: Boxes,
    private height: number,
    private cornerHeight: number,
    private lowerCorner: boolean,
  ) {
    super(boxes, null);
  }

  call(length: number): void {
    const oneSideWidth = (length - this.thickness) / 2;
    const notchWidth = 20;
    const radius = 6;
    const upperEdge = (oneSideWidth - notchWidth - 2 * radius) / 2;
    const holeStart = 10;
    const loweredHoleStart = 2;
    const holeDepth = this.height - 2 * radius;
    const lowerEdge = notchWidth - 2 * radius;

    const oneSidePolyline = (margin1: number, margin2: number): Array<number | [number, number]> => [
      upperEdge, [90, radius],
      holeDepth - margin1, [-90, radius],
      lowerEdge, [-90, radius],
      holeDepth - margin2, [90, radius],
      upperEdge,
    ];

    const normalSide = oneSidePolyline(holeStart, holeStart);
    const cornerSide = oneSidePolyline(loweredHoleStart, loweredHoleStart + this.cornerHeight);

    this.polyline(...normalSide, 0, this.thickness, 0, ...(this.lowerCorner ? cornerSide : normalSide));
  }

  override startWidth(): number {
    return this.cornerHeight;
  }

  override endWidth(): number {
    return this.lowerCorner ? 0.0 : this.cornerHeight;
  }
}

/** The head of a player's box: a notch for lifting the bed out. */
class BedHeadEdge extends BaseEdge {
  constructor(
    boxes: Boxes,
    private holeDepth: number,
  ) {
    super(boxes, null);
  }

  call(length: number): void {
    const holeLength = 16;
    const upperCorner = 10;
    const lowerCorner = 6;
    const depth = this.holeDepth - upperCorner - lowerCorner;
    const upperEdge = (length - holeLength - 2 * upperCorner) / 2;
    const lowerEdge = holeLength - 2 * lowerCorner;

    this.polyline(
      upperEdge, [90, upperCorner],
      depth, [-90, lowerCorner],
      lowerEdge, [-90, lowerCorner],
      depth, [90, upperCorner],
      upperEdge,
    );
  }
}

/**
 * A bed-shaped outline across two sides of the wall, skipping the corner
 * between them; the next edge must be a NoopEdge.
 */
class Bed2SidesEdge extends BaseEdge {
  constructor(
    boxes: Boxes,
    private bedLength: number,
    private fullHeadLength: number,
    private fullFootHeight: number,
  ) {
    super(boxes, null);
  }

  call(bedHeight: number): void {
    const footCorner = 6;
    const middleCorner = 3;
    const headCorner = 10;
    const footHeight = this.fullFootHeight - this.thickness - footCorner;
    const headLength = this.fullHeadLength - headCorner - this.thickness;
    const corners = footCorner + middleCorner + headCorner;
    const headHeight = bedHeight - footHeight - corners;
    const middleLength = this.bedLength - headLength - corners;

    this.polyline(
      footHeight, [90, footCorner],
      middleLength, [-90, middleCorner],
      headHeight, [90, headCorner],
      headLength,
    );
  }
}

class AgricolaInsert extends Boxes {
  constructor(config: Partial<BoxesConfig>) {
    super(config);
  }

  /**
   * boxes.py labels none of the parts, so they are named through a callback:
   * a label would print on the sheet. `fn` is the wall's own first callback.
   */
  private named(name: string, fn?: () => void): Callback {
    return [
      () => {
        this.ctx.nameCurrentPart(name);
        fn?.();
      },
    ];
  }

  render(): void {
    const t = this.thickness;
    const playerBoxHeight = 34.5;
    const playerBoxInnerWidth = 50.5;
    const biggerBoxInnerHeight = 36.7;
    const rowWidth = 37.2;
    const trayInnerHeight = 17;
    const boxWidth = 218;
    const cardTrayHeight = t * 2 + trayInnerHeight + biggerBoxInnerHeight;
    const cardTrayWidth = 305.35 - playerBoxInnerWidth * 2 - rowWidth * 2 - 9 * t;

    this.renderCardDividerTray(cardTrayHeight, boxWidth, cardTrayWidth);
    this.renderUpperTokenTrays(trayInnerHeight, boxWidth);
    const woodRoomBoxWidth = 39.8;
    this.renderRoomBox(woodRoomBoxWidth, biggerBoxInnerHeight, rowWidth);
    const stoneRoomBoxWidth = 26.7;
    this.renderRoomBox(stoneRoomBoxWidth, biggerBoxInnerHeight, rowWidth);
    const moorBoxLength = 84.6;
    this.renderMoorBox(biggerBoxInnerHeight, playerBoxHeight, rowWidth, moorBoxLength);
    const horseBoxMargin = 0.5;
    const horseBoxLength = boxWidth - woodRoomBoxWidth - stoneRoomBoxWidth - moorBoxLength - 6 * t - horseBoxMargin;
    this.renderHorseBox(playerBoxHeight, rowWidth, horseBoxLength);
    for (let i = 0; i < 6; i++) {
      this.renderPlayerBox(playerBoxHeight, playerBoxInnerWidth);
    }
  }

  /** The card tray and its dividers. The cards lean back, to save height. */
  private renderCardDividerTray(cardTrayHeight: number, cardTrayLength: number, cardTrayWidth: number): void {
    const t = this.thickness;
    this.ctx.save();

    const trayInnerLength = cardTrayLength - t;
    // 3 leaves more room for the score sheet.
    const marginForScoreSheet = 0;
    const sleevedCardsWidth = 62 + marginForScoreSheet;

    const rad = Math.acos(cardTrayHeight / sleevedCardsWidth);
    const angle = rad / DEG;
    const cos = Math.cos(rad);
    const tan = Math.tan(rad);
    const sin = Math.sin(rad);

    const slotsNumber = 19;
    const slotDepth = 30;
    const slotDescriptions = generateAllSameAngles(
      Array.from({ length: slotsNumber }, () => trayInnerLength / slotsNumber),
      t,
      0.2,
      slotDepth,
      cardTrayHeight,
      angle,
      2,
    );
    slotDescriptions.adjustToTargetLength(trayInnerLength);

    const slopedWallHeight = sleevedCardsWidth - t * (tan + 1 / tan);
    const slopedWallPosxAtY0 = trayInnerLength - slopedWallHeight * tan - cos * t;
    const slopedWallPosx = slopedWallPosxAtY0 + (cos * t) / 2;
    const slopedWallPosy = (sin * t) / 2;

    const dse = new DividerSlotsEdge(this, slotDescriptions.descriptions);
    for (let i = 0; i < 2; i++) {
      this.rectangularWall(trayInnerLength, cardTrayHeight, ['e', 'e', dse, 'f'], {
        move: 'up',
        callback: this.named('card tray side', () =>
          this.fingerHolesAt(slopedWallPosx, slopedWallPosy, slopedWallHeight, 90 - angle),
        ),
      });
    }

    const spacerHeight = cardTrayHeight / 2;
    const spacerSpacing = cardTrayWidth - 99.8;
    const spacerUpperWidth = slopedWallPosxAtY0 + spacerHeight * tan;
    this.trapezoidWall(spacerHeight, spacerUpperWidth, slopedWallPosxAtY0, 'fefe', {
      move: 'up rotated',
      callback: this.named('card tray spacer'),
    });

    this.rectangularWall(cardTrayWidth, cardTrayHeight, 'eFeF', {
      move: 'up',
      callback: this.named('card tray end', () => this.fingerHolesAt(spacerSpacing - t / 2, 0, spacerHeight)),
    });
    this.rectangularWall(cardTrayWidth, slopedWallHeight, 'efef', {
      move: 'up',
      callback: this.named('card tray sloped wall', () =>
        this.generateCardTraySlopedWallHoles(cardTrayWidth, slopedWallHeight, spacerHeight, spacerSpacing, rad),
      ),
    });

    this.ctx.restore();
    this.rectangularWall(cardTrayLength, 0, 'FFFF', { move: 'right only' });
    this.ctx.save();

    const dividerHeight = sleevedCardsWidth - t * tan;
    this.generateDivider(cardTrayWidth, dividerHeight, slotDepth, spacerSpacing, 'up');
    this.explain([
      'Wood divider',
      'Hard separation to keep the card',
      'from slipping in empty space left.',
      'Takes more space, but won\'t move.',
      'Duplicate as much as you want',
      '(I use 2).',
    ]);

    this.ctx.restore();
    this.rectangularWall(cardTrayWidth, 0, 'ffff', { move: 'right only' });
    this.ctx.save();

    this.generatePaperDivider(cardTrayWidth, sleevedCardsWidth, slotDepth, spacerSpacing, 'up');
    this.explain([
      'Paper divider',
      'Soft separation to search easily',
      'the card group you need',
      '(by expansion, number of player,',
      'etc.).',
      'Duplicate as much as you want',
      '(I use 7).',
    ]);
    this.ctx.restore();
    this.rectangularWall(cardTrayWidth, 0, 'ffff', { move: 'right only' });
  }

  private explain(strings: string[]): void {
    this.text(strings.join('\n'), 0, 0, 0, 'bottom left', 7);
    // Drawn outside any move, so it sits in a part of its own.
    this.ctx.nameCurrentPart('notes');
  }

  private generateCardTraySlopedWallHoles(
    sideWallLength: number,
    slopedWallHeight: number,
    spacerHeight: number,
    spacerSpacing: number,
    rad: number,
  ): void {
    const t = this.thickness;
    // Spacer finger holes; the sloped wall doesn't quite reach the bottom
    // of the spacer.
    this.fingerHolesAt(sideWallLength - (spacerSpacing - t / 2), -t * Math.tan(rad), spacerHeight / Math.cos(rad));

    // Big hole to reach the space lost behind the sloped wall.
    const radius = 5;
    const padding = 8;
    const totalLoss = 2 * radius + 2 * padding;
    this.moveTo(radius + padding, padding);
    this.polyline(
      sideWallLength - totalLoss, [90, radius],
      slopedWallHeight - totalLoss, [90, radius],
      sideWallLength - totalLoss, [90, radius],
      slopedWallHeight - totalLoss, [90, radius],
    );
  }

  /** A paper card divider, free to move in the tray. */
  private generatePaperDivider(width: number, height: number, slotDepth: number, spacerSpacing: number, move: string): void {
    if (this.move(width, height, move, true)) return;

    const margin = 0.5;
    const actualWidth = width - margin;
    this.polyline(
      actualWidth - spacerSpacing, 90,
      height - slotDepth, -90,
      spacerSpacing, 90,
      slotDepth, 90,
      actualWidth, 90,
      height, 90,
    );

    this.ctx.nameCurrentPart('paper divider');
    this.move(width, height, move);
  }

  /** A wooden card divider, sliding in the side walls' slots. */
  private generateDivider(width: number, height: number, slotDepth: number, spacerSpacing: number, move: string): void {
    const t = this.thickness;
    const totalWidth = width + 2 * t;

    if (this.move(totalWidth, height, move, true)) return;

    const radius = 16;
    const padding = 20;
    const dividerNotchDepth = 35;

    this.polyline(
      t + spacerSpacing + padding - radius, [90, radius],
      dividerNotchDepth - radius - radius, [-90, radius],
      width - 2 * radius - 2 * padding - spacerSpacing, [-90, radius],
      dividerNotchDepth - radius - radius, [90, radius],
      t + padding - radius, 90,
      slotDepth, 90,
      t, -90,
      height - slotDepth, 90,
      width - spacerSpacing, 90,
      height - slotDepth, -90,
      t + spacerSpacing, 90,
      slotDepth,
    );

    this.ctx.nameCurrentPart('wood divider');
    this.move(totalWidth, height, move);
  }

  /** The horses' box on the lower level, as high as the player boxes. */
  private renderHorseBox(playerBoxHeight: number, rowWidth: number, width: number): void {
    const length = 2 * rowWidth + 3 * this.thickness;
    this.renderSimpleTray(width, length, playerBoxHeight, 0, 'horse box');
  }

  /**
   * The box for the moor and forest tiles and the multi-resource tokens. The
   * tokens' corner is lowered to the player boxes' height, to take two
   * layers of small boards above it.
   */
  private renderMoorBox(biggerBoxInnerHeight: number, playerBoxHeight: number, rowWidth: number, length: number): void {
    const t = this.thickness;
    this.ctx.save();
    const height = biggerBoxInnerHeight;
    const loweredHeight = playerBoxHeight - t;
    const loweredCornerHeight = height - loweredHeight;
    const cornerLength = 53.5;

    this.rectangularWall(length, 2 * rowWidth + t, 'FfFf', {
      move: 'up',
      callback: this.named('moor box bottom', () => this.fingerHolesAt(0, rowWidth + 0.5 * t, length, 0)),
    });

    for (let i = 0; i < 2; i++) {
      this.rectangularWall(
        length,
        loweredHeight,
        ['f', 'f', new MoorBoxSideEdge(this, cornerLength, loweredCornerHeight, i % 2 === 0), 'f'],
        { move: 'up', callback: this.named('moor box side') },
      );
    }
    this.rectangularWall(length, height / 2, 'ffef', { move: 'up', callback: this.named('moor box divider') });

    for (let i = 0; i < 2; i++) {
      this.rectangularWall(
        2 * rowWidth + t,
        loweredHeight,
        ['F', 'F', new MoorBoxHoleEdge(this, height, loweredCornerHeight, i % 2 === 0), 'F'],
        { move: 'up', callback: this.named('moor box end', () => this.generateSideFingerHoles(rowWidth, height / 2)) },
      );
    }

    this.ctx.restore();
    this.rectangularWall(length, 0, 'FFFF', { move: 'right only' });
  }

  private generateSideFingerHoles(rowWidth: number, height: number): void {
    this.fingerHolesAt(rowWidth + 0.5 * this.thickness, 0, height);
  }

  /** A box for room and field tiles. */
  private renderRoomBox(width: number, height: number, rowWidth: number): void {
    const t = this.thickness;
    const borderHeight = 12;
    const roomBoxLength = rowWidth * 2 + t;

    this.ctx.save();

    this.rectangularWall(roomBoxLength, height, 'eFfF', {
      move: 'up',
      callback: this.named('room box back', () => this.generateSideFingerHoles(rowWidth, height)),
    });

    this.rectangularWall(roomBoxLength, width, 'FFfF', {
      move: 'up',
      callback: this.named('room box bottom', () => this.generateSideFingerHoles(rowWidth, width)),
    });

    this.rectangularWall(roomBoxLength, borderHeight, 'FFeF', {
      move: 'up',
      callback: this.named('room box front', () => this.generateSideFingerHoles(rowWidth, borderHeight)),
    });

    for (let i = 0; i < 3; i++) {
      this.trapezoidWall(width, height, borderHeight, 'ffef', { move: 'up', callback: this.named('room box side') });
    }

    this.ctx.restore();

    this.rectangularWall(roomBoxLength, 0, 'FFFF', { move: 'right only' });
  }

  /**
   * A box for one player's pieces, built round the cardboard bed from
   * Farmers of the Moor.
   */
  private renderPlayerBox(playerBoxHeight: number, playerBoxInnerWidth: number): void {
    const t = this.thickness;
    this.ctx.save();
    const bedInnerHeight = playerBoxHeight - t;
    const bedInnerLength = 66.75;
    const bedInnerWidth = playerBoxInnerWidth;
    const cardboardBedFootHeight = 6.5;
    const cardboardBedHoleMargin = 5;
    const cardboardBedHoleLength = 12;
    const bedHeadLength = 20;
    const bedFootHeight = 18;
    const supportLength = 38;

    const bedEdge = new Bed2SidesEdge(this, bedInnerLength, bedHeadLength, bedFootHeight);
    const noopEdge = new NoopEdge(this);
    this.ctx.save();
    // The two sides nest, one turned round against the other.
    const optim180X = bedInnerLength + t + bedHeadLength + 2 * this.spacing;
    const optim180Y = 2 * bedFootHeight - playerBoxHeight + 2 * this.spacing;
    for (let i = 0; i < 2; i++) {
      this.rectangularWall(bedInnerLength, bedInnerHeight, ['F', bedEdge, noopEdge, 'F'], {
        move: 'up',
        callback: this.named('player box side'),
      });
      this.moveTo(optim180X, optim180Y, -180);
    }
    this.ctx.restore();
    this.moveTo(0, bedInnerHeight + t + this.spacing + optim180Y);

    this.rectangularWall(bedInnerLength, bedInnerWidth, 'feff', {
      move: 'up',
      callback: this.named('player box bottom', () =>
        this.generateBedHoles(bedInnerWidth, cardboardBedHoleMargin, cardboardBedHoleLength, supportLength),
      ),
    });

    this.ctx.save();
    this.rectangularWall(bedInnerWidth, bedInnerHeight, ['F', 'f', new BedHeadEdge(this, bedInnerHeight - 15), 'f'], {
      move: 'right',
      callback: this.named('player box head'),
    });
    for (let i = 0; i < 2; i++) {
      this.rectangularWall(cardboardBedFootHeight - t, supportLength, 'efee', {
        move: 'right',
        callback: this.named('bed support'),
      });
    }
    this.ctx.restore();
    this.rectangularWall(bedInnerWidth, bedInnerHeight, 'Ffef', { move: 'up only' });

    this.ctx.restore();
    this.rectangularWall(bedInnerLength + bedHeadLength + this.spacing - t, 0, 'FFFF', { move: 'right only' });
  }

  private generateBedHoles(width: number, margin: number, holeLength: number, supportLength: number): void {
    const t = this.thickness;
    const supportStart = margin + holeLength;

    const bedWidth = 29.5;
    const bedSpaceToWall = (width - bedWidth) / 2;
    const bedFeetWidth = 3;

    const posy1 = bedSpaceToWall;
    const posy2 = width - bedSpaceToWall;

    for (const [y, direction] of [
      [posy1, 1],
      [posy2, -1],
    ] as const) {
      const bedFeetMiddleY = y + (direction * bedFeetWidth) / 2;
      const supportMiddleY = y + (direction * t) / 2;
      this.rectangularHole(margin, bedFeetMiddleY, holeLength, bedFeetWidth, 0, false);
      this.fingerHolesAt(supportStart, supportMiddleY, supportLength, 0);
      this.rectangularHole(supportStart + supportLength, bedFeetMiddleY, holeLength, bedFeetWidth, 0, false);
    }
  }

  /** The upper level: a tray for each group of resources, bar the horses. */
  private renderUpperTokenTrays(trayInnerHeight: number, boxWidth: number): void {
    const trayHeight = trayInnerHeight + this.thickness;
    const upperLevelWidth = 196;
    const upperLevelLength = boxWidth;
    const rowWidth = upperLevelWidth / 3;

    this.renderSimpleTray(rowWidth, upperLevelLength, trayHeight, 3, 'stone, vegetable, pig, cow tray');
    this.renderSimpleTray(rowWidth, (upperLevelLength * 2) / 3, trayHeight, 2, 'reed, grain, sheep tray');
    this.renderSimpleTray(rowWidth, (upperLevelLength * 2) / 3, trayHeight, 1, 'wood, clay tray');
    this.renderSimpleTray(upperLevelLength / 3, rowWidth * 2, trayHeight, 1, 'food, fire tray');
  }

  /** An open tray with movable dividers. */
  private renderSimpleTray(outerWidth: number, outerLength: number, outerHeight: number, dividers: number, name: string): void {
    const t = this.thickness;
    const width = outerWidth - 2 * t;
    const length = outerLength - 2 * t;
    const height = outerHeight - t;
    this.ctx.save();
    this.rectangularWall(width, length, 'FFFF', { move: 'up', callback: this.named(`${name} bottom`) });
    for (let i = 0; i < 2; i++) {
      this.rectangularWall(width, height, 'ffef', { move: 'up', callback: this.named(`${name} end`) });
    }
    this.ctx.restore();
    this.rectangularWall(width, length, 'FFFF', { move: 'right only' });
    for (let i = 0; i < 2; i++) {
      this.rectangularWall(height, length, 'FfFe', { move: 'right', callback: this.named(`${name} side`) });
    }

    if (dividers) {
      this.ctx.save();
      for (let i = 0; i < dividers; i++) {
        this.renderSimpleTrayDivider(width, height, 'up');
      }
      this.ctx.restore();
      this.renderSimpleTrayDivider(width, height, 'right only');
    }
  }

  /** A movable divider, with small feet to stand it up. */
  private renderSimpleTrayDivider(width: number, height: number, move: string): void {
    if (this.move(height, width, move, true)) return;

    const t = this.thickness;
    this.polyline(
      height - t, 90,
      t, -90,
      t, 90,
      width - 2 * t, 90,
      t, -90,
      t, 90,
      height - t, 90,
      width, 90,
    );

    this.ctx.nameCurrentPart('tray divider');
    this.move(height, width, move);

    this.renderSimpleTrayDividerFeet(width, height, move);
  }

  private renderSimpleTrayDividerFeet(_width: number, height: number, move: string): void {
    const sqr2 = Math.SQRT2;
    const t = this.thickness;
    const dividerFootWidth = 2 * t;
    const fullWidth = t + 2 * dividerFootWidth;
    const moveLength = this.spacing + fullWidth / sqr2;
    const moveWidth = this.spacing + Math.max(fullWidth, height);

    if (this.move(moveWidth, moveLength, move, true)) return;

    this.ctx.save();
    this.polyline(
      sqr2 * dividerFootWidth, 135,
      t, -90,
      t, -90,
      t, 135,
      sqr2 * dividerFootWidth, 135,
      fullWidth, 135,
    );
    this.ctx.restore();

    // The second foot nests upside down against the first, sharing a cut.
    this.moveTo(-this.burn / sqr2, this.burn * (1 + 1 / sqr2), 45);
    this.moveTo(fullWidth);

    this.polyline(
      0, 135,
      sqr2 * dividerFootWidth, 135,
      t, -90,
      t, -90,
      t, 135,
      sqr2 * dividerFootWidth, 135,
    );

    this.ctx.nameCurrentPart('divider feet');
    this.move(moveWidth, moveLength, move);
  }
}

export const agricolaInsert: GeneratorDef = {
  meta: {
    id: 'agricolainsert',
    name: 'Agricola Insert',
    group: 'Misc',
    summary: 'Insert for the Agricola Revised Edition board game box',
    description:
      'Trays and boxes that store Agricola Revised Edition with the Farmers ' +
      'of the Moor expansion, and should take the 5–6 player expansion too. ' +
      'It fits in the game box with the lid slightly raised. Made for 3 mm ' +
      'plywood; the sizes are fixed. A card tray with wood and paper ' +
      'dividers, four resource trays with movable dividers, a horse box, two ' +
      'room and field tile boxes, a moor and forest tile box, and six player ' +
      'boxes built round the cardboard beds.',
  },
  // A smaller edge margin keeps fingers on the short walls.
  paramDefaults: { fj_surroundingspaces: 1 },
  params: [],
  create: (_v: ParamValues, config: BoxesConfig) => new AgricolaInsert(config),
};
