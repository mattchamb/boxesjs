/**
 * Runs the geometry engine off the main thread.
 *
 * Nothing here touches the DOM, so the UI stays responsive no matter how long a
 * pathological parameter set takes to render — dragging a slider can never jank
 * the page.
 */
import { handleRequest } from './handler';
import type { WorkerRequest } from './protocol';

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  (self as unknown as Worker).postMessage(handleRequest(e.data));
};
