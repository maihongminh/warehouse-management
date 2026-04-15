import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { apiGet } from '../api'
import type { PaginatedResponse, SaleWithItems } from '../types'
import Pagination from '../components/Pagination'

type SaleRow = Pick<SaleWithItems, 'id' | 'date' | 'total_amount' | 'status' | 'created_by'>

function defaultRange() {
  const t = new Date()
  const to = t.toISOString().slice(0, 10)
  const from = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-01`
  return { from, to }
}

function fmt(n: string | number) {
  return Number(n).toLocaleString('vi-VN')
}

const STATUS_LABEL: Record<string, string> = {
  completed: 'Hoàn thành',
  draft: 'Nháp',
  cancelled: 'Đã hủy',
}

const STATUS_CLASS: Record<string, string> = {
  completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  draft: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
}

export default function InvoicesPage() {
  const init = useMemo(() => defaultRange(), [])
  const [from, setFrom] = useState(init.from)
  const [to, setTo] = useState(init.to)
  const [statusFilter, setStatusFilter] = useState<'completed' | 'draft' | 'cancelled' | ''>('completed')
  const [paged, setPaged] = useState<PaginatedResponse<SaleRow> | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [detail, setDetail] = useState<SaleWithItems | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback((targetPage: number = page, targetSize: number = pageSize) => {
    setErr(null)
    setLoading(true)
    const params = new URLSearchParams()
    params.set('date_from', from)
    params.set('date_to', to)
    params.set('page', String(targetPage))
    params.set('size', String(targetSize))
    if (statusFilter) params.set('status', statusFilter)
    apiGet<PaginatedResponse<SaleRow>>(`/sales?${params.toString()}`)
      .then(setPaged)
      .catch((e: Error) => setErr(e.message))
      .finally(() => setLoading(false))
  }, [from, to, statusFilter, page, pageSize])

  useEffect(() => {
    load(page, pageSize)
  }, [load, page, pageSize])

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setPage(1)
    load(1)
  }

  const openDetail = (id: number) => {
    setDetailLoading(true)
    setDetail(null)
    apiGet<SaleWithItems>(`/sales/${id}`)
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setDetailLoading(false))
  }

  const totalRevenue = paged?.items
    .filter((s) => s.status === 'completed')
    .reduce((sum, s) => sum + Number(s.total_amount), 0) ?? 0

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold text-zinc-800 dark:text-zinc-100">Hóa đơn bán hàng</h1>
      </div>

      {/* Filter form */}
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
        <label className="flex flex-col gap-1 text-sm">
          Trạng thái
          <select
            className="rounded-lg border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          >
            <option value="">Tất cả</option>
            <option value="completed">Hoàn thành</option>
            <option value="draft">Nháp</option>
            <option value="cancelled">Đã hủy</option>
          </select>
        </label>
        <button type="submit" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-700">
          Làm mới
        </button>
      </form>

      {err ? <p className="text-red-600">{err}</p> : null}

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500">Số hóa đơn (trạng thái lọc)</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{paged?.total ?? 0}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500">HĐ hoàn thành (trang này)</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
            {paged?.items.filter((s) => s.status === 'completed').length ?? 0}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500">Doanh thu (trang này)</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
            {fmt(totalRevenue)} ₫
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-700">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-zinc-100 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
            <tr>
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">Ngày</th>
              <th className="px-3 py-2">Người tạo</th>
              <th className="px-3 py-2 text-right">Tổng tiền</th>
              <th className="px-3 py-2 text-center">Trạng thái</th>
              <th className="px-3 py-2 text-center">Chi tiết</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-zinc-400">Đang tải...</td>
              </tr>
            ) : !paged || paged.items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-zinc-400">
                  Không có hóa đơn trong khoảng thời gian này.
                </td>
              </tr>
            ) : (
              paged.items.map((s) => (
                <tr key={s.id} className="border-t border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                  <td className="px-3 py-2.5 font-mono text-xs text-zinc-500">#{s.id}</td>
                  <td className="px-3 py-2.5">{s.date}</td>
                  <td className="px-3 py-2.5 text-zinc-600 dark:text-zinc-400">{s.created_by}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-medium">
                    {fmt(s.total_amount)} ₫
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[s.status] ?? ''}`}>
                      {STATUS_LABEL[s.status] ?? s.status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <button
                      type="button"
                      onClick={() => openDetail(s.id)}
                      className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-white hover:bg-zinc-700 dark:bg-zinc-700 dark:hover:bg-zinc-600"
                    >
                      Xem
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {paged && (
          <Pagination 
            page={page} 
            totalPages={paged.total_pages} 
            pageSize={pageSize}
            onPageChange={setPage} 
            onPageSizeChange={(s) => { setPageSize(s); setPage(1) }}
          />
        )}
      </div>

      {/* Detail modal */}
      {(detail || detailLoading) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setDetail(null)}
        >
          <div
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-700">
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
                {detailLoading ? 'Đang tải...' : `Hóa đơn #${detail?.id}`}
              </h3>
              <button
                type="button"
                onClick={() => setDetail(null)}
                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
              >
                ✕
              </button>
            </div>

            {detail && (
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <div>
                    <p className="text-zinc-500">Ngày</p>
                    <p className="font-medium">{detail.date}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500">Người tạo</p>
                    <p className="font-medium">{detail.created_by}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500">Trạng thái</p>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[detail.status] ?? ''}`}>
                      {STATUS_LABEL[detail.status] ?? detail.status}
                    </span>
                  </div>
                  <div>
                    <p className="text-zinc-500">Tổng tiền</p>
                    <p className="font-semibold text-emerald-700 dark:text-emerald-400">{fmt(detail.total_amount)} ₫</p>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-800">
                      <tr>
                        <th className="px-3 py-2">Sản phẩm</th>
                        <th className="px-3 py-2 text-right">SL</th>
                        <th className="px-3 py-2 text-right">Đơn giá</th>
                        <th className="px-3 py-2 text-right">Thành tiền</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.items.map((item) => (
                        <tr key={item.id} className="border-t border-zinc-200 dark:border-zinc-700">
                          <td className="px-3 py-2">
                            <p className="font-medium">{item.product_name || `SP #${item.product_id}`}</p>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{item.quantity}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{fmt(item.sale_price)} ₫</td>
                          <td className="px-3 py-2 text-right tabular-nums font-medium">
                            {fmt(Number(item.sale_price) * item.quantity)} ₫
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-zinc-300 bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800">
                        <td colSpan={3} className="px-3 py-2 text-right font-semibold">Tổng cộng</td>
                        <td className="px-3 py-2 text-right tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">
                          {fmt(detail.total_amount)} ₫
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
