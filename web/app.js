import { highlight } from './highlight.js';
const $ = id => document.getElementById(id);
function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const label = theme === 'dark' ? '☀ الوضع الفاتح' : '☾ الوضع الداكن';
  $('theme').textContent = label;
  $('theme').setAttribute('aria-label', label);
  try { localStorage.setItem('turjuman.theme', theme); } catch {}
}
let theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
try { theme = localStorage.getItem('turjuman.theme') || theme; } catch {}
setTheme(theme);
$('theme').onclick = () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
let backend = false;
const engineReady = fetch('/api/health', { signal: AbortSignal.timeout(4000) })
  .then(async response => { if (response.ok) backend = (await response.json()).service === 'turjuman'; })
  .catch(() => {})
  .finally(() => { $('engine').textContent = backend ? '● التنفيذ على الخادم' : '● التنفيذ في المتصفح'; });
const examples = {
  hello: '# برنامجك الأول بلغة ترجمان\nمتغير الاسم = "العالم"\nاطبع("مرحبًا يا " + الاسم)\n\nمتغير العدد = ٧\nاطبع(العدد * ٦)\n\nإذا العدد > ٥ {\n  اطبع("فكرة صغيرة، بداية كبيرة.")\n}',
  fibonacci: '# أول عشرة أعداد من متتالية فيبوناتشي\nمتغير السابق = ٠\nمتغير الحالي = ١\nمتغير العداد = ٠\n\nطالما العداد < ١٠ {\n  اطبع(السابق)\n  متغير التالي = السابق + الحالي\n  السابق = الحالي\n  الحالي = التالي\n  العداد = العداد + ١\n}',
  factorial: '# حساب مضروب العدد ٥\nمتغير العدد = ٥\nمتغير الناتج = ١\n\nطالما العدد > ١ {\n  الناتج = الناتج * العدد\n  العدد = العدد - ١\n}\nاطبع(الناتج)',
  condition: 'متغير الدرجة = ٨٧\nمتغير مكتمل = صحيح\n\nإذا الدرجة >= ٦٠ و مكتمل {\n  اطبع("اجتزت الاختبار!")\n} وإلا {\n  اطبع("حاول مرة أخرى")\n}\nاطبع(ليس خطأ)',
  error: '# خطأ وقت التنفيذ مع موقعه\nمتغير المقام = ٠\nاطبع("لنجرّب القسمة")\nاطبع(١٠ / المقام)',
};
let last = null, activeTab = 'output', worker = null, timer = null, request = null, runId = 0;
try { $('code').value = localStorage.getItem('bayan.source') ?? examples.hello; } catch { $('code').value = examples.hello; }
if ($('code').value === examples.hello.replace('ترجمان', 'بيان')) $('code').value = examples.hello;
function syncScroll() {
  $('lines').scrollTop = $('code').scrollTop;
  $('highlight').scrollTop = $('code').scrollTop;
  $('highlight').scrollLeft = $('code').scrollLeft;
}
function updateLines() {
  $('lines').textContent = Array.from({ length: $('code').value.split('\n').length }, (_, i) => i + 1).join('\n');
  const fragment = document.createDocumentFragment();
  for (const token of highlight($('code').value + '\n')) {
    const span = document.createElement('span');
    span.className = `syntax-${token.kind}`;
    span.textContent = token.text;
    fragment.append(span);
  }
  $('highlight').replaceChildren(fragment);
  syncScroll();
}
function save() { updateLines(); try { localStorage.setItem('bayan.source', $('code').value); } catch {} }
function render() {
  if (!last) { $('result').textContent = 'شغّل البرنامج لرؤية النتيجة هنا.'; return; }
  $('result').textContent = activeTab === 'output' ? (last.output.join('\n') || (last.ok ? 'اكتمل البرنامج بدون مخرجات.' : 'لا توجد مخرجات.')) : JSON.stringify(last[activeTab] ?? null, null, 2);
}
function finish() { clearTimeout(timer); worker?.terminate(); worker = null; request?.abort(); request = null; $('run').disabled = false; $('stop').disabled = true; }
async function execute() {
  finish(); const id = ++runId, source = $('code').value;
  last = null; render(); $('error').hidden = true; $('status').textContent = 'جارٍ التنفيذ…'; $('run').disabled = true; $('stop').disabled = false;
  const began = performance.now();
  const receive = data => {
    if (id !== runId) return;
    last = data; finish(); render();
    $('status').textContent = data.ok ? '✓ اكتمل التنفيذ' : 'تعذّر إكمال البرنامج';
    $('metrics').textContent = `${data.steps ?? 0} خطوة · ${(performance.now() - began).toFixed(1)} ms · الزمن الكلي`;
    if (!data.ok) {
      $('error').hidden = false;
      $('error').textContent = `${data.error.message} (السطر ${data.error.line}، العمود ${data.error.column} · ${data.error.phase})`;
    }
  };
  const failed = message => {
    if (id !== runId) return;
    finish(); $('status').textContent = 'تعذّر التنفيذ'; $('error').hidden = false; $('error').textContent = message;
  };
  await engineReady;
  if (id !== runId) return;
  timer = setTimeout(() => { failed('تجاوز الاتصال مهلة التنفيذ. حاولي مجددًا.'); runId++; }, 8000);
  if (backend) {
    request = new AbortController();
    try {
      const response = await fetch('/api/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source }), signal: request.signal });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'تعذر الاتصال بالخادم.');
      receive(data);
    } catch (error) { if (error.name !== 'AbortError') failed(error.message || 'تعذر الاتصال بالخادم.'); }
  } else {
    worker = new Worker('/worker.js', { type: 'module' });
    worker.onmessage = ({ data }) => receive(data);
    worker.onerror = () => failed('تعذر بدء المحرك. افتحي الموقع عبر رابط الخادم.');
    worker.postMessage(source);
  }
}
$('run').onclick = execute;
$('stop').onclick = () => { runId++; finish(); $('status').textContent = 'أُوقف التنفيذ'; };
$('code').addEventListener('input', save);
$('code').addEventListener('scroll', syncScroll);
$('code').addEventListener('keydown', event => {
  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') { event.preventDefault(); execute(); }
  if (event.key === 'Tab') { event.preventDefault(); $('code').setRangeText('  ', $('code').selectionStart, $('code').selectionEnd, 'end'); save(); }
});
$('examples').onchange = () => {
  if ($('code').value && !Object.values(examples).includes($('code').value) && !confirm('استبدال البرنامج الحالي بالمثال؟ نسّخي أو نزّلي تعديلاتك أولًا.')) return;
  runId++; finish(); $('code').value = examples[$('examples').value]; save(); last = null; render(); $('error').hidden = true; $('status').textContent = 'جاهز للتجربة'; $('metrics').textContent = 'كل تشغيل يبدأ بذاكرة جديدة.';
};
document.querySelectorAll('[data-tab]').forEach(button => {
  button.onclick = () => {
    activeTab = button.dataset.tab;
    document.querySelectorAll('[data-tab]').forEach(tab => tab.setAttribute('aria-selected', String(tab === button)));
    $('result').setAttribute('aria-labelledby', button.id); render();
  };
  button.onkeydown = event => {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault(); const tabs = [...document.querySelectorAll('[data-tab]')], current = tabs.indexOf(button);
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (current + (event.key === 'ArrowLeft' ? 1 : -1) + tabs.length) % tabs.length;
    tabs[index].focus(); tabs[index].click();
  };
});
$('download').onclick = () => { const url = URL.createObjectURL(new Blob([$ ('code').value], { type: 'text/plain;charset=utf-8' })); const a = document.createElement('a'); a.href = url; a.download = 'main.ar'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
updateLines();
