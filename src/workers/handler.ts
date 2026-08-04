/**
 * Request handling, shared by the worker and the synchronous fallback.
 *
 * Keeping it here means there is one implementation regardless of whether a
 * Worker is available — the fallback path cannot silently drift.
 */
import { toLBRN2 } from '../lib/export/lbrn2';
import { toSVG } from '../lib/export/svg';
import { buildDrawing, toPreview } from '../lib/preview';
import type { ExportRequest, WorkerRequest, WorkerResponse } from './protocol';

function slug(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'box';
}

function runExport(req: ExportRequest): WorkerResponse {
  const drawing = buildDrawing(req.generator, req.values);
  const title = req.title ?? req.generator;
  const common = { layers: req.layers, permalink: req.permalink, title };

  if (req.format === 'lbrn2') {
    return {
      id: req.id,
      kind: 'export',
      ok: true,
      data: {
        filename: `${slug(title)}.lbrn2`,
        mime: 'application/xml',
        text: toLBRN2(drawing, { ...common, material: req.material }),
      },
    };
  }

  return {
    id: req.id,
    kind: 'export',
    ok: true,
    data: {
      filename: `${slug(title)}.svg`,
      mime: 'image/svg+xml',
      text: toSVG(drawing, common),
    },
  };
}

export function handleRequest(req: WorkerRequest): WorkerResponse {
  try {
    if (req.kind === 'preview') {
      return {
        id: req.id,
        kind: 'preview',
        ok: true,
        data: toPreview(buildDrawing(req.generator, req.values)),
      };
    }
    return runExport(req);
  } catch (err) {
    return {
      id: req.id,
      kind: req.kind,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
