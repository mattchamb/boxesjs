/** Messages exchanged with the render worker. */
import type { Layer } from '../lib/geom/colors';
import type { Material } from '../lib/materials';
import type { ParamValues } from '../lib/params/schema';
import type { CopiesSuggestion } from '../lib/layout/pack';
import type { PreviewData } from '../lib/preview';

export type ExportFormat = 'svg' | 'lbrn2';

export interface PreviewRequest {
  id: number;
  kind: 'preview';
  generator: string;
  values: ParamValues;
}

export interface ExportRequest {
  id: number;
  kind: 'export';
  generator: string;
  values: ParamValues;
  format: ExportFormat;
  material: Material;
  layers?: Layer[];
  permalink?: string;
  title?: string;
}

/** Search for the copy count that wastes least; slower than a preview. */
export interface CopiesRequest {
  id: number;
  kind: 'copies';
  generator: string;
  values: ParamValues;
}

export type WorkerRequest = PreviewRequest | ExportRequest | CopiesRequest;

export interface ExportResult {
  filename: string;
  mime: string;
  text: string;
}

export type WorkerResponse =
  | { id: number; kind: 'preview'; ok: true; data: PreviewData }
  | { id: number; kind: 'export'; ok: true; data: ExportResult }
  | { id: number; kind: 'copies'; ok: true; data: CopiesSuggestion | null }
  | { id: number; kind: 'preview' | 'export' | 'copies'; ok: false; error: string };
