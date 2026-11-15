/**
 * Galaxy canvas and animation script copied from the supplied
 * galaxy-background-final.html. Only the requested integration changes were added:
 * a paused flag that freezes the frame, a 1.5 device-pixel-ratio cap and a
 * 12,000-star budget on small or low-power screens.
 */
export interface GalaxyControl {
  setPaused(paused: boolean): void
  destroy(): void
}

type StarKey = 'white' | 'pale' | 'blue' | 'orange' | 'red'

interface ForegroundStar {
  x: number
  y: number
  s: number
  k: StarKey
  big: boolean
  p: number
  f: number
  d: number
  halo?: number
  vert?: boolean
}

export function mountGalaxy(cv: HTMLCanvasElement): GalaxyControl {
  const context = cv.getContext('2d')
  if (!context) {
    return { setPaused: () => undefined, destroy: () => undefined }
  }
  const ctx: CanvasRenderingContext2D = context

  const CFG = {
    stars: 22000,
    inclination: 1.36,
    roll: -0.5,
    speed: 1,
    size: 1,
  }
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false
  const rnd = Math.random
  const TAU = Math.PI * 2
  const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) * 1.2
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t

  const hardware = navigator as Navigator & { hardwareConcurrency?: number; deviceMemory?: number }
  const smallScreen =
    innerWidth < 900 ||
    (hardware.hardwareConcurrency ?? 8) <= 4 ||
    (hardware.deviceMemory ?? 8) <= 4

  let W = 0
  let H = 0
  let DPR = 1
  let R = 0
  let bg: CanvasGradient | null = null
  let paused = reducedMotion
  let pausedAt = 0
  let raf = 0
  let t0 = performance.now()

  function resize() {
    DPR = Math.min(devicePixelRatio || 1, 1.5)
    W = innerWidth
    H = innerHeight
    cv.width = W * DPR
    cv.height = H * DPR
    R = Math.max(W, H) * 0.95
    bg = ctx.createRadialGradient(W * 0.52, H * 0.5, 0, W * 0.52, H * 0.5, Math.max(W, H) * 0.8)
    bg.addColorStop(0, '#0b1530')
    bg.addColorStop(0.6, '#050a1c')
    bg.addColorStop(1, '#02030a')
  }

  function sprite(size: number, stops: Array<[number, string]>) {
    const c = document.createElement('canvas')
    c.width = c.height = size
    const g = c.getContext('2d')
    if (!g) return c
    const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    stops.forEach((s) => gr.addColorStop(s[0], s[1]))
    g.fillStyle = gr
    g.fillRect(0, 0, size, size)
    return c
  }

  const glow = (r: number, g: number, b: number) =>
    sprite(64, [
      [0, `rgba(${r},${g},${b},1)`],
      [0.12, `rgba(${r},${g},${b},.55)`],
      [0.4, `rgba(${r},${g},${b},.12)`],
      [1, `rgba(${r},${g},${b},0)`],
    ])
  const haloBlue = sprite(256, [
    [0, 'rgba(100,135,230,.11)'],
    [0.6, 'rgba(80,110,210,.05)'],
    [1, 'rgba(60,90,200,0)'],
  ])
  const discWarm = sprite(256, [
    [0, 'rgba(255,212,165,.5)'],
    [0.3, 'rgba(250,190,140,.4)'],
    [0.55, 'rgba(228,168,135,.24)'],
    [0.8, 'rgba(150,150,215,.09)'],
    [1, 'rgba(100,130,220,0)'],
  ])
  const bulge = sprite(256, [
    [0, 'rgba(255,240,220,.9)'],
    [0.18, 'rgba(255,215,165,.6)'],
    [0.45, 'rgba(255,180,120,.24)'],
    [0.75, 'rgba(240,150,110,.05)'],
    [1, 'rgba(240,150,110,0)'],
  ])
  const hazeBlue = sprite(128, [
    [0, 'rgba(150,178,255,1)'],
    [0.4, 'rgba(130,160,255,.35)'],
    [1, 'rgba(120,150,255,0)'],
  ])
  const dustSpr = sprite(64, [
    [0, 'rgba(150,72,22,.9)'],
    [0.5, 'rgba(150,72,22,.35)'],
    [1, 'rgba(150,72,22,0)'],
  ])
  const G: Record<string, HTMLCanvasElement> = {
    white: glow(255, 255, 255),
    blue: glow(120, 170, 255),
    orange: glow(255, 170, 90),
    red: glow(255, 110, 80),
    pale: glow(210, 225, 255),
  }

  const RINGS = [0.42, 0.62, 0.84]
  const pickRing = () => {
    const u = rnd()
    return u < 0.25 ? 0 : u < 0.65 ? 1 : 2
  }
  const N = smallScreen ? 12000 : CFG.stars
  const NH = 900
  const TOT = N + NH
  const pr = new Float32Array(TOT)
  const pth = new Float32Array(TOT)
  const pz = new Float32Array(TOT)
  const psz = new Float32Array(TOT)
  const pcol: string[] = new Array(TOT)

  for (let i = 0; i < N; i += 1) {
    const u = rnd()
    let r: number
    let z: number
    let bl = 0
    let sz = 0.6 + Math.pow(rnd(), 3) * 1.5
    let al = 0.15 + rnd() * 0.35
    if (u < 0.16) {
      r = Math.abs(gauss()) * 0.14
      z = gauss() * 0.09
      al *= 0.6
    } else if (u < 0.52) {
      r = 0.05 - Math.log(1 - rnd() * 0.97) * 0.38
      if (r > 1.1) r = rnd()
      z = gauss() * 0.02
    } else {
      r = RINGS[pickRing()] + gauss() * 0.05
      z = gauss() * 0.015
      bl = 0.25
    }
    const t = Math.min(r / 1.1 + bl, 1)
    let col = `rgba(${lerp(255, 150, t) | 0},${lerp(215, 185, t) | 0},${lerp(165, 255, t) | 0},${al})`
    if (r > 0.3 && rnd() < 0.04) {
      col = 'rgba(195,218,255,.95)'
      sz = 1.6 + rnd()
    }
    pr[i] = r
    pth[i] = rnd() * TAU
    pz[i] = z
    psz[i] = sz
    pcol[i] = col
  }

  for (let c = 0; c < NH / 12; c += 1) {
    const rc = RINGS[pickRing()] + 0.02 + gauss() * 0.02
    const tc = rnd() * TAU
    for (let k = 0; k < 12; k += 1) {
      const i = N + c * 12 + k
      pr[i] = rc + gauss() * 0.01
      pth[i] = tc + gauss() * 0.03
      pz[i] = 0
      psz[i] = 1.6 + rnd() * 2
      pcol[i] = `rgba(255,${50 + ((rnd() * 50) | 0)},${110 + ((rnd() * 50) | 0)},.9)`
    }
  }

  const D = 9000
  const dr = new Float32Array(D)
  const dth = new Float32Array(D)
  const dsz = new Float32Array(D)
  for (let c = 0; c < D / 40; c += 1) {
    const rc = RINGS[pickRing()] - 0.03 + gauss() * 0.02
    const tc = rnd() * TAU
    const len = 0.2 + rnd() * 0.7
    for (let k = 0; k < 40; k += 1) {
      const i = c * 40 + k
      dr[i] = rc + gauss() * 0.012
      dth[i] = tc + (rnd() - 0.5) * len
      dsz[i] = 0.012 + rnd() * 0.02
    }
  }

  const pal: StarKey[] = ['white', 'white', 'pale', 'blue', 'orange', 'orange', 'red']
  const rgbOf: Record<StarKey, string> = {
    white: '#fff',
    pale: '#dbe8ff',
    blue: '#9cc4ff',
    orange: '#ffbb80',
    red: '#ff9a7a',
  }
  const fg: ForegroundStar[] = Array.from({ length: 1100 }, (_, i) => {
    const k = pal[(rnd() * pal.length) | 0]
    const big = i < 36
    return {
      x: rnd(),
      y: rnd(),
      s: big ? 1.4 + rnd() * 1.8 : 0.5 + rnd() * 1.1,
      k,
      big,
      p: rnd() * 6.28,
      f: 0.5 + rnd() * 2,
      d: 0.2 + rnd() * 0.8,
    }
  })
  fg.push({ x: 0.085, y: 0.535, s: 4.5, k: 'blue', big: true, p: 0, f: 0.4, d: 0.5, halo: 0.13 })
  fg.push({ x: 0.135, y: 0.05, s: 3.5, k: 'orange', big: true, p: 1, f: 0.4, d: 0.5, vert: true })

  let mx = 0
  let my = 0
  let ox = 0
  let oy = 0
  const onPointer = (e: PointerEvent) => {
    mx = e.clientX / innerWidth - 0.5
    my = e.clientY / innerHeight - 0.5
  }

  function draw(now: number) {
    const clock = paused ? pausedAt : now
    const t = ((clock - t0) / 1000) * CFG.speed * (reducedMotion ? 0.3 : 1)
    ox += (mx - ox) * 0.04
    oy += (my - oy) * 0.04
    const inc = CFG.inclination + oy * 0.25
    const roll = CFG.roll + ox * 0.2
    const ci = Math.cos(inc)
    const si = Math.sin(inc)
    const cr = Math.cos(roll)
    const sr = Math.sin(roll)
    const cx = W * 0.52
    const cy = H * 0.5
    const spin = t * 0.06
    const flat = ci * 0.95 + 0.1
    const ell = (spr: HTMLCanvasElement, w: number, f: number, alpha: number) => {
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(roll)
      ctx.scale(1, f)
      ctx.globalAlpha = alpha
      ctx.drawImage(spr, -w / 2, -w / 2, w, w)
      ctx.restore()
    }

    ctx.setTransform(DPR, 0, 0, DPR, 0, 0)
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 1
    if (bg) {
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, W, H)
    }
    ctx.globalCompositeOperation = 'lighter'

    ell(haloBlue, R * 2.6, flat, 1)
    ell(discWarm, R * 1.9, flat, 1)
    ell(bulge, R * 0.85, 0.6, 1)
    ctx.globalAlpha = 1
    const mxp = cx - W * 0.29
    const myp = cy - H * 0.07
    const ms = W * 0.075
    ctx.save()
    ctx.translate(mxp, myp)
    ctx.scale(1, 0.8)
    ctx.drawImage(bulge, -ms / 2, -ms / 2, ms, ms)
    ctx.drawImage(G.orange, -ms / 6, -ms / 6, ms / 3, ms / 3)
    ctx.restore()

    ctx.globalAlpha = 0.55
    const sc = CFG.size
    for (let i = 0; i < TOT; i += 1) {
      const a = pth[i] + spin
      const r = pr[i]
      const x = r * Math.cos(a)
      const y = r * Math.sin(a) * ci + pz[i] * si
      const px = cx + (x * cr - y * sr) * R
      const py = cy + (x * sr + y * cr) * R
      if (px < -5 || px > W + 5 || py < -5 || py > H + 5) continue
      const s = psz[i] * sc
      ctx.fillStyle = pcol[i]
      ctx.fillRect(px - s / 2, py - s / 2, s, s)
    }

    ctx.globalCompositeOperation = 'source-over'
    for (let i = 0; i < D; i += 1) {
      const a = dth[i] + spin
      const r = dr[i]
      const x = r * Math.cos(a)
      const y = r * Math.sin(a) * ci
      const px = cx + (x * cr - y * sr) * R
      const py = cy + (x * sr + y * cr) * R
      const d = dsz[i] * R
      if (px < -d || px > W + d || py < -d || py > H + d) continue
      ctx.globalAlpha = y > 0 ? 0.085 : 0.03
      ctx.drawImage(dustSpr, px - d / 2, py - d / 2, d, d)
    }

    ctx.globalCompositeOperation = 'lighter'
    for (const s of fg) {
      const x = ((s.x + ox * 0.02 * s.d + 1) % 1) * W
      const y = ((s.y + oy * 0.02 * s.d + 1) % 1) * H
      const a = 0.65 + 0.35 * Math.sin((clock / 1000) * s.f + s.p)
      ctx.globalAlpha = a
      ctx.fillStyle = rgbOf[s.k]
      if (!s.big) {
        ctx.fillRect(x - s.s / 2, y - s.s / 2, s.s, s.s)
        continue
      }
      const gs = s.s * 9
      if (s.halo) {
        ctx.globalAlpha = 0.55
        const hw = W * s.halo
        ctx.drawImage(G.blue, x - hw / 2, y - hw / 2, hw, hw)
        ctx.globalAlpha = a
      }
      ctx.drawImage(G[s.k], x - gs / 2, y - gs / 2, gs, gs)
      const L = s.s * (s.vert ? 22 : 10)
      ctx.globalAlpha = a * 0.1
      for (let q = 1; q <= 3; q += 1) {
        const l = L / q
        ctx.fillRect(x - l, y - 0.45, l * 2, 0.9)
        ctx.fillRect(x - 0.45, y - l * (s.vert ? 1.4 : 1), 0.9, l * (s.vert ? 2.8 : 2))
      }
      ctx.globalAlpha = a
      ctx.fillRect(x - 1.2, y - 1.2, 2.4, 2.4)
    }
  }

  function frame(now: number) {
    if (!paused) draw(now)
    raf = requestAnimationFrame(frame)
  }

  function onResize() {
    resize()
    if (paused) draw(performance.now())
  }

  addEventListener('resize', onResize)
  addEventListener('pointermove', onPointer)
  resize()
  raf = requestAnimationFrame(frame)

  return {
    setPaused(value: boolean) {
      if (value === paused) return
      if (value) {
        pausedAt = performance.now()
        paused = true
      } else {
        t0 += performance.now() - pausedAt
        paused = false
      }
    },
    destroy() {
      cancelAnimationFrame(raf)
      removeEventListener('resize', onResize)
      removeEventListener('pointermove', onPointer)
    },
  }
}
