import { useState, useEffect, useRef } from 'react'

interface LockScreenProps {
  onUnlock: () => void
}

export default function LockScreen({ onUnlock }: LockScreenProps) {
  const [mode, setMode] = useState<'setup' | 'unlock'>('unlock')
  const [key, setKey] = useState('')
  const [confirmKey, setConfirmKey] = useState('')
  const [error, setError] = useState('')
  const [unlocked, setUnlocked] = useState(false)
  
  // Timer for reset logic
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [isHolding, setIsHolding] = useState(false)
  const [holdProgress, setHoldProgress] = useState(0)

  useEffect(() => {
    const savedKey = localStorage.getItem('wm_app_key')
    if (!savedKey) {
      setMode('setup')
    } else {
      setMode('unlock')
    }
    
    // Cleanup on unmount
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (progressRef.current) clearInterval(progressRef.current)
    }
  }, [])

  const handleSetup = () => {
    setError('')
    if (!key) {
      setError('Vui lòng nhập mã khóa mới.')
      return
    }
    if (key !== confirmKey) {
      setError('Mã xác nhận không khớp.')
      return
    }
    localStorage.setItem('wm_app_key', key)
    onUnlock()
  }

  const handleUnlock = () => {
    setError('')
    const savedKey = localStorage.getItem('wm_app_key')
    if (key === savedKey) {
      setUnlocked(true)
      setTimeout(onUnlock, 300) // Small delay for animation
    } else {
      setError('Mã khóa không chính xác. Vui lòng thử lại.')
      setKey('')
    }
  }

  // Hidden Reset Logic (10s hold)
  const startTimer = () => {
    setIsHolding(true)
    setHoldProgress(0)
    
    // Clear any existing
    if (timerRef.current) clearTimeout(timerRef.current)
    if (progressRef.current) clearInterval(progressRef.current)

    // Progress interval (100ms * 100 = 10s)
    progressRef.current = setInterval(() => {
      setHoldProgress(prev => {
        if (prev >= 100) {
          if (progressRef.current) clearInterval(progressRef.current)
          return 100
        }
        return prev + 1
      })
    }, 100)

    timerRef.current = setTimeout(() => {
      if (progressRef.current) clearInterval(progressRef.current)
      const secret = 'anhminhdeptrai'
      localStorage.setItem('wm_app_key', secret)
      alert(`ĐÃ ĐẶT LẠI MÃ THÀNH CÔNG!\nMã mới là: ${secret}`)
      window.location.reload()
    }, 10000)
  }

  const stopTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (progressRef.current) {
      clearInterval(progressRef.current)
      progressRef.current = null
    }
    setIsHolding(false)
    setHoldProgress(0)
  }

  return (
    <div className={`fixed inset-0 z-[9999] flex items-center justify-center bg-zinc-100 dark:bg-zinc-950 transition-opacity duration-500 ${unlocked ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
      <div className="w-full max-w-md p-8">
        <div className="text-center space-y-6">
          {/* Logo / Icon */}
          <div className="mx-auto w-20 h-20 bg-emerald-600 rounded-3xl flex items-center justify-center shadow-xl shadow-emerald-500/20 mb-8">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002-2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>

          <h2 className="text-3xl font-bold text-zinc-800 dark:text-zinc-100">
            {mode === 'setup' ? 'Thiết lập bảo mật' : 'Yêu cầu truy cập'}
          </h2>
          
          <p className="text-zinc-500 dark:text-zinc-400">
            {mode === 'setup' 
              ? 'Vui lòng đặt mã khóa để bảo vệ dữ liệu cửa hàng của bạn.' 
              : 'Vui lòng nhập mã khóa để tiếp tục sử dụng ứng dụng.'}
          </p>

          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <input
                type="password"
                className="w-full text-center text-2xl tracking-widest rounded-2xl border border-zinc-200 bg-white px-4 py-4 focus:ring-2 focus:ring-emerald-500 outline-none transition-all dark:border-zinc-800 dark:bg-zinc-900"
                placeholder="••••"
                autoFocus
                value={key}
                onChange={(e) => setKey(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (mode === 'setup' ? null : handleUnlock())}
              />
              
              {mode === 'setup' && (
                <input
                  type="password"
                  className="w-full text-center text-2xl tracking-widest rounded-2xl border border-zinc-200 bg-white px-4 py-4 focus:ring-2 focus:ring-emerald-500 outline-none transition-all dark:border-zinc-800 dark:bg-zinc-900"
                  placeholder="Xác nhận mã"
                  value={confirmKey}
                  onChange={(e) => setConfirmKey(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSetup()}
                />
              )}
            </div>

            {error && (
              <p className="text-sm font-medium text-red-500 animate-pulse">{error}</p>
            )}

            <div className="relative pt-4">
              <button
                type="button"
                onMouseDown={startTimer}
                onMouseUp={stopTimer}
                onMouseLeave={stopTimer}
                onClick={() => (mode === 'setup' ? handleSetup() : handleUnlock())}
                className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-semibold text-lg hover:bg-zinc-800 active:scale-[0.98] transition-all dark:bg-emerald-600 dark:hover:bg-emerald-500 overflow-hidden relative"
              >
                {/* Hold Progress Bar */}
                {isHolding && (
                  <div 
                    className="absolute bottom-0 left-0 h-1 bg-white/30 transition-all duration-100" 
                    style={{ width: `${holdProgress}%` }}
                  />
                )}
                {mode === 'setup' ? 'Lưu mã khóa' : 'Xác nhận mở khóa'}
              </button>
              
              {isHolding && holdProgress > 10 && (
                <p className="mt-2 text-xs text-zinc-400 italic">
                  Đang giữ để đặt lại mã... ({Math.ceil((100 - holdProgress) / 10)}s)
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
