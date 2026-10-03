import { Worker } from 'node:worker_threads';

export class ServiceError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// Each request gets a disposable worker. Admission is bounded, with no unbounded queue.
export function createRunner({ maxConcurrent = 4, timeoutMs = 2000 } = {}) {
  let active = 0;
  return function runIsolated(source, signal) {
    if (signal?.aborted) return Promise.reject(new ServiceError(499, 'Execution cancelled'));
    if (active >= maxConcurrent) return Promise.reject(new ServiceError(503, 'المحرك مشغول، حاولي مجددًا بعد قليل.'));
    active++;
    return new Promise((resolve, reject) => {
      let worker, timer, settled = false;
      const finish = (error, result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal?.removeEventListener('abort', cancel);
        // Keep capacity reserved until the worker has actually stopped.
        Promise.resolve(worker?.terminate()).catch(() => {}).finally(() => {
          active--;
          if (error) reject(error); else resolve(result);
        });
      };
      const cancel = () => finish(new ServiceError(499, 'Execution cancelled'));
      try {
        worker = new Worker(new URL('./execution-worker.js', import.meta.url), {
          workerData: source,
          resourceLimits: { maxOldGenerationSizeMb: 32, maxYoungGenerationSizeMb: 8, stackSizeMb: 2 },
        });
        worker.once('message', result => finish(null, result));
        worker.once('error', () => finish(new ServiceError(500, 'تعذّر إكمال التنفيذ.')));
        worker.once('exit', () => { if (!settled) finish(new ServiceError(500, 'توقف محرك التنفيذ.')); });
        timer = setTimeout(() => finish(new ServiceError(408, 'تجاوز البرنامج مهلة التنفيذ.')), timeoutMs);
        signal?.addEventListener('abort', cancel, { once: true });
        if (signal?.aborted) cancel();
      } catch { finish(new ServiceError(500, 'تعذر بدء محرك التنفيذ.')); }
    });
  };
}
