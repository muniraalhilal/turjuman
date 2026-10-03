import { run } from '/src/language/index.js';
self.onmessage = ({ data }) => {
  try { self.postMessage(run(data)); }
  catch { self.postMessage({ ok: false, output: [], error: { phase: 'internal', line: 1, column: 1, message: 'تعذر تشغيل البرنامج.' } }); }
};
