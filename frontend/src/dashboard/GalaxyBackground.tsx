import { useEffect, useState } from 'react'

/** The star artwork is static. Only one compositor transform moves during idle use. */
export function GalaxyBackground({ paused }: { paused: boolean }) {
  return (
    <div className="cosmos" aria-hidden="true" data-paused={paused}>
      <div className="cosmos__stars" />
      <div className="cosmos__plane"><img className="cosmos__galaxy" src="/art/galaxy.svg" alt="" /></div>
    </div>
  )
}

export function useAmbientMotion(measuring: boolean) {
  const [userPaused, setUserPaused] = useState(false)
  const [hidden, setHidden] = useState(() => document.hidden)
  const [reduced, setReduced] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)
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
    label: measuring ? 'Motion paused for check' : reduced ? 'Reduced motion' : userPaused ? 'Resume motion' : 'Pause motion',
    toggle: () => setUserPaused((value) => !value),
  }
}
