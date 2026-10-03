import { parentPort, workerData } from 'node:worker_threads';
import { run } from './language/index.js';
parentPort.postMessage(run(workerData));
