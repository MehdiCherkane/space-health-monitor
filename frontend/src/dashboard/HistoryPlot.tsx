import { useId, useState } from 'react'

import type { Observation } from '../api/types'
import { PROVENANCE_LABEL, formatTime, formatUtc, formatValue } from '../ui'

export interface HistoryBand {
  min: number
  max: number
  label: string
}

interface ChartPoint {
  observation: Observation
  time: number
  x: number
  y: number
}

const WIDTH = 380
const HEIGHT = 176
const LEFT = 48
const RIGHT = 12
const TOP = 16
const BOTTOM = 30

function shortNumber(value: number): string {
  const rounded = Number(value.toPrecision(3))
  return String(rounded)
}

function axisTickLabel(time: number, span: number): string {
  if (span >= 86_400_000) {
    return new Date(time).toISOString().slice(5, 10)
  }
  return new Date(time).toISOString().slice(11, 19)
}

/**
 * Display coordinates only: real supplied observations, no smoothing, thresholds or
 * invented samples. Hover and keyboard focus reveal the exact value and provenance.
 */
export function HistoryPlot({
  observations,
  band = null,
}: {
  observations: Observation[]
  band?: HistoryBand | null
}) {
  const titleId = useId()
  const [activeId, setActiveId] = useState<string | null>(null)
  const points = observations
    .filter(
      (item) => Number.isFinite(item.value) && Number.isFinite(Date.parse(item.observed_at)),
    )
    .slice()
    .sort((a, b) => Date.parse(a.observed_at) - Date.parse(b.observed_at))

  if (points.length === 0) return null

  const units = new Set(points.map((item) => item.unit))
  if (units.size !== 1) {
    return <p className="dash-hint">Different units are shown separately in the table.</p>
  }

  const times = points.map((item) => Date.parse(item.observed_at))
  const values = points.map((item) => item.value)
  const start = Math.min(...times)
  const end = Math.max(...times)
  const valueMin = Math.min(...values, band?.min ?? Infinity)
  const valueMax = Math.max(...values, band?.max ?? -Infinity)
  const padding = valueMax === valueMin ? Math.max(Math.abs(valueMax) * 0.08, 1) : (valueMax - valueMin) * 0.16
  const low = valueMin - padding
  const high = valueMax + padding
  const plotW = WIDTH - LEFT - RIGHT
  const plotH = HEIGHT - TOP - BOTTOM
  const x = (time: number) => (end === start ? LEFT + plotW / 2 : LEFT + ((time - start) / (end - start)) * plotW)
  const y = (value: number) => TOP + (1 - (value - low) / (high - low)) * plotH

  const chartPoints: ChartPoint[] = points.map((observation) => ({
    observation,
    time: Date.parse(observation.observed_at),
    x: x(Date.parse(observation.observed_at)),
    y: y(observation.value),
  }))
  const linePath = chartPoints.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ')
  const areaPath = `${linePath} L${chartPoints[chartPoints.length - 1].x.toFixed(2)} ${HEIGHT - BOTTOM} L${chartPoints[0].x.toFixed(2)} ${HEIGHT - BOTTOM} Z`
  const yTicks = [low + padding, (low + high) / 2, high - padding].map((value) => ({
    value,
    y: y(value),
  }))
  const xTicks = end === start ? [start] : [start, start + (end - start) / 2, end]
  const span = end - start
  const activePoint = chartPoints.find((point) => point.observation.id === activeId) ?? null
  const unit = points[0].unit
  const tooltipOnLeft = activePoint !== null && activePoint.x > WIDTH * 0.58

  return (
    <figure className="history-plot">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-labelledby={titleId}
        className="history-plot__svg"
      >
        <title id={titleId}>
          {points.length} recorded {points.length === 1 ? 'observation' : 'observations'} in {unit}.
          Individual readings plotted by UTC time. Use the data table for exact values and provenance.
        </title>

        {yTicks.map((tick, index) => (
          <g key={index} className="history-plot__tick">
            <line x1={LEFT} x2={WIDTH - RIGHT} y1={tick.y} y2={tick.y} />
            <text x={LEFT - 8} y={tick.y + 4} textAnchor="end">
              {shortNumber(tick.value)}
            </text>
          </g>
        ))}
        <text className="history-plot__unit" x={LEFT - 8} y={TOP - 3} textAnchor="end">
          {unit}
        </text>

        {band !== null && (
          <g className="history-plot__band">
            <rect
              x={LEFT}
              y={y(band.max)}
              width={plotW}
              height={Math.max(2, y(band.min) - y(band.max))}
              rx={3}
            />
            <text x={WIDTH - RIGHT} y={y(band.max) - 5} textAnchor="end">
              {band.label}
            </text>
          </g>
        )}

        {end !== start && (
          <>
            <path className="history-plot__area" d={areaPath} />
            <path className="history-plot__line" d={linePath} />
          </>
        )}

        {chartPoints.map((point) => (
          <circle
            key={point.observation.id}
            className="history-plot__point"
            data-provenance={point.observation.provenance}
            data-active={activeId === point.observation.id}
            cx={point.x}
            cy={point.y}
            r={points.length === 1 ? 5.5 : 3.6}
            tabIndex={0}
            role="button"
            aria-label={`${formatUtc(point.observation.observed_at)}: ${formatValue(point.observation)}, ${PROVENANCE_LABEL[point.observation.provenance]}`}
            onMouseEnter={() => setActiveId(point.observation.id)}
            onMouseLeave={() => setActiveId(null)}
            onFocus={() => setActiveId(point.observation.id)}
            onBlur={() => setActiveId(null)}
          />
        ))}

        {end === start ? (
          <text className="history-plot__single" x={WIDTH / 2} y={HEIGHT - 9} textAnchor="middle">
            Single recorded reading · {formatTime(points[0].observed_at)}
          </text>
        ) : (
          xTicks.map((time, index) => (
            <text
              key={index}
              className="history-plot__x-tick"
              x={x(time)}
              y={HEIGHT - 9}
              textAnchor={index === 0 ? 'start' : index === xTicks.length - 1 ? 'end' : 'middle'}
            >
              {axisTickLabel(time, span)}
            </text>
          ))
        )}

        {activePoint !== null && (
          <g
            className="history-plot__tooltip"
            transform={`translate(${tooltipOnLeft ? activePoint.x - 128 : activePoint.x + 10}, ${Math.max(8, activePoint.y - 46)})`}
          >
            <rect width={118} height={40} rx={7} />
            <text x={9} y={16}>{formatTime(activePoint.observation.observed_at)} UTC</text>
            <text x={9} y={31}>{formatValue(activePoint.observation)}</text>
          </g>
        )}
      </svg>
      <figcaption>
        {points.length} recorded {points.length === 1 ? 'reading' : 'readings'} · UTC
        {band !== null && ` · shaded: ${band.label.toLowerCase()}`}
        {points.some((item) => item.provenance === 'LIVE_MEASURED') && ' · copper points: this device'}
      </figcaption>
    </figure>
  )
}
