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
  NestMessage,
  NestRequest,
  WorkerRequest,
  WorkerResponse,
} from '../workers/protocol';
import type { NestResult } from './layout/nest';
import type { LayoutSuggestion } from './layout/pack';
import { optimiseLayout, type PreviewData } from './preview';
import type { ParamValues } from './params/schema';

export interface PreviewJob {
  generator: string;
  values: ParamValues;
  /** An optimised layout, used if it was made for these values. */
  nest?: NestResult | null;
}

/** A layout search under way. */
export interface Optimising {
  /** The best layout found, once the search ends or is stopped. */
  done: Promise<NestResult | null>;
  /** End the search now, keeping the best layout found so far. */
  stop(): void;
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
  /** Exports and layout searches waiting on the worker, by request id. */
  private pending = new Map<number, (r: WorkerResponse) => void>();

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
      nest: job.nest,
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
    if (res.kind !== 'preview') {
      this.pending.get(res.id)?.(res);
      this.pending.delete(res.id);
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
      this.pending.set(id, (res) => {
        if (res.ok && res.kind === 'export') resolve(res.data);
        else reject(new Error(res.ok ? 'Unexpected response' : res.error));
      });

      if (this.worker) this.worker.postMessage(full);
      else queueMicrotask(() => this.receive(handleRequest(full)));
    });
  }

  /**
   * Search for the sheet size and copy count that waste least. It packs the
   * design many times over, so callers should ask once the parameters have
   * settled rather than on every change, or previews would queue behind it.
   */
  requestLayout(job: PreviewJob): Promise<LayoutSuggestion | null> {
    const id = this.nextId++;
    const req: WorkerRequest = { id, kind: 'layout', generator: job.generator, values: job.values };

    return new Promise((resolve, reject) => {
      this.pending.set(id, (res) => {
        if (res.ok && res.kind === 'layout') resolve(res.data);
        else reject(new Error(res.ok ? 'Unexpected response' : res.error));
      });

      if (this.worker) this.worker.postMessage(req);
      else queueMicrotask(() => this.receive(handleRequest(req)));
    });
  }

  /**
   * Search for an optimised layout for `budgetMs`, reporting each better one
   * found. It gets a worker of its own: the search holds its thread for the
   * whole budget, and stopping it early is terminating that worker.
   */
  optimise(
    job: { generator: string; values: ParamValues; budgetMs: number },
    onProgress: (best: NestResult, elapsedMs: number) => void,
  ): Optimising {
    let best: NestResult | null = null;
    let finish: (r: NestResult | null) => void = () => {};
    let fail: (e: Error) => void = () => {};
    const done = new Promise<NestResult | null>((resolve, reject) => {
      finish = resolve;
      fail = reject;
    });

    let worker: Worker | null = null;
    try {
      worker = new Worker(new URL('../workers/nest.worker.ts', import.meta.url), { type: 'module' });
    } catch {
      worker = null;
    }

    if (!worker) {
      // No workers: a short search on this thread, after the page has had a
      // chance to show that it is busy.
      setTimeout(() => {
        try {
          finish(optimiseLayout(job.generator, job.values, { budgetMs: Math.min(job.budgetMs, 1500) }));
        } catch (e) {
          fail(e instanceof Error ? e : new Error(String(e)));
        }
      }, 50);
      return { done, stop: () => {} };
    }

    const w = worker;
    w.onmessage = (e: MessageEvent<NestMessage>) => {
      const m = e.data;
      if (m.kind === 'progress') {
        best = m.best;
        onProgress(m.best, m.elapsedMs);
        return;
      }
      w.terminate();
      if (m.ok) finish(m.result);
      else fail(new Error(m.error));
    };
    w.onerror = (e) => {
      w.terminate();
      fail(new Error(e.message || 'Layout search failed'));
    };
    const req: NestRequest = job;
    w.postMessage(req);
    return {
      done,
      stop: () => {
        w.terminate();
        finish(best);
      },
    };
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
    this.listener = null;
    this.pending.clear();
  }
}
