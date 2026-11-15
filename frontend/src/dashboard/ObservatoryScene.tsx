import { useState } from 'react'

import type { SourceStatus, StateEnvelope } from '../api/types'
import { StatusBadge } from '../ui'

interface SceneProps {
  state: StateEnvelope
  selectedSource: string | null
  onSelectSource: (id: string) => void
  onOpenEvidence: () => void
  onAction: (id: string) => void
}

export function ObservatoryScene(props: SceneProps) {
  return props.state.scenario_id === 'sleep_vigilance' ? (
    <AnatomyStage {...props} />
  ) : (
    <DetectorStage {...props} />
  )
}

function sourceFor(state: StateEnvelope, sourceId: string): SourceStatus | undefined {
  return state.sources.find((source) => source.source_id === sourceId)
}

function AnatomyStage(props: SceneProps) {
  const [variant, setVariant] = useState<'male' | 'female'>('male')
  const [side, setSide] = useState<'front' | 'back'>('front')
  const reaction = sourceFor(props.state, 'reaction_task')

  return (
    <section className="observatory anatomy" aria-labelledby="anatomy-title">
      <header className="observatory__head">
        <div>
          <h2 id="anatomy-title">Crew demo 01</h2>
          <span>Synthetic crew scenario</span>
        </div>
        <span className="observatory__focus">
          <span className="observatory__focus-dot" aria-hidden="true" />
          Vigilance focus · head / eyes
        </span>
      </header>

      <div className="anatomy__stage">
        <svg
          className="anatomy__figure"
          data-variant={variant}
          data-side={side}
          viewBox="0 0 360 520"
          role="img"
          aria-label={`Stylized ${variant} hologram figure, ${side} view. Illustrative only; no measurements are mapped onto the body.`}
        >
          <defs>
            <linearGradient id="hologram-stroke" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#e2edff" />
              <stop offset=".45" stopColor="#9dc4ff" />
              <stop offset="1" stopColor="#6a9cf0" />
            </linearGradient>
            <radialGradient id="hologram-glow" cx=".5" cy=".5" r=".5">
              <stop offset="0" stopColor="#6fa6ff" stopOpacity=".32" />
              <stop offset=".7" stopColor="#2f6fe0" stopOpacity=".1" />
              <stop offset="1" stopColor="#2f6fe0" stopOpacity="0" />
            </radialGradient>
            <filter id="hologram-soft-glow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="3.2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <ellipse cx="180" cy="270" rx="145" ry="250" fill="url(#hologram-glow)" aria-hidden="true" />
          <g className="anatomy__scan" aria-hidden="true">
            <line x1="20" y1="120" x2="340" y2="120" />
            <line x1="20" y1="260" x2="340" y2="260" />
            <line x1="20" y1="400" x2="340" y2="400" />
          </g>

          <g className="anatomy__body" filter="url(#hologram-soft-glow)" aria-hidden="true">
            {/* Volumetric torso underlay */}
            <path
              className="anatomy__volume"
              d="M180 108 C150 108 130 124 118 148 C110 166 104 194 100 224 L94 270 C120 292 150 300 180 300 C210 300 240 292 266 270 L260 224 C256 194 250 166 242 148 C230 124 210 108 180 108 Z"
            />

            {/* head and neck */}
            <ellipse className="anatomy__head" cx="180" cy="64" rx="26" ry="33" />
            <path className="anatomy__outline" d="M166 95 L164 113 M194 95 L196 113" />
            {side === 'front' ? (
              <>
                <path className="anatomy__detail" d="M165 58 Q172 53 180 58 Q188 53 195 58" />
                <path className="anatomy__detail" d="M169 64 Q173 61 177 64 M183 64 Q187 61 191 64" />
                <circle className="anatomy__eye" cx="171" cy="66" r="3" />
                <circle className="anatomy__eye" cx="189" cy="66" r="3" />
                <path className="anatomy__detail" d="M180 66 V78 M176 84 Q180 87 184 84" />
              </>
            ) : (
              <>
                <path className="anatomy__detail" d="M180 97 V305 M171 54 Q180 47 189 54" />
                <path className="anatomy__detail" d="M164 78 Q180 88 196 78" opacity=".5" />
              </>
            )}

            {/* anatomical outer contour */}
            <path
              className="anatomy__outline"
              d="M180 26 C160 26 146 41 146 62 C146 78 153 92 163 101 L163 108 C145 112 128 121 118 136 C108 151 100 174 94 202 C88 230 84 262 80 294 C76 330 70 372 66 402 C72 410 82 407 86 399 C94 378 100 350 106 322 C110 302 114 278 117 258 C123 284 130 310 136 334 C143 366 147 404 149 438 C151 466 153 486 155 496 C161 503 171 500 175 492 C179 480 180 458 181 438 C182 458 183 480 187 492 C191 500 201 503 207 496 C209 486 211 466 213 438 C215 404 219 366 226 334 C232 310 239 284 245 258 C248 278 252 302 256 322 C262 350 268 378 276 399 C280 407 290 410 296 402 C292 372 286 330 282 294 C278 262 274 230 268 202 C262 174 254 151 244 136 C234 121 217 112 199 108 L199 101 C209 92 216 78 216 62 C216 41 202 26 180 26 Z"
            />

            {/* chest, ribcage and abdomen */}
            <path className="anatomy__detail" d="M147 120 Q165 132 180 130 Q195 132 213 120" />
            <path className="anatomy__detail" d="M153 136 Q166 151 180 142 Q194 151 207 136" />
            <path className="anatomy__detail" d="M180 132 V220" opacity=".7" />
            <path className="anatomy__detail" d="M151 154 Q180 175 209 154" opacity=".45" />
            <path className="anatomy__detail" d="M147 176 Q180 198 213 176" opacity=".35" />
            <path className="anatomy__detail" d="M151 198 Q180 216 209 198" opacity=".3" />
            <path className="anatomy__detail" d="M156 220 Q180 234 204 220" opacity=".45" />
            <path className="anatomy__detail" d="M160 240 Q180 252 200 240" opacity=".35" />
            <path className="anatomy__detail" d="M152 178 Q144 208 148 238 M208 178 Q216 208 212 238" opacity=".5" />
            <path className="anatomy__detail" d="M134 274 Q160 294 180 296 Q200 294 226 274" />
            <path className="anatomy__detail" d="M150 292 Q180 310 210 292" opacity=".6" />

            {/* deltoids, arms and hands */}
            <path className="anatomy__detail" d="M130 130 Q119 149 126 171 M230 130 Q241 149 234 171" opacity=".8" />
            <path className="anatomy__detail" d="M118 176 Q108 202 104 228 M242 176 Q252 202 256 228" opacity=".7" />
            <path className="anatomy__detail" d="M103 232 Q96 270 91 310 M257 232 Q264 270 269 310" opacity=".6" />
            <path className="anatomy__detail" d="M90 315 Q84 348 78 382 M270 315 Q276 348 282 382" opacity=".55" />
            <path className="anatomy__detail" d="M78 382 Q72 396 70 406 M282 382 Q288 396 290 406" opacity=".6" />
            <path className="anatomy__detail" d="M70 406 Q64 414 70 420 M290 406 Q296 414 290 420" opacity=".45" />

            {/* thighs, knees, calves and feet */}
            <path className="anatomy__detail" d="M137 322 Q142 356 146 392 M223 322 Q218 356 214 392" opacity=".8" />
            <path className="anatomy__detail" d="M146 398 Q150 438 153 474 M214 398 Q210 438 207 474" opacity=".7" />
            <path className="anatomy__detail" d="M160 326 Q166 368 163 408 M200 326 Q194 368 197 408" opacity=".5" />
            <path className="anatomy__detail" d="M152 430 Q160 448 156 474 M208 430 Q200 448 204 474" opacity=".45" />
            <path className="anatomy__detail" d="M153 474 Q146 492 132 498 L160 500 M207 474 Q214 492 228 498 L200 500" />
            <path className="anatomy__detail" d="M168 442 Q180 456 192 442" opacity=".4" />

            {/* joint markers */}
            <circle className="anatomy__joint" cx="130" cy="130" r="3" />
            <circle className="anatomy__joint" cx="230" cy="130" r="3" />
            <circle className="anatomy__joint" cx="103" cy="232" r="3" />
            <circle className="anatomy__joint" cx="257" cy="232" r="3" />
            <circle className="anatomy__joint" cx="90" cy="382" r="3" />
            <circle className="anatomy__joint" cx="270" cy="382" r="3" />
            <circle className="anatomy__joint" cx="136" cy="322" r="3" />
            <circle className="anatomy__joint" cx="224" cy="322" r="3" />
            <circle className="anatomy__joint" cx="146" cy="398" r="3" />
            <circle className="anatomy__joint" cx="214" cy="398" r="3" />
            <circle className="anatomy__joint" cx="153" cy="474" r="3" />
            <circle className="anatomy__joint" cx="207" cy="474" r="3" />

            {/* back-view structure */}
            {side === 'back' && (
              <>
                <path className="anatomy__detail" d="M142 148 Q180 168 218 148 M146 172 Q180 190 214 172" opacity=".7" />
                <path className="anatomy__detail" d="M158 278 Q180 300 202 278 M162 300 Q180 316 198 300" opacity=".6" />
                <path className="anatomy__detail" d="M180 104 V116 M176 120 h8 M176 136 h8 M176 152 h8 M176 168 h8" opacity=".7" />
              </>
            )}
          </g>

          <g className="anatomy__head-focus" aria-hidden="true">
            <circle cx="180" cy="64" r="43" />
            <path d="M180 12 V22 M180 106 V116 M127 64 H137 M223 64 H233" />
          </g>
        </svg>

        <svg className="anatomy__leaders" viewBox="0 0 360 520" aria-hidden="true" preserveAspectRatio="xMidYMid meet">
          <path d="M14 208 L128 218" />
          <path d="M346 116 L214 72" />
          <path d="M346 366 L220 322" />
          <circle cx="128" cy="218" r="3" />
          <circle cx="214" cy="72" r="3" />
          <circle cx="220" cy="322" r="3" />
        </svg>

        <button
          type="button"
          className="scene-callout scene-callout--sleep"
          aria-pressed={props.selectedSource === 'crew_sleep_log'}
          onClick={() => props.onSelectSource('crew_sleep_log')}
        >
          <span className="scene-callout__dot" />
          <span>
            Sleep history
            <small>View recorded nights</small>
          </span>
        </button>
        <button
          type="button"
          className="scene-callout scene-callout--reaction"
          onClick={() => props.onAction('start_reaction_check')}
        >
          <span className="scene-callout__dot" />
          <span>
            Reaction check
            <small>{reaction?.last_observation_id === null ? 'No result this session' : 'View the result'}</small>
          </span>
        </button>
        <button
          type="button"
          className="scene-callout scene-callout--why"
          onClick={props.onOpenEvidence}
        >
          <span className="scene-callout__dot" />
          <span>
            Why evidence
            <small>Read the explanation</small>
          </span>
        </button>
      </div>

      <footer className="observatory__foot">
        <div className="anatomy-controls" aria-label="Anatomy view">
          <div role="group" aria-label="Illustration variant">
            {(['male', 'female'] as const).map((item) => (
              <button key={item} aria-pressed={variant === item} onClick={() => setVariant(item)}>
                {item === 'male' ? 'Male' : 'Female'}
              </button>
            ))}
          </div>
          <div role="group" aria-label="Illustration direction">
            {(['front', 'back'] as const).map((item) => (
              <button key={item} aria-pressed={side === item} onClick={() => setSide(item)}>
                {item === 'front' ? 'Front' : 'Back'}
              </button>
            ))}
          </div>
        </div>
        <p className="scene-note">
          <span aria-hidden="true">i</span>
          Illustrative hologram · measurements shown in panels, not on the body.
        </p>
      </footer>
    </section>
  )
}

