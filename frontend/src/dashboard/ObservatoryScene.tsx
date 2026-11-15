import { useState } from 'react'
import type { StateEnvelope } from '../api/types'
import { StatusBadge } from '../ui'

interface SceneProps {
  state: StateEnvelope
  selectedSource: string | null
  onSelectSource: (id: string) => void
  onOpenEvidence: () => void
  onAction: (id: string) => void
}

export function ObservatoryScene(props: SceneProps) {
  return props.state.scenario_id === 'sleep_vigilance' ? <AnatomyStage {...props} /> : <DetectorStage {...props} />
}

function AnatomyStage(props: SceneProps) {
  const [variant, setVariant] = useState<'male' | 'female'>('male')
  const [side, setSide] = useState<'front' | 'back'>('front')
  const views = { 'male-front': '40 0 455 887', 'male-back': '495 0 390 887', 'female-front': '885 0 400 887', 'female-back': '1285 0 425 887' }
  const view = `${variant}-${side}` as keyof typeof views
  return (
    <section className="observatory anatomy" aria-labelledby="anatomy-title">
      <header className="observatory__head">
        <h2 id="anatomy-title">Crew demo 01</h2>
        <span>Synthetic crew scenario</span>
      </header>
      <div className="anatomy__figure">
        <svg key={view} viewBox={views[view]} role="img" aria-label={`${variant === 'male' ? 'Male' : 'Female'} anatomy illustration, ${side} view`}>
          <image href="/art/anatomy-study.webp" width="1774" height="887" />
        </svg>
      </div>
      <div className="anatomy__callouts">
        <button className="scene-callout scene-callout--sleep" aria-pressed={props.selectedSource === 'crew_sleep_log'} onClick={() => props.onSelectSource('crew_sleep_log')}>
          <span className="scene-callout__dot" /><span>Sleep history<small>View recorded nights</small></span>
        </button>
        <button className="scene-callout scene-callout--reaction" onClick={() => props.onAction('start_reaction_check')}>
          <span className="scene-callout__dot" /><span>Reaction check<small>Open device check</small></span>
        </button>
        <button className="scene-callout scene-callout--why" onClick={props.onOpenEvidence}>
          <span className="scene-callout__dot" /><span>Why evidence<small>Read the explanation</small></span>
        </button>
      </div>
      <footer className="observatory__foot">
        <div className="anatomy-controls" aria-label="Anatomy view">
          <div role="group" aria-label="Illustration variant">
            {(['male', 'female'] as const).map((item) => <button key={item} aria-pressed={variant === item} onClick={() => setVariant(item)}>{item === 'male' ? 'Male' : 'Female'}</button>)}
          </div>
          <div role="group" aria-label="Illustration direction">
            {(['front', 'back'] as const).map((item) => <button key={item} aria-pressed={side === item} onClick={() => setSide(item)}>{item === 'front' ? 'Front' : 'Back'}</button>)}
          </div>
        </div>
        <p>Illustrative anatomy · measurements shown in panels</p>
      </footer>
    </section>
  )
}

function DetectorStage(props: SceneProps) {
  return (
    <section className="observatory detector" aria-labelledby="detector-title">
      <header className="observatory__head">
        <h2 id="detector-title">Inside the cabin</h2>
        <span>Two independent detector streams</span>
      </header>
      <svg className="detector__schematic" viewBox="0 0 480 360" role="img" aria-label="Illustrative cabin schematic with two independent instruments, DosTel1 and DosTel2">
        <defs>
          <linearGradient id="cabin-fill" x2="0" y2="1"><stop stopColor="#293d49" /><stop offset="1" stopColor="#14232d" /></linearGradient>
          <linearGradient id="pod-fill" x2="0" y2="1"><stop stopColor="#dae5dd" /><stop offset="1" stopColor="#8da79c" /></linearGradient>
        </defs>
        <g fill="none" stroke="#a4bdb5" strokeWidth="1">
          <ellipse cx="240" cy="300" rx="196" ry="36" opacity=".2" />
          <path d="M45 176 122 96H357L435 176V253L357 292H122L45 253Z" fill="url(#cabin-fill)" stroke="#76958e" />
          <path d="M45 176H435M122 96V292M357 96V292M45 253H435M122 253H357M177 96V176M300 96V176" opacity=".5" />
          <rect x="197" y="107" width="85" height="50" rx="19" fill="#0b1822" />
          <path d="M208 139Q239 119 271 139" stroke="#96b9ce" strokeWidth="2" />
          <path d="M239 157V175M132 275H347" opacity=".7" />
        </g>
        {[{ x: 137, label: 'DosTel1', id: 'DosTel1' }, { x: 285, label: 'DosTel2', id: 'DosTel2' }].map((pod) => {
          const source = props.state.sources.find((item) => item.source_id === pod.id)
          const tone = source?.state === 'current' ? '#93c2a3' : source?.state === 'stale' ? '#edbc70' : '#b9c4d1'
          return <g key={pod.id}>
            <path d={`M${pod.x + 12} 190V162H${pod.x + 37}V190`} fill="none" stroke="#91a8a5" />
            <rect x={pod.x} y="186" width="58" height="52" rx="9" fill="url(#pod-fill)" stroke={props.selectedSource === pod.id ? '#e4f5e9' : '#718c82'} strokeWidth="2" />
            <rect x={pod.x + 9} y="195" width="40" height="22" rx="3" fill="#152b2b" />
            <circle cx={pod.x + 29} cy="206" r="5" fill={tone} />
            <path d={`M${pod.x + 11} 226h36`} stroke="#5f7c72" strokeWidth="2" />
            <text x={pod.x + 29} y="263" textAnchor="middle" fill="#dae8e1" fontSize="14">{pod.label}</text>
          </g>
        })}
        <path d="M239 66V82M231 74h16M404 96v10M399 101h10M68 75v8M64 79h8" stroke="#a6c5c2" opacity=".5" />
      </svg>
      <div className="detector__sources" role="group" aria-label="Cabin instruments">
        {props.state.sources.map((source) => <button key={source.source_id} aria-pressed={props.selectedSource === source.source_id} onClick={() => props.onSelectSource(source.source_id)}>
          <span>{source.source_id}</span><StatusBadge kind="source" state={source.state} />
        </button>)}
      </div>
      <footer className="observatory__foot">
        <p>Historical cabin measurements, not personal exposure.</p>
        <span>Illustrative schematic · freshness, not radiation danger</span>
      </footer>
    </section>
  )
}
