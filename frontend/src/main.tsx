import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'

const API_HEALTH = (import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000/api')
  .replace(/\/api$/, '') + '/health'

/**
 * Polls /health until backend is ready, then renders the App.
 * This prevents the "connection refused" flash when the sidecar is still starting up.
 */
function Root() {
  const [ready, setReady] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>

    async function check() {
      try {
        const res = await fetch(API_HEALTH, { signal: AbortSignal.timeout(1500) })
        if (res.ok && !cancelled) {
          setReady(true)
          return
        }
      } catch {
        // not ready yet
      }
      if (!cancelled) {
        setAttempt((n) => n + 1)
        timer = setTimeout(check, 800)
      }
    }

    check()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [])

  if (!ready) {
    return (
      <div className="loading-screen">
        <div className="loading-box">
          <div className="loading-spinner" />
          <p className="loading-title">Hiệu thuốc · Kho &amp; POS</p>
          <p className="loading-sub">Đang khởi động{'.'.repeat((attempt % 3) + 1)}</p>
        </div>
      </div>
    )
  }

  return (
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>
  )
}

createRoot(document.getElementById('root')!).render(<Root />)
