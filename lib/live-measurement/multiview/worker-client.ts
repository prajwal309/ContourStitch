import type { VisionFrame } from '@/lib/vision/types';
import { multiViewConfig } from './config';
import { observeFrame, type FrameObservation } from './observe';

/** One frame in flight. If a worker cannot start or fails, process that frame on the CPU. */
export function createObservationClient() {
  let worker: Worker | undefined;
  try {
    worker = new Worker(new URL('./observe.worker.ts', import.meta.url));
  } catch {
    worker = undefined;
  }
  let cancel: (() => void) | undefined;
  let closed = false;

  function stopWorker() {
    worker?.terminate();
    worker = undefined;
  }

  return {
    async observe(frame: VisionFrame): Promise<FrameObservation | null> {
      if (closed) return null;
      const activeWorker = worker;
      if (!activeWorker) return observeFrame(frame);
      const result = await new Promise<FrameObservation | null>((resolve) => {
        const finish = (observation: FrameObservation | null) => {
          clearTimeout(timeout);
          activeWorker.onmessage = null;
          activeWorker.onerror = null;
          activeWorker.onmessageerror = null;
          cancel = undefined;
          resolve(observation);
        };
        const fail = () => {
          stopWorker();
          finish(null);
        };
        const timeout = setTimeout(fail, multiViewConfig.workerTimeoutMs);
        cancel = () => finish(null);
        activeWorker.onmessage = (event: MessageEvent<FrameObservation>) =>
          finish(event.data);
        activeWorker.onerror = fail;
        activeWorker.onmessageerror = fail;
        try {
          // One owned copy stays available for fallback if posting or processing fails.
          const data = frame.mask?.data.slice();
          const input =
            data && frame.mask
              ? { ...frame, mask: { ...frame.mask, data } }
              : frame;
          activeWorker.postMessage(input, data ? [data.buffer] : []);
        } catch {
          fail();
        }
      });
      return closed ? null : (result ?? observeFrame(frame));
    },
    close() {
      closed = true;
      cancel?.();
      stopWorker();
    },
  };
}
