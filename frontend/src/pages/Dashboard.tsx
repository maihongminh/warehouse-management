import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiGet } from '../api'
import { fCurrency, fQty } from '../utils/format'
import type { Dashboard as DashboardType } from '../types'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js'
import { Bar, Doughnut } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend)

type DailyRevenue = { date: string; revenue: number; profit: number }
type TopProduct = { name: string; quantity: number }

export default function Dashboard() {
  const [data, setData] = useState<DashboardType | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [dailyRevenue, setDailyRevenue] = useState<DailyRevenue[]>([])
  const [topProducts, setTopProducts] = useState<TopProduct[]>([])

  useEffect(() => {
    apiGet<DashboardType>('/reports/dashboard')
      .then(setData)
      .catch((e: Error) => setErr(e.message))
    apiGet<DailyRevenue[]>('/reports/revenue-daily?days=7')
      .then(setDailyRevenue)
      .catch(() => {})
    apiGet<TopProduct[]>('/reports/top-products?days=30&limit=6')
      .then(setTopProducts)
      .catch(() => {})
  }, [])

  if (err) {
    return <p className="text-red-600">Không tải được dashboard: {err}</p>
  }
  if (!data) {
    return <p className="text-zinc-500">Đang tải…</p>
  }

  // --- Chart configs ---
  const isDark = document.documentElement.classList.contains('dark')
  const textColor = isDark ? '#a1a1aa' : '#52525b'
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'

  const barData = {
    labels: dailyRevenue.map((d) => {
      const dt = new Date(d.date)
      return `${dt.getDate()}/${dt.getMonth() + 1}`
    }),
    datasets: [
      {
        label: 'Doanh thu',
        data: dailyRevenue.map((d) => d.revenue),
        backgroundColor: isDark
          ? 'rgba(52, 211, 153, 0.5)'
          : 'rgba(5, 150, 105, 0.6)',
        borderColor: isDark ? '#34d399' : '#059669',
        borderWidth: 1,
        borderRadius: 6,
      },
      {
        label: 'Lợi nhuận',
        data: dailyRevenue.map((d) => d.profit),
        backgroundColor: isDark
          ? 'rgba(14, 165, 233, 0.5)'
          : 'rgba(2, 132, 199, 0.6)',
        borderColor: isDark ? '#38bdf8' : '#0284c7',
        borderWidth: 1,
        borderRadius: 6,
      },
    ],
  }

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        labels: {
          color: textColor,
          usePointStyle: true,
          pointStyleWidth: 10,
          padding: 16,
          font: { size: 12 },
        },
      },
      tooltip: {
        callbacks: {
          label: (ctx: any) => `${fCurrency(ctx.raw)} ₫`,
        },
      },
    },
    scales: {
      x: {
        ticks: { color: textColor },
        grid: { display: false },
      },
      y: {
        ticks: {
          color: textColor,
          callback: (v: any) => {
            if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
            if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`
            return v
          },
        },
        grid: { color: gridColor },
      },
    },
  }

  const CHART_COLORS = [
    '#059669', '#0891b2', '#7c3aed', '#db2777', '#ea580c', '#ca8a04',
  ]

  const doughnutData = {
    labels: topProducts.map((p) => p.name),
    datasets: [
      {
        data: topProducts.map((p) => p.quantity),
        backgroundColor: CHART_COLORS.slice(0, topProducts.length),
        borderWidth: 0,
        hoverOffset: 8,
      },
    ],
  }

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '60%',
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          color: textColor,
          padding: 16,
          usePointStyle: true,
          pointStyleWidth: 10,
          font: { size: 12 },
        },
      },
    },
  }

  return (
    <div className="space-y-8">
      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Doanh thu hôm nay" value={fCurrency(data.revenue_today)} suffix="đ" color="emerald" />
        <Stat label="Lợi nhuận hôm nay" value={fCurrency(data.profit_today)} suffix="đ" color="cyan" />
        <Stat label="SKU tồn thấp (<10)" value={fQty(data.low_stock_count)} color="amber" />
        <Stat label="Lô sắp hết hạn (30 ngày)" value={fQty(data.expiring_soon_count)} color="rose" />
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Revenue Bar Chart */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            📊 Doanh thu & Lợi nhuận 7 ngày gần nhất
          </h3>
          <div className="h-64">
            {dailyRevenue.length > 0 ? (
              <Bar data={barData} options={barOptions} />
            ) : (
              <p className="flex h-full items-center justify-center text-zinc-400">Chưa có dữ liệu</p>
            )}
          </div>
        </div>

        {/* Top Products Doughnut */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            🏆 Top sản phẩm bán chạy (30 ngày)
          </h3>
          <div className="h-64">
            {topProducts.length > 0 ? (
              <Doughnut data={doughnutData} options={doughnutOptions} />
            ) : (
              <p className="flex h-full items-center justify-center text-zinc-400">Chưa có dữ liệu</p>
            )}
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <section>
        <h2 className="mb-3 text-lg font-medium text-zinc-900 dark:text-zinc-100">Truy cập nhanh</h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <QuickLink to="/pos" title="POS — Bán hàng" desc="Tạo đơn hàng nhanh, quản lý giỏ hàng và hóa đơn." />
          <QuickLink to="/import" title="Nhập kho" desc="Thêm hàng mới, quản lý lưu lô và công nợ nhà cung cấp." />
          <QuickLink to="/stock-take" title="Kiểm kho" desc="Kiểm đếm số lượng thực tế, tự động cân bằng tồn kho." />
        </ul>
      </section>
    </div>
  )
}

const COLOR_MAP: Record<string, string> = {
  emerald: 'text-emerald-700 dark:text-emerald-400',
  cyan: 'text-cyan-700 dark:text-cyan-400',
  amber: 'text-amber-700 dark:text-amber-400',
  rose: 'text-rose-700 dark:text-rose-400',
}

function Stat({ label, value, suffix, color }: { label: string; value: string; suffix?: string; color?: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${color ? COLOR_MAP[color] ?? '' : 'text-zinc-900 dark:text-zinc-100'}`}>
        {value}
        {suffix ? <span className="text-lg font-normal text-zinc-500"> {suffix}</span> : null}
      </p>
    </div>
  )
}

function QuickLink({ to, title, desc }: { to: string; title: string; desc: string }) {
  return (
    <li>
      <Link
        to={to}
        className="block rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50/50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-emerald-800 dark:hover:bg-emerald-950/30"
      >
        <p className="font-medium text-emerald-800 dark:text-emerald-300">{title}</p>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{desc}</p>
      </Link>
    </li>
  )
}