function DetectorStage(props: SceneProps) {
  const sources = props.state.sources
  return (
    <section className="observatory detector" aria-labelledby="detector-title">
      <header className="observatory__head">
        <div>
          <h2 id="detector-title">Inside the cabin</h2>
          <span>Two independent detector streams</span>
        </div>
        <span className="observatory__focus">
          <span className="observatory__focus-dot" aria-hidden="true" />
          Historical cabin data
        </span>
      </header>

      <div className="detector__stage">
        <svg
          className="detector__schematic"
          viewBox="0 0 480 360"
          role="img"
          aria-label="Illustrative cabin cross-section with two independent detector nodes, DosTel1 and DosTel2."
        >
          <defs>
            <linearGradient id="cabin-hull" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#1c3454" />
              <stop offset="1" stopColor="#0b1730" />
            </linearGradient>
            <linearGradient id="cabin-pod" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#dce9ff" />
              <stop offset="1" stopColor="#8fb4ff" />
            </linearGradient>
            <filter id="node-glow" x="-120%" y="-120%" width="340%" height="340%">
              <feGaussianBlur stdDeviation="5" />
            </filter>
          </defs>

          <g className="detector__hull" fill="none" stroke="#7fa9e8" strokeWidth="1.5">
            <path d="M78 74 Q78 48 108 44 H372 Q402 48 402 74 V268 Q402 302 368 306 H112 Q78 302 78 268 Z" fill="url(#cabin-hull)" />
            <path d="M92 88 H388 V252 H92 Z" opacity=".35" />
            <path d="M92 252 H388 M92 236 H388" opacity=".6" />
            <path d="M240 44 V88 M240 252 V306" opacity=".45" />
            <path d="M78 88 H92 M388 88 H402 M78 252 H92 M388 252 H402" opacity=".7" />
            <path d="M210 44 V58 M270 44 V58" opacity=".4" />
            <circle cx="240" cy="286" r="13" opacity=".5" />
          </g>

          {[{ x: 162, id: 'DosTel1' }, { x: 318, id: 'DosTel2' }].map((pod) => {
            const source = sourceFor(props.state, pod.id)
            return (
              <g key={pod.id} className="detector__pod" data-state={source?.state ?? 'missing'}>
                <path d={`M${pod.x - 16} 198 V168 H${pod.x + 16} V198`} fill="none" stroke="#8fb4ff" strokeWidth="1.4" opacity=".7" />
                <rect x={pod.x - 34} y="196" width="68" height="60" rx="10" fill="url(#cabin-pod)" stroke="#cfe0ff" strokeWidth="1.4" />
                <rect x={pod.x - 22} y="208" width="44" height="24" rx="4" fill="#0b1b33" />
                <circle className="detector__node-halo" cx={pod.x} cy="220" r="20" />
                <circle className="detector__node" cx={pod.x} cy="220" r="7" />
                <path d={`M${pod.x - 16} 240 H${pod.x + 16}`} stroke="#6d94c9" strokeWidth="2" opacity=".6" />
                <text className="detector__label" x={pod.x} y="286" textAnchor="middle">
                  {pod.id}
                </text>
              </g>
            )
          })}

          <text className="detector__caption" x="240" y="326" textAnchor="middle">
            CABIN CROSS-SECTION · illustrative only
          </text>
        </svg>
      </div>

      <div className="detector__sources" role="group" aria-label="Cabin instruments">
        {sources.map((source) => (
          <button
            key={source.source_id}
            aria-pressed={props.selectedSource === source.source_id}
            onClick={() => props.onSelectSource(source.source_id)}
          >
            <span>{source.source_id}</span>
            <span className="detector__node-key" data-state={source.state} aria-hidden="true" />
          </button>
        ))}
      </div>

      <footer className="observatory__foot">
        <p className="scene-note">
          <span aria-hidden="true">i</span>
          Historical cabin measurements — not personal exposure. Freshness, not radiation danger.
        </p>
      </footer>
    </section>
  )
}
