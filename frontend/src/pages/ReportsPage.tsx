import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { apiGet } from '../api'
import type { Batch, SaleWithItems } from '../types'

type PeriodSummary = {
  date_from: string
  date_to: string
  revenue: string
  profit: string
  completed_sale_count: number
}

type SaleRow = Pick<SaleWithItems, 'id' | 'date' | 'total_amount' | 'status' | 'created_by'>

function defaultRange(): { from: string; to: string } {
  const t = new Date()
  const to = t.toISOString().slice(0, 10)
  const from = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-01`
  return { from, to }
}

export default function ReportsPage() {
  const init = useMemo(() => defaultRange(), [])
  const [from, setFrom] = useState(init.from)
  const [to, setTo] = useState(init.to)
  const [summary, setSummary] = useState<PeriodSummary | null>(null)
  const [sales, setSales] = useState<SaleRow[]>([])
  const [expiring, setExpiring] = useState<Batch[]>([])
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(() => {
    setErr(null)
    const q = `date_from=${encodeURIComponent(from)}&date_to=${encodeURIComponent(to)}`
    Promise.all([
      apiGet<PeriodSummary>(`/reports/period?${q}`),
      apiGet<SaleRow[]>(`/sales?status=completed&${q}&limit=500`),
      apiGet<Batch[]>('/inventory/batches/expiring?days=30'),
    ])
      .then(([s, sl, ex]) => {
        setSummary(s)
        setSales(sl)
        setExpiring(ex)
      })
      .catch((e: Error) => setErr(e.message))
  }, [from, to])

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    load()
  }

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="space-y-10">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Phase 5 — tổng hợp theo kỳ, danh sách hóa đơn hoàn thành, cảnh báo lô sắp hết hạn.{' '}
        <Link to="/" className="text-emerald-700 underline dark:text-emerald-400">
          Về Dashboard
        </Link>
      </p>

      <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Từ ngày
          <input
            type="date"
            className="rounded-lg border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Đến ngày
          <input
            type="date"
            className="rounded-lg border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            required
          />
        </label>
        <button type="submit" className="rounded-lg bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700">
          Tải báo cáo
        </button>
      </form>

      {err ? <p className="text-red-600">{err}</p> : null}

      {summary ? (
        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
            <p className="text-sm text-zinc-500">Doanh thu</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{summary.revenue}</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
            <p className="text-sm text-zinc-500">Lợi nhuận (theo snapshot giá nhập)</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{summary.profit}</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
            <p className="text-sm text-zinc-500">Số hóa đơn hoàn thành</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{summary.completed_sale_count}</p>
          </div>
        </section>
      ) : (
        <p className="text-zinc-500">Bấm «Tải báo cáo» để xem số liệu.</p>
      )}

      <section>
        <h2 className="mb-2 text-lg font-medium">Hóa đơn trong kỳ</h2>
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-700">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-zinc-100 dark:bg-zinc-800">
              <tr>
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Ngày</th>
                <th className="px-3 py-2">Tổng</th>
                <th className="px-3 py-2">Người tạo</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((s) => (
                <tr key={s.id} className="border-t border-zinc-200 dark:border-zinc-700">
                  <td className="px-3 py-2 font-mono">{s.id}</td>
                  <td className="px-3 py-2">{s.date}</td>
                  <td className="px-3 py-2 tabular-nums">{s.total_amount}</td>
                  <td className="px-3 py-2">{s.created_by}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {sales.length === 0 && summary ? (
            <p className="p-4 text-zinc-500">Không có hóa đơn hoàn thành trong kỳ.</p>
          ) : null}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-medium">Lô sắp hết hạn (30 ngày, còn tồn)</h2>
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-700">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-zinc-100 dark:bg-zinc-800">
              <tr>
                <th className="px-3 py-2">Lô #</th>
                <th className="px-3 py-2">SP #</th>
                <th className="px-3 py-2">Mã lô</th>
                <th className="px-3 py-2">HSD</th>
                <th className="px-3 py-2">Tồn</th>
              </tr>
            </thead>
            <tbody>
              {expiring.map((b) => (
                <tr key={b.id} className="border-t border-zinc-200 dark:border-zinc-700">
                  <td className="px-3 py-2 font-mono">{b.id}</td>
                  <td className="px-3 py-2">{b.product_id}</td>
                  <td className="px-3 py-2 font-mono">{b.batch_code || '—'}</td>
                  <td className="px-3 py-2">{b.expiry_date}</td>
                  <td className="px-3 py-2 tabular-nums">{b.quantity_remaining}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {expiring.length === 0 && summary ? (
            <p className="p-4 text-zinc-500">Không có lô trong cửa sổ 30 ngày.</p>
          ) : null}
        </div>
      </section>
    </div>
  )
}
