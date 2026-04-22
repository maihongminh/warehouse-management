import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { apiGet, apiPost } from '../api'
import type { PaginatedResponse, SaleReturn, SaleWithItems } from '../types'
import Pagination from '../components/Pagination'
import ConfirmDialog from '../components/ConfirmDialog'
import { fCurrency, fQty } from '../utils/format'

type SaleRow = Pick<SaleWithItems, 'id' | 'date' | 'total_amount' | 'returned_amount' | 'status' | 'created_by'>

function defaultRange() {
  const t = new Date()
  const to = t.toISOString().slice(0, 10)
  const from = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-01`
  return { from, to }
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

  // Return functionality
  const [showReturnModal, setShowReturnModal] = useState(false)
  const [returnQtys, setReturnQtys] = useState<Record<number, string>>({})
  const [returnNote, setReturnNote] = useState('')
  const [returnLoading, setReturnLoading] = useState(false)
  const [returnMsg, setReturnMsg] = useState<string | null>(null)
  const [returnErr, setReturnErr] = useState<string | null>(null)
  const [returnHistory, setReturnHistory] = useState<SaleReturn[]>([])
  const [returnConfirm, setReturnConfirm] = useState(false)

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
    setReturnHistory([])
    setReturnMsg(null)
    setReturnErr(null)
    apiGet<SaleWithItems>(`/sales/${id}`)
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setDetailLoading(false))
    // Load return history
    apiGet<SaleReturn[]>(`/sales/${id}/returns`)
      .then(setReturnHistory)
      .catch(() => setReturnHistory([]))
  }

  const openReturnModal = () => {
    if (!detail) return
    setReturnQtys({})
    setReturnNote('')
    setReturnErr(null)
    setShowReturnModal(true)
  }

  const submitReturn = () => {
    if (!detail) return
    setReturnConfirm(false)
    const items = detail.items
      .filter((it) => Number(returnQtys[it.id] ?? 0) > 0)
      .map((it) => ({ sale_item_id: it.id, quantity: Number(returnQtys[it.id]) }))
    if (!items.length) { setReturnErr('Nhập số lượng trả cho ít nhất một sản phẩm.'); return }
    setReturnLoading(true)
    setReturnErr(null)
    apiPost<SaleReturn>(`/sales/${detail.id}/return`, { items, note: returnNote || null })
      .then(() => {
        window.location.reload()
      })
      .catch((e: Error) => setReturnErr(e.message))
      .finally(() => setReturnLoading(false))
  }

  const totalRevenue = paged?.items
    .filter((s) => s.status === 'completed')
    .reduce((sum, s) => sum + Number(s.total_amount) - Number(s.returned_amount ?? 0), 0) ?? 0

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
          <p className="mt-1 text-2xl font-semibold tabular-nums">{fQty(paged?.total ?? 0)}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500">HĐ hoàn thành (trang này)</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
            {fQty(paged?.items.filter((s) => s.status === 'completed').length ?? 0)}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500">Doanh thu thực (trang này)</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
            {fCurrency(totalRevenue)} ₫
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
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {(() => {
                      const gross = Number(s.total_amount)
                      const ret = Number(s.returned_amount ?? 0)
                      if (ret > 0) {
                        return (
                          <div className="flex flex-col items-end">
                            <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                              {fCurrency(gross - ret)} ₫
                            </span>
                            <span className="text-xs text-amber-600 line-through opacity-70">
                              {fCurrency(gross)} ₫
                            </span>
                          </div>
                        )
                      }
                      return <span className="font-medium">{fCurrency(gross)} ₫</span>
                    })()}
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
                    <p className="font-semibold text-emerald-700 dark:text-emerald-400">{fCurrency(detail.total_amount)} ₫</p>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-800">
                      <tr>
                        <th className="px-3 py-2">Sản phẩm</th>
                        <th className="px-3 py-2 text-right">SL bán</th>
                        {returnHistory.length > 0 && (
                          <>
                            <th className="px-3 py-2 text-right text-amber-600 dark:text-amber-400">Đã trả</th>
                            <th className="px-3 py-2 text-right">Còn lại</th>
                          </>
                        )}
                        <th className="px-3 py-2 text-right">Đơn giá</th>
                        <th className="px-3 py-2 text-right">Thành tiền</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.items.map((item) => {
                        // Tổng SL đã trả của dòng này
                        const totalReturned = returnHistory.reduce((sum, ret) =>
                          sum + ret.items
                            .filter((ri) => ri.sale_item_id === item.id)
                            .reduce((s, ri) => s + ri.quantity, 0)
                        , 0)
                        const remaining = item.quantity - totalReturned
                        const fullyReturned = totalReturned >= item.quantity
                        return (
                          <tr
                            key={item.id}
                            className={`border-t border-zinc-200 dark:border-zinc-700 ${fullyReturned ? 'opacity-50' : ''}`}
                          >
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className={`font-medium ${fullyReturned ? 'line-through text-zinc-400' : ''}`}>
                                  {item.product_name || `SP #${item.product_id}`}
                                </p>
                                {fullyReturned && (
                                  <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/40 dark:text-red-300">
                                    Đã trả hết
                                  </span>
                                )}
                                {!fullyReturned && totalReturned > 0 && (
                                  <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                                    Trả 1 phần
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">{fQty(item.quantity)}</td>
                            {returnHistory.length > 0 && (
                              <>
                                <td className="px-3 py-2 text-right tabular-nums text-amber-600 dark:text-amber-400">
                                  {totalReturned > 0 ? `-${fQty(totalReturned)}` : '—'}
                                </td>
                                <td className={`px-3 py-2 text-right tabular-nums font-medium ${fullyReturned ? 'text-zinc-400' : ''}`}>
                                  {fQty(remaining)}
                                </td>
                              </>
                            )}
                            <td className="px-3 py-2 text-right tabular-nums">{fCurrency(item.sale_price)} ₫</td>
                            <td className="px-3 py-2 text-right tabular-nums font-medium">
                              {fCurrency(Number(item.sale_price) * item.quantity)} ₫
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-zinc-200 bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800">
                        <td colSpan={returnHistory.length > 0 ? 5 : 3} className="px-3 py-2 text-right text-zinc-500 text-sm">
                          Tổng gốc
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-zinc-600 dark:text-zinc-300">
                          {fCurrency(detail.total_amount)} ₫
                        </td>
                      </tr>
                      {returnHistory.length > 0 && (() => {
                        const totalReturnedAmt = returnHistory.reduce((sum, ret) =>
                          sum + ret.items.reduce((s, ri) => {
                            const item = detail.items.find(it => it.id === ri.sale_item_id)
                            return s + ri.quantity * Number(item?.sale_price ?? 0)
                          }, 0)
                        , 0)
                        const netTotal = Number(detail.total_amount) - totalReturnedAmt
                        return (
                          <>
                            <tr className="bg-amber-50 dark:bg-amber-950/20">
                              <td colSpan={5} className="px-3 py-2 text-right text-amber-700 dark:text-amber-400 text-sm">
                                Đã trả hàng
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums text-amber-700 dark:text-amber-400 font-medium">
                                -{fCurrency(totalReturnedAmt)} ₫
                              </td>
                            </tr>
                            <tr className="border-t-2 border-zinc-300 bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800">
                              <td colSpan={5} className="px-3 py-2 text-right font-semibold">Thực nhận</td>
                              <td className="px-3 py-2 text-right tabular-nums font-bold text-emerald-700 dark:text-emerald-400">
                                {fCurrency(netTotal)} ₫
                              </td>
                            </tr>
                          </>
                        )
                      })()}
                      {returnHistory.length === 0 && (
                        <tr className="border-t-2 border-zinc-300 bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800">
                          <td colSpan={3} className="px-3 py-2 text-right font-semibold">Tổng cộng</td>
                          <td className="px-3 py-2 text-right tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">
                            {fCurrency(detail.total_amount)} ₫
                          </td>
                        </tr>
                      )}
                    </tfoot>
                  </table>
                </div>

                {/* Return history */}
                {returnHistory.length > 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
                    <p className="mb-2 text-sm font-medium text-amber-800 dark:text-amber-300">➡ Lịch sử trả hàng</p>
                    {returnHistory.map((ret) => (
                      <div key={ret.id} className="mb-1 text-xs text-amber-700 dark:text-amber-400">
                        Phếu #{ret.id} • {new Date(ret.created_at).toLocaleDateString('vi-VN')}
                        {ret.items.map((ri) => (
                          <span key={ri.id} className="ml-2">— {ri.product_name || `SP #${ri.product_id}`}: -{ri.quantity}</span>
                        ))}
                      </div>
                    ))}
                  </div>
                )}

                {/* Return button */}
                {detail.status === 'completed' && detail.items.some((item) => {
                  const totalR = returnHistory.reduce((sum, ret) =>
                    sum + ret.items.filter((ri) => ri.sale_item_id === item.id).reduce((s, ri) => s + ri.quantity, 0)
                  , 0)
                  return item.quantity - totalR > 0
                }) && (
                  <div className="flex items-center gap-3">
                    {returnMsg && <p className="text-sm text-emerald-700 dark:text-emerald-400">{returnMsg}</p>}
                    <button
                      type="button"
                      onClick={openReturnModal}
                      className="ml-auto rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                    >
                      ↩ Trả hàng
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Return Modal */}
      {showReturnModal && detail && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onClick={() => setShowReturnModal(false)}>
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-700">
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">↩ Trả hàng — Hóa đơn #{detail.id}</h3>
              <button type="button" onClick={() => setShowReturnModal(false)} className="text-zinc-400 hover:text-zinc-700">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-zinc-500">Nhập số lượng trả cho từng sản phẩm (bỏ trống = không trả):</p>
              {detail.items.map((item) => {
                const totalReturned = returnHistory.reduce((sum, ret) =>
                  sum + ret.items
                    .filter((ri) => ri.sale_item_id === item.id)
                    .reduce((s, ri) => s + ri.quantity, 0)
                , 0)
                const remaining = item.quantity - totalReturned
                if (remaining <= 0) return null

                return (
                  <div key={item.id} className="flex items-center gap-3">
                    <span className="flex-1 text-sm">{item.product_name || `SP #${item.product_id}`} <span className="text-zinc-400 text-xs">(tối đa: {remaining})</span></span>
                    <input
                      type="number"
                      min={0}
                      max={remaining}
                      placeholder="0"
                      className="w-20 rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-800"
                      value={returnQtys[item.id] ?? ''}
                      onChange={(e) => setReturnQtys((q) => ({ ...q, [item.id]: e.target.value }))}
                    />
                  </div>
                )
              })}
              <label className="flex flex-col gap-1 text-sm">
                Ghi chú (tùy chọn)
                <input
                  className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800"
                  value={returnNote}
                  onChange={(e) => setReturnNote(e.target.value)}
                  placeholder="Lý do trả hàng..."
                />
              </label>
              {returnErr && <p className="text-sm text-red-600">{returnErr}</p>}
              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={returnLoading}
                  onClick={() => setReturnConfirm(true)}
                  className="flex-1 rounded-lg bg-amber-600 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-60"
                >
                  {returnLoading ? 'Đang xử lý...' : 'Xác nhận trả hàng'}
                </button>
                <button type="button" onClick={() => setShowReturnModal(false)} className="rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300">
                  Hủy
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={returnConfirm}
        title="Xác nhận trả hàng"
        message={`Trả hàng lịch sử giao dịch #${detail?.id}?\nTồn kho sẽ được hoàn lại cho các sản phẩm đã chọn.`}
        confirmLabel="Trả hàng"
        confirmVariant="danger"
        onConfirm={submitReturn}
        onCancel={() => setReturnConfirm(false)}
      />
    </div>
  )
}
