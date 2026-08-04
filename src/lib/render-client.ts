/**
 * Talks to the render worker.
 *
 * Scheduling is latest-wins: while a render is in flight, newer parameter
 * changes replace each other rather than queueing. Dragging a slider therefore
 * produces a steady stream of current frames instead of working through a
 * backlog of stale ones, and releasing it always lands on the final value.
 */
import { handleRequest } from '../workers/handler';
import type {
  ExportRequest,
  ExportResult,
  WorkerRequest,
  WorkerResponse,
} from '../workers/protocol';
import type { PreviewData } from './preview';
import type { ParamValues } from './params/schema';

export interface PreviewJob {
  generator: string;
  values: ParamValues;
}

export type PreviewListener = (
  result: { ok: true; data: PreviewData } | { ok: false; error: string },
) => void;

export class RenderClient {
  private worker: Worker | null = null;
  private nextId = 1;
  private inflight: number | null = null;
  /** Newest job seen while a render was running. */
  private queued: PreviewJob | null = null;
  private listener: PreviewListener | null = null;
  private exports = new Map<number, (r: WorkerResponse) => void>();

  constructor() {
    if (typeof Worker !== 'undefined') {
      try {
        this.worker = new Worker(new URL('../workers/render.worker.ts', import.meta.url), {
          type: 'module',
        });
        this.worker.onmessage = (e: MessageEvent<WorkerResponse>) => this.receive(e.data);
        this.worker.onerror = () => {
          // A worker that fails to start must not take the page down with it.
          this.worker = null;
        };
      } catch {
        this.worker = null;
      }
    }
  }

  onPreview(listener: PreviewListener): void {
    this.listener = listener;
  }

  /** Request a preview. Safe to call on every keystroke or pointer move. */
  requestPreview(job: PreviewJob): void {
    if (this.inflight !== null) {
      this.queued = job;
      return;
    }
    this.dispatch(job);
  }

  private dispatch(job: PreviewJob): void {
    const req: WorkerRequest = {
      id: this.nextId++,
      kind: 'preview',
      generator: job.generator,
      values: job.values,
    };
    this.inflight = req.id;

    if (this.worker) {
      this.worker.postMessage(req);
    } else {
      // No worker: still yield to the event loop so typing stays responsive.
      queueMicrotask(() => this.receive(handleRequest(req)));
    }
  }

  private receive(res: WorkerResponse): void {
    if (res.kind === 'export') {
      this.exports.get(res.id)?.(res);
      this.exports.delete(res.id);
      return;
    }

    // Ignore anything superseded while it was in flight.
    if (res.id === this.inflight) {
      this.inflight = null;
      if (res.ok) this.listener?.({ ok: true, data: res.data });
      else this.listener?.({ ok: false, error: res.error });
    }

    if (this.inflight === null && this.queued) {
      const next = this.queued;
      this.queued = null;
      this.dispatch(next);
    }
  }

  /** One-off export. Runs on the worker so a big file cannot freeze the page. */
  requestExport(req: Omit<ExportRequest, 'id' | 'kind'>): Promise<ExportResult> {
    const id = this.nextId++;
    const full: ExportRequest = { ...req, id, kind: 'export' };

    return new Promise<ExportResult>((resolve, reject) => {
      this.exports.set(id, (res) => {
        if (res.ok && res.kind === 'export') resolve(res.data);
        else reject(new Error(res.ok ? 'Unexpected response' : res.error));
      });

      if (this.worker) this.worker.postMessage(full);
      else queueMicrotask(() => this.receive(handleRequest(full)));
    });
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
    this.listener = null;
    this.exports.clear();
  }
}
