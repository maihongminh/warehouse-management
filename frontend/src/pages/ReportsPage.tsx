import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { apiGet } from '../api'
import type { Batch, PaginatedResponse } from '../types'
import Pagination from '../components/Pagination'
import { fCurrency, fQty } from '../utils/format'

type PeriodSummary = {
  date_from: string
  date_to: string
  revenue: string
  profit: string
  completed_sale_count: number
}

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
  const [expiringPaged, setExpiringPaged] = useState<PaginatedResponse<Batch> | null>(null)
  const [expiringPage, setExpiringPage] = useState(1)
  const [expiringPageSize, setExpiringPageSize] = useState(50)
  const [err, setErr] = useState<string | null>(null)

  const loadParams = useCallback(() => {
    setErr(null)
    const q = `date_from=${encodeURIComponent(from)}&date_to=${encodeURIComponent(to)}`
    apiGet<PeriodSummary>(`/reports/period?${q}`)
      .then(setSummary)
      .catch((e: Error) => setErr(e.message))
  }, [from, to])

  const loadExpiring = useCallback((p: number = expiringPage, s: number = expiringPageSize) => {
    apiGet<PaginatedResponse<Batch>>(`/inventory/batches/expiring?days=180&page=${p}&size=${s}`)
      .then(setExpiringPaged)
      .catch((e: Error) => setErr(e.message))
  }, [expiringPage, expiringPageSize])

  useEffect(() => {
    loadParams()
  }, [loadParams])

  useEffect(() => {
    loadExpiring(expiringPage, expiringPageSize)
  }, [loadExpiring, expiringPage, expiringPageSize])

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    loadParams()
    loadExpiring(1)
    setExpiringPage(1)
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold text-zinc-800 dark:text-zinc-100">Báo cáo</h1>
        <Link
          to="/invoices"
          className="ml-auto rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          📋 Xem danh sách hóa đơn →
        </Link>
      </div>

      <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-900/50">
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
        <button type="submit" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-700">
          Làm mới dữ liệu
        </button>
      </form>

      {err ? <p className="text-red-600">{err}</p> : null}

      {summary ? (
        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
            <p className="text-sm text-zinc-500">Doanh thu</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{fCurrency(summary.revenue)} ₫</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
            <p className="text-sm text-zinc-500">Lợi nhuận (theo snapshot giá nhập)</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{fCurrency(summary.profit)} ₫</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
            <p className="text-sm text-zinc-500">Số hóa đơn hoàn thành</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{fQty(summary.completed_sale_count)}</p>
          </div>
        </section>
      ) : (
        <p className="text-zinc-500">Đang tải số liệu…</p>
      )}

      <section>
        <h2 className="mb-2 text-lg font-medium">Lô sắp hết hạn (180 ngày, còn tồn)</h2>
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-700">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-zinc-100 text-xs uppercase text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              <tr>
                <th className="px-3 py-2">Sản phẩm</th>
                <th className="px-3 py-2">Mã lô</th>
                <th className="px-3 py-2">HSD</th>
                <th className="px-3 py-2 text-right">Tồn</th>
              </tr>
            </thead>
            <tbody>
              {expiringPaged?.items.map((b) => {
                const days = Math.ceil((new Date(b.expiry_date).getTime() - Date.now()) / 86400000)
                return (
                  <tr
                    key={b.id}
                    className={`border-t border-zinc-200 dark:border-zinc-700 ${days <= 7 ? 'bg-red-50 dark:bg-red-950/20' : 'bg-amber-50 dark:bg-amber-950/10'}`}
                  >
                    <td className="px-3 py-2">
                      <p className="font-medium text-zinc-900 dark:text-zinc-100">
                        {b.product_name ?? `SP #${b.product_id}`}
                      </p>
                      <p className="font-mono text-xs text-zinc-400">{b.product_sku ?? ''}</p>
                    </td>
                    <td className="px-3 py-2 font-mono text-sm">{b.batch_code || '—'}</td>
                    <td className="px-3 py-2">
                      {b.expiry_date}
                      <span className={`ml-2 text-xs font-medium ${days <= 7 ? 'text-red-600' : 'text-amber-600'}`}>
                        ({days}d)
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">{b.quantity_remaining}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {expiringPaged && expiringPaged.items.length === 0 && summary ? (
            <p className="p-4 text-zinc-500">Không có lô trong cửa sổ 180 ngày.</p>
          ) : null}
          {expiringPaged && (
            <Pagination 
              page={expiringPage} 
              totalPages={expiringPaged.total_pages} 
              pageSize={expiringPageSize}
              onPageChange={setExpiringPage} 
              onPageSizeChange={(s) => { setExpiringPageSize(s); setExpiringPage(1) }}
            />
          )}
        </div>
      </section>
    </div>
  )
}
