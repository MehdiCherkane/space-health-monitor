'use strict';

const assert = require('node:assert/strict');
const { METRICS, assess, evaluate } = require('./script.js');

const metric = id => METRICS.find(m => m.id === id);

// Boundaries: nominal inclusive, then watch, then alert.
assert.equal(assess(metric('heartRate'), 50), 'nominal');
assert.equal(assess(metric('heartRate'), 100), 'nominal');
assert.equal(assess(metric('heartRate'), 49.9), 'watch');
assert.equal(assess(metric('heartRate'), 39.9), 'alert');
assert.equal(assess(metric('heartRate'), 110.1), 'alert');
assert.equal(assess(metric('spo2'), 94), 'watch');
assert.equal(assess(metric('spo2'), 89), 'alert');
assert.equal(assess(metric('exercise'), 30), 'nominal');
assert.equal(assess(metric('exercise'), 20), 'watch');

const healthy = {
  heartRate: 62, spo2: 98, systolic: 115, diastolic: 72,
  temperature: 36.7, sleep: 8, exercise: 45, stress: 3
};
const report = evaluate(healthy);
assert.equal(report.status, 'nominal');
assert.ok(report.results.every(r => r.advice === null));

// One watch, no alerts.
const watch = evaluate({ ...healthy, sleep: 6.5 });
assert.equal(watch.status, 'watch');
assert.equal(watch.results.find(r => r.id === 'sleep').advice, metric('sleep').low);

// An alert outweighs a watch.
const alert = evaluate({ ...healthy, sleep: 6.5, spo2: 85 });
assert.equal(alert.status, 'alert');
assert.equal(alert.results.find(r => r.id === 'spo2').advice, metric('spo2').low);

// High-side advice is selected when the value is above nominal.
const high = evaluate({ ...healthy, temperature: 38.4 });
assert.equal(high.results.find(r => r.id === 'temperature').advice, metric('temperature').high);

// Every metric is evaluated, no missing or duplicated ids.
assert.equal(report.results.length, METRICS.length);
assert.equal(new Set(report.results.map(r => r.id)).size, METRICS.length);

console.log('All health assessment checks passed.');
