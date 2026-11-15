import { useEffect, useRef, useState } from 'react'

import { mountGalaxy, type GalaxyControl } from './galaxy'

/**
 * Hosts the supplied galaxy canvas. The canvas owns its animation loop; React only
 * mounts it once and forwards the ambient-motion pause flag.
 */
export function GalaxyBackground({ paused }: { paused: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const controlRef = useRef<GalaxyControl | null>(null)

  useEffect(() => {
    if (!canvasRef.current) return undefined
    const control = mountGalaxy(canvasRef.current)
    controlRef.current = control
    return () => {
      controlRef.current = null
      control.destroy()
    }
  }, [])

  useEffect(() => {
    controlRef.current?.setPaused(paused)
  }, [paused])

  return <canvas id="galaxy" ref={canvasRef} aria-hidden="true" data-paused={paused} />
}

export function useAmbientMotion(measuring: boolean) {
  const [userPaused, setUserPaused] = useState(false)
  const [hidden, setHidden] = useState(() => document.hidden)
  const [reduced, setReduced] = useState(
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
  )

  useEffect(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    const onPreference = () => setReduced(query?.matches ?? false)
    const onVisibility = () => setHidden(document.hidden)
    query?.addEventListener('change', onPreference)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      query?.removeEventListener('change', onPreference)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return {
    paused: userPaused || hidden || reduced || measuring,
    locked: reduced || measuring,
    label: measuring
      ? 'Motion paused for check'
      : reduced
        ? 'Reduced motion'
        : userPaused
          ? 'Resume motion'
          : 'Pause motion',
    toggle: () => setUserPaused((value) => !value),
  }
}
