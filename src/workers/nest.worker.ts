/**
 * Searches for an optimised layout off the main thread, and off the render
 * worker too: the search runs for seconds, and previews must not queue behind
 * it. Each search gets a worker of its own, so stopping one is terminating it.
 */
import { optimiseLayout } from '../lib/preview';
import type { NestMessage, NestRequest } from './protocol';

const post = (m: NestMessage) => (self as unknown as Worker).postMessage(m);

self.onmessage = (e: MessageEvent<NestRequest>) => {
  const req = e.data;
  try {
    const result = optimiseLayout(req.generator, req.values, {
      budgetMs: req.budgetMs,
      onProgress: (best, elapsedMs) => post({ kind: 'progress', best, elapsedMs }),
    });
    post({ kind: 'done', ok: true, result });
  } catch (err) {
    post({ kind: 'done', ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};
