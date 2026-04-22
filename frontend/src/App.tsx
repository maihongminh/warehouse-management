import { useState } from 'react'
import { NavLink, Route, Routes } from 'react-router-dom'
import BackupPage from './pages/BackupPage'
import Dashboard from './pages/Dashboard'
import ImportPage from './pages/ImportPage'
import InvoicesPage from './pages/InvoicesPage'
import InventoryPage from './pages/InventoryPage'
import POS from './pages/POS'
import Products from './pages/Products'
import ReportsPage from './pages/ReportsPage'
import StockTakePage from './pages/StockTakePage'
import SuppliersPage from './pages/SuppliersPage'
import LockScreen from './components/LockScreen'

const nav = [
  { to: '/', label: 'Dashboard' },
  { to: '/pos', label: 'POS' },
  { to: '/products', label: 'Sản phẩm' },
  { to: '/inventory', label: 'Kho' },
  { to: '/import', label: 'Nhập kho' },
  { to: '/suppliers', label: 'Nhà CC' },
  { to: '/stock-take', label: 'Kiểm kho' },
  { to: '/invoices', label: 'Hóa đơn' },
  { to: '/reports', label: 'Báo cáo' },
  { to: '/backup', label: '⚙ Backup' },
]

export default function App() {
  const [isUnlocked, setIsUnlocked] = useState(false)

  if (!isUnlocked) {
    return <LockScreen onUnlock={() => setIsUnlocked(true)} />
  }

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 animate-in fade-in duration-500">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3">
          <div className="text-lg font-semibold tracking-tight">GTA Launcher</div>
          <nav className="flex flex-wrap gap-1">
            {nav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.to === '/'}
                className={({ isActive }) =>
                  [
                    'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-emerald-600 text-white'
                      : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800',
                  ].join(' ')
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/pos" element={<POS />} />
          <Route path="/products" element={<Products />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="/suppliers" element={<SuppliersPage />} />
          <Route path="/stock-take" element={<StockTakePage />} />
          <Route path="/invoices" element={<InvoicesPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/backup" element={<BackupPage />} />
        </Routes>
      </main>
    </div>
  )
}
