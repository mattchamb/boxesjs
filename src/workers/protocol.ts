/** Messages exchanged with the render worker. */
import type { Layer } from '../lib/geom/colors';
import type { Material } from '../lib/materials';
import type { ParamValues } from '../lib/params/schema';
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

export type WorkerRequest = PreviewRequest | ExportRequest;

export interface ExportResult {
  filename: string;
  mime: string;
  text: string;
}

export type WorkerResponse =
  | { id: number; kind: 'preview'; ok: true; data: PreviewData }
  | { id: number; kind: 'export'; ok: true; data: ExportResult }
  | { id: number; kind: 'preview' | 'export'; ok: false; error: string };
