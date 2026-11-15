import { useId } from 'react'
import type { Observation } from '../api/types'
import { formatUtc, formatValue } from '../ui'

/** Display coordinates only: no clinical thresholds, invented points or smoothed samples. */
export function HistoryPlot({ observations }: { observations: Observation[] }) {
  const titleId = useId()
  const points = observations.filter((item) => Number.isFinite(item.value) && Number.isFinite(Date.parse(item.observed_at)))
  if (!points.length) return null
  const units = new Set(points.map((item) => item.unit))
  if (units.size !== 1) return <p className="dash-hint">Different units are shown separately in the table.</p>
  const times = points.map((item) => Date.parse(item.observed_at))
  const start = Math.min(...times), end = Math.max(...times)
  const values = points.map((item) => item.value)
  const min = Math.min(...values), max = Math.max(...values)
  const padding = max === min ? Math.max(Math.abs(max) * .08, 1) : (max - min) * .18
  const bottom = min - padding, top = max + padding
  const y = (value: number) => 91 - (value - bottom) / (top - bottom) * 68
  const dateLabel = (time: number) => start !== end && end - start >= 86400000 ? new Date(time).toISOString().slice(5, 10) : new Date(time).toISOString().slice(11, 19)
  return <figure className="history-plot">
    <svg viewBox="0 0 360 124" role="img" aria-labelledby={titleId}>
      <title id={titleId}>{points.length} recorded observations, {points[0].unit}. Individual readings plotted by UTC time; see the data table for exact values and provenance.</title>
      {[min, ...(min === max ? [] : [max])].map((value) => <g key={value}><line x1="48" x2="344" y1={y(value)} y2={y(value)} stroke="currentColor" opacity=".15" /><text x="0" y={y(value) + 4} fill="currentColor" fontSize="13">{Number(value.toPrecision(4))}</text></g>)}
      {points.map((item, index) => <circle key={item.id} cx={end === start ? 196 : 52 + (times[index] - start) / (end - start) * 284} cy={y(item.value)} r={points.length === 1 ? 5 : 3.5} fill={item.provenance === 'LIVE_MEASURED' ? '#98532b' : '#416951'} stroke="var(--surface)" strokeWidth="1">
        <title>{formatUtc(item.observed_at)}: {formatValue(item)} ({item.provenance})</title>
      </circle>)}
      <text x="48" y="119" fill="currentColor" fontSize="13">{dateLabel(start)}</text>
      {end !== start && <text x="344" y="119" textAnchor="end" fill="currentColor" fontSize="13">{dateLabel(end)}</text>}
      <text x="344" y="12" textAnchor="end" fill="currentColor" fontSize="13">{points[0].unit}</text>
    </svg>
    <figcaption>{points.length} recorded {points.length === 1 ? 'reading' : 'readings'} · UTC{points.some((item) => item.provenance === 'LIVE_MEASURED') && ' · copper dots: this device'}</figcaption>
  </figure>
}
