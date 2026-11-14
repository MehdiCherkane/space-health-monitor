import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { Gallery } from './gallery/Gallery'
import './ui'
import './styles.css'

// `?gallery` opens the static, API-free state gallery (Fixture preview only).
const showGallery = new URLSearchParams(window.location.search).has('gallery')

createRoot(document.getElementById('root')!).render(
  <StrictMode>{showGallery ? <Gallery /> : <App />}</StrictMode>,
)
