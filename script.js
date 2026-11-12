'use strict';

// General adult reference ranges for a resting crew member, in-orbit.
// nominal: fully within range; watch: outside nominal but not yet alarming;
// anything outside watch: alert.
const METRICS = [
  {
    id: 'heartRate', label: 'Heart rate', unit: 'bpm',
    nominal: [50, 100], watch: [40, 110],
    low: 'Resting heart rate is low. Sit for 5 minutes and re-measure; tell the flight surgeon if you feel dizzy.',
    high: 'Resting heart rate is elevated. Hydrate, rest 10 minutes and re-measure; report palpitations or breathlessness.'
  },
  {
    id: 'spo2', label: 'Blood oxygen', unit: '%',
    nominal: [95, 100], watch: [90, 95],
    low: 'Blood oxygen is below nominal. Sit down, breathe slowly and re-measure; notify the flight surgeon if it stays low.'
  },
  {
    id: 'systolic', label: 'Systolic pressure', unit: 'mmHg',
    nominal: [90, 120], watch: [80, 140],
    low: 'Systolic pressure is low. Drink water, lie down and re-measure; report dizziness on standing.',
    high: 'Systolic pressure is high. Rest quietly and re-measure; report headaches or vision changes.'
  },
  {
    id: 'diastolic', label: 'Diastolic pressure', unit: 'mmHg',
    nominal: [60, 80], watch: [50, 90],
    low: 'Diastolic pressure is low. Hydrate, lie down and re-measure.',
    high: 'Diastolic pressure is high. Rest quietly and re-measure; report it if it persists.'
  },
  {
    id: 'temperature', label: 'Body temperature', unit: '°C',
    nominal: [36, 37.5], watch: [35.5, 38],
    low: 'Temperature is low. Warm up, add a layer and re-measure.',
    high: 'Temperature is high. Rest, hydrate and re-measure; report chills, sore throat or body aches.'
  },
  {
    id: 'sleep', label: 'Sleep', unit: 'hours',
    nominal: [7, 9], watch: [6, 10],
    low: 'Sleep is short. Protect a full sleep period this cycle and avoid stimulants before rest.',
    high: 'Sleep is long. Check for fatigue, low mood or illness, and keep a consistent sleep schedule.'
  },
  {
    id: 'exercise', label: 'Exercise', unit: 'minutes',
    nominal: [30, Infinity], watch: [15, Infinity],
    low: 'Exercise is under the countermeasure target. Add resistance or aerobic work today to protect bone and muscle.'
  },
  {
    id: 'stress', label: 'Stress', unit: '/ 10',
    nominal: [1, 4], watch: [1, 6],
    high: 'Stress is elevated. Use a scheduled recovery break, talk to your crew, and log it for the behavioral health team.'
  }
];

function assess(metric, value) {
  const [nMin, nMax] = metric.nominal;
  const [wMin, wMax] = metric.watch;
  if (value >= nMin && value <= nMax) return 'nominal';
  if (value >= wMin && value <= wMax) return 'watch';
  return 'alert';
}

function evaluate(values) {
  const results = METRICS.map(metric => {
    const value = Number(values[metric.id]);
    const status = assess(metric, value);
    const advice = status === 'nominal' ? null
      : value < metric.nominal[0] ? metric.low : metric.high;
    return { id: metric.id, label: metric.label, unit: metric.unit, value, status, advice };
  });

  const worst = results.some(r => r.status === 'alert') ? 'alert'
    : results.some(r => r.status === 'watch') ? 'watch' : 'nominal';

  return { status: worst, results };
}

const STATUS_COPY = {
  nominal: 'All indicators are within nominal ranges. Keep up your countermeasures.',
  watch: 'Some indicators are outside nominal. Follow the guidance below and re-check within 24 hours.',
  alert: 'At least one indicator needs attention. Contact the flight surgeon before your next task.'
};

const HISTORY_KEY = 'astro-vital.checkins';

function readHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; }
  catch { return []; }
}

function writeHistory(entries) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, 30))); }
  catch { /* storage full or blocked: check-ins stay in memory for this session */ }
}

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  children.forEach(child => node.append(child));
  return node;
}

function statusChip(status) {
  return el('span', { className: `status status-${status}`, textContent: status });
}

function renderResults(report) {
  const container = document.getElementById('results');
  const alerts = report.results.filter(r => r.status === 'alert').length;

  const header = el('div', { className: 'overall' },
    statusChip(report.status),
    el('p', { textContent: STATUS_COPY[report.status] })
  );

  const list = el('ul', { className: 'results-list' });
  report.results.forEach(r => {
    const item = el('li', {},
      el('span', { className: 'metric', textContent: `${r.label}: ${r.value} ${r.unit}` }),
      statusChip(r.status)
    );
    if (r.advice) item.append(el('p', { className: 'advice', textContent: r.advice }));
    list.append(item);
  });

  container.replaceChildren(header, list);
  if (alerts) container.querySelector('.overall p').setAttribute('role', 'alert');
  return report;
}

function renderHistory() {
  const entries = readHistory();
  const container = document.getElementById('history');
  const clear = document.getElementById('clear-history');

  if (!entries.length) {
    container.replaceChildren(el('p', { className: 'muted', textContent: 'No check-ins saved yet.' }));
    clear.hidden = true;
    return;
  }

  const body = el('tbody');
  entries.forEach(entry => {
    const alertCount = entry.results.filter(r => r.status === 'alert').length;
    body.append(el('tr', {},
      el('td', { textContent: new Date(entry.at).toLocaleString() }),
      el('td', {}, statusChip(entry.status)),
      el('td', { textContent: alertCount ? `${alertCount} alert${alertCount > 1 ? 's' : ''}` : '—' })
    ));
  });

  container.replaceChildren(el('table', {},
    el('thead', {}, el('tr', {},
      el('th', { textContent: 'Time' }),
      el('th', { textContent: 'Status' }),
      el('th', { textContent: 'Alerts' })
    )),
    body
  ));
  clear.hidden = false;
}

function init() {
  const form = document.getElementById('checkin-form');

  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const values = Object.fromEntries(METRICS.map(m => [m.id, form.elements[m.id].valueAsNumber]));
    const report = renderResults(evaluate(values));

    writeHistory([{ at: new Date().toISOString(), status: report.status, results: report.results }, ...readHistory()]);
    renderHistory();
  });

  document.getElementById('clear-history').addEventListener('click', () => {
    writeHistory([]);
    renderHistory();
  });

  renderHistory();
}

if (typeof document !== 'undefined') init();
if (typeof module !== 'undefined') module.exports = { METRICS, assess, evaluate };
