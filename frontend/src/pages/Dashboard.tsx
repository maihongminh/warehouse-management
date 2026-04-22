import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiGet } from '../api'
import { fCurrency, fQty } from '../utils/format'
import type { Dashboard as DashboardType } from '../types'

export default function Dashboard() {
  const [data, setData] = useState<DashboardType | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    apiGet<DashboardType>('/reports/dashboard')
      .then(setData)
      .catch((e: Error) => setErr(e.message))
  }, [])

  if (err) {
    return <p className="text-red-600">Không tải được dashboard: {err}</p>
  }
  if (!data) {
    return <p className="text-zinc-500">Đang tải…</p>
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Doanh thu hôm nay" value={fCurrency(data.revenue_today)} suffix="đ" />
        <Stat label="Lợi nhuận hôm nay" value={fCurrency(data.profit_today)} suffix="đ" />
        <Stat label="SKU tồn thấp (<10)" value={fQty(data.low_stock_count)} />
        <Stat label="Lô sắp hết hạn (30 ngày)" value={fQty(data.expiring_soon_count)} />
      </div>

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

function Stat({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
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
