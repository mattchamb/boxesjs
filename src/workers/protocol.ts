/** Messages exchanged with the render worker. */
import type { Layer } from '../lib/geom/colors';
import type { Material } from '../lib/materials';
import type { ParamValues } from '../lib/params/schema';
import type { LayoutSuggestion } from '../lib/layout/pack';
import type { NestResult } from '../lib/layout/nest';
import type { PreviewData } from '../lib/preview';

export type ExportFormat = 'svg' | 'lbrn2';

export interface PreviewRequest {
  id: number;
  kind: 'preview';
  generator: string;
  values: ParamValues;
  /** An optimised layout, used if it was made for these values. */
  nest?: NestResult | null;
}

export interface ExportRequest {
  id: number;
  kind: 'export';
  generator: string;
  values: ParamValues;
  nest?: NestResult | null;
  format: ExportFormat;
  material: Material;
  layers?: Layer[];
  permalink?: string;
  title?: string;
}

/** Search for the sheet size and copy count that waste least; slower than a preview. */
export interface LayoutRequest {
  id: number;
  kind: 'layout';
  generator: string;
  values: ParamValues;
}

export type WorkerRequest = PreviewRequest | ExportRequest | LayoutRequest;

export interface ExportResult {
  filename: string;
  mime: string;
  text: string;
}

export type WorkerResponse =
  | { id: number; kind: 'preview'; ok: true; data: PreviewData }
  | { id: number; kind: 'export'; ok: true; data: ExportResult }
  | { id: number; kind: 'layout'; ok: true; data: LayoutSuggestion | null }
  | { id: number; kind: 'preview' | 'export' | 'layout'; ok: false; error: string };

/** Nesting runs in a worker of its own, one per search, so previews never wait on it. */
export interface NestRequest {
  generator: string;
  values: ParamValues;
  budgetMs: number;
}

export type NestMessage =
  | { kind: 'progress'; best: NestResult; elapsedMs: number }
  | { kind: 'done'; ok: true; result: NestResult | null }
  | { kind: 'done'; ok: false; error: string };
