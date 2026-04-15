import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import type { FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { apiGet, apiPatch, apiPost, apiUpload } from '../api'
import type { ImportReceiptListItem, ImportReceiptOut, Product } from '../types'

type Line = {
  key: string
  product_id: number | null
  product_summary: string
  pickQuery: string
  quantity: string
  import_price: string
  batch_code: string
  expiry_date: string
}

function newLine(): Line {
  return {
    key: crypto.randomUUID(),
    product_id: null,
    product_summary: '',
    pickQuery: '',
    quantity: '1',
    import_price: '0',
    batch_code: '',
    expiry_date: '',
  }
}

function fmt(n: string | number) {
  return Number(n).toLocaleString('vi-VN')
}

// ─── History filter state ───────────────────────────────────────────────────
type HistoryFilter = {
  statusFilter: '' | 'paid' | 'debt'
  productName: string
  dateFrom: string
  dateTo: string
  supplier: string
}

function defaultFilter(): HistoryFilter {
  return { statusFilter: '', productName: '', dateFrom: '', dateTo: '', supplier: '' }
}

export default function ImportPage() {
  const [searchParams] = useSearchParams()
  const prefilled = useRef(false)

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [lines, setLines] = useState<Line[]>(() => [newLine()])
  const [isDebt, setIsDebt] = useState(false)
  const [supplier, setSupplier] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [parsingExcel, setParsingExcel] = useState(false)

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setParsingExcel(true)
    setErr(null)
    setMsg(null)
    const fd = new FormData()
    fd.append('file', file)
    try {
      const res = await apiUpload<{ lines: any[]; errors: string[] }>('/import-receipts/parse-excel', fd)
      if (res.lines && res.lines.length > 0) {
        const newLines: Line[] = res.lines.map((row) => ({
          key: crypto.randomUUID(),
          product_id: row.product_id,
          product_summary: row.product_summary,
          pickQuery: '',
          quantity: row.quantity,
          import_price: row.import_price,
          batch_code: row.batch_code,
          expiry_date: row.expiry_date,
        }))
        setLines(newLines)
      }
      if (res.errors && res.errors.length > 0) {
        setErr(`Có ${res.errors.length} lỗi: ` + res.errors.join(' | '))
      } else if (res.lines.length > 0) {
        setMsg(`✅ Nạp thành công ${res.lines.length} dòng từ file.`)
      } else {
        setErr('Không tìm thấy dòng thông tin nào hợp lệ.')
      }
    } catch (ex: any) {
      setErr(ex.message)
    } finally {
      setParsingExcel(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // History
  const [history, setHistory] = useState<ImportReceiptListItem[]>([])
  const [histErr, setHistErr] = useState<string | null>(null)
  const [histLoading, setHistLoading] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [filter, setFilter] = useState<HistoryFilter>(defaultFilter())
  const [activeFilter, setActiveFilter] = useState<HistoryFilter>(defaultFilter())

  // Pay debt confirm
  const [payTarget, setPayTarget] = useState<number | null>(null)
  const [payLoading, setPayLoading] = useState(false)

  // Detail modal
  const [detailReceipt, setDetailReceipt] = useState<ImportReceiptOut | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const applyProductToLine = useCallback((lineKey: string, p: Product) => {
    setLines((L) =>
      L.map((x) =>
        x.key === lineKey
          ? {
              ...x,
              product_id: p.id,
              product_summary: `${p.name} · ${p.sku}`,
              pickQuery: '',
              import_price: String(p.default_import_price ?? '0'),
            }
          : x,
      ),
    )
  }, [])

  // Prefill from URL query param
  useEffect(() => {
    const raw = searchParams.get('productId')
    if (!raw || prefilled.current) return
    const id = Number(raw)
    if (!Number.isFinite(id) || id < 1) return
    prefilled.current = true
    apiGet<Product>(`/products/${id}`)
      .then((p) => {
        setLines((L) => {
          const first = L[0] ?? newLine()
          return [
            {
              ...first,
              product_id: p.id,
              product_summary: `${p.name} · ${p.sku}`,
              pickQuery: '',
              import_price: String(p.default_import_price ?? '0'),
            },
            ...L.slice(1),
          ]
        })
      })
      .catch(() => { prefilled.current = false })
  }, [searchParams])

  // Load history
  const loadHistory = useCallback((f: HistoryFilter) => {
    setHistLoading(true)
    setHistErr(null)
    const params = new URLSearchParams()
    if (f.statusFilter === 'debt') params.set('is_debt', 'true')
    if (f.statusFilter === 'paid') params.set('is_debt', 'false')
    if (f.productName) params.set('product_name', f.productName)
    if (f.dateFrom) params.set('date_from', f.dateFrom)
    if (f.dateTo) params.set('date_to', f.dateTo)
    if (f.supplier) params.set('supplier', f.supplier)
    params.set('limit', '50')
    apiGet<ImportReceiptListItem[]>(`/import-receipts?${params.toString()}`)
      .then(setHistory)
      .catch((e: Error) => setHistErr(e.message))
      .finally(() => setHistLoading(false))
  }, [])

  useEffect(() => {
    loadHistory(defaultFilter())
  }, [loadHistory])

  const addLine = () => setLines((L) => [...L, newLine()])
  const removeLine = (key: string) =>
    setLines((L) => (L.length <= 1 ? L : L.filter((x) => x.key !== key)))

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setErr(null)
    setMsg(null)
    const payload = {
      date,
      created_by: 'pos',
      supplier: supplier || null,
      is_debt: isDebt,
      lines: lines
        .filter((l) => l.product_id != null && l.expiry_date)
        .map((l) => ({
          product_id: l.product_id as number,
          quantity: Number(l.quantity),
          import_price: l.import_price,
          batch_code: l.batch_code,
          expiry_date: l.expiry_date,
        })),
    }
    if (!payload.lines.length) {
      setErr('Chọn sản phẩm và nhập HSD cho ít nhất một dòng.')
      return
    }
    apiPost<{ id: number }>('/import-receipts', payload)
      .then((r) => {
        setMsg(`✅ Đã tạo phiếu nhập #${r.id}`)
        setLines([newLine()])
        setIsDebt(false)
        setSupplier('')
        loadHistory(activeFilter)
      })
      .catch((e: Error) => setErr(e.message))
  }

  const openDetail = (id: number) => {
    setDetailLoading(true)
    setDetailReceipt(null)
    apiGet<ImportReceiptOut>(`/import-receipts/${id}`)
      .then(setDetailReceipt)
      .catch(() => setDetailReceipt(null))
      .finally(() => setDetailLoading(false))
  }

  const onPayDebtConfirm = async () => {
    if (!payTarget) return
    setPayLoading(true)
    try {
      await apiPatch(`/import-receipts/${payTarget}/pay`, {})
      setPayTarget(null)
      loadHistory(activeFilter)
      setMsg(`✅ Đã thanh toán công nợ phiếu #${payTarget}`)
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : String(ex))
    } finally {
      setPayLoading(false)
    }
  }

  const applyFilter = () => {
    setActiveFilter({ ...filter })
    loadHistory(filter)
  }

  const clearFilter = () => {
    const f = defaultFilter()
    setFilter(f)
    setActiveFilter(f)
    loadHistory(f)
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* ─── Form nhập kho ─────────────────────────────────────────── */}
      <section>
        <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 text-sm text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">
          <h2 className="mb-2 font-semibold">Quy trình nhập kho</h2>
          <ol className="list-decimal space-y-1 pl-5">
            <li><strong>Danh mục</strong> — tạo sản phẩm ở màn hình <em>Sản phẩm</em> nếu chưa có.</li>
            <li><strong>Phiếu nhập</strong> — chọn từng sản phẩm, số lượng, giá nhập thực tế, mã lô và HSD.</li>
            <li>Sau khi ghi nhận, kiểm tra tồn tại màn <em>Kho</em> hoặc dùng <em>POS</em> để bán.</li>
          </ol>
        </div>

        <div className="flex items-center gap-4 mb-4">
          <input
            type="file"
            accept=".xlsx"
            ref={fileInputRef}
            onChange={handleExcelUpload}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={parsingExcel}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {parsingExcel ? 'Đang đọc...' : 'Nhập từ Excel'}
          </button>
          <span className="text-xs text-zinc-500">Hỗ trợ tự động điền Tồn kho, Mã lô, HSD theo mã SKU.</span>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <label className="flex flex-col gap-1 text-sm">
              Ngày nhập
              <input
                type="date"
                className="rounded border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              Nhà cung cấp
              <input
                className="rounded border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
                placeholder="Tên nhà cung cấp (tùy chọn)"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
              />
            </label>
            <label className="flex items-center gap-2 text-sm pt-5">
              <input
                type="checkbox"
                className="h-4 w-4 rounded accent-amber-500"
                checked={isDebt}
                onChange={(e) => setIsDebt(e.target.checked)}
              />
              <span>
                <span className="font-medium">Ghi nợ</span>
                <span className="ml-1 text-xs text-zinc-500">(chưa thanh toán)</span>
              </span>
            </label>
          </div>

          {isDebt && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
              ⚠️ Phiếu này sẽ được đánh dấu <strong>Ghi nợ</strong> — chưa thanh toán cho nhà cung cấp.
            </div>
          )}

          <div className="space-y-4">
            {lines.map((line, i) => (
              <ImportLineRow
                key={line.key}
                index={i}
                line={line}
                setLines={setLines}
                onSelectProduct={applyProductToLine}
                onRemove={() => removeLine(line.key)}
              />
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={addLine}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600"
            >
              + Thêm dòng
            </button>
            <button type="submit" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-700">
              Ghi nhận nhập kho
            </button>
          </div>
          {msg ? <p className="text-emerald-700 dark:text-emerald-400">{msg}</p> : null}
          {err ? <p className="text-red-600">{err}</p> : null}
        </form>
      </section>

      {/* ─── Lịch sử nhập kho ──────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-100">Lịch sử nhập kho</h2>
          <button
            type="button"
            onClick={() => setFilterOpen((o) => !o)}
            className="ml-auto flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            🔍 {filterOpen ? 'Ẩn bộ lọc' : 'Tìm kiếm / Lọc'}
          </button>
          <button
            type="button"
            onClick={() => loadHistory(activeFilter)}
            className="rounded-lg bg-zinc-700 px-3 py-1.5 text-sm text-white hover:bg-zinc-600"
          >
            ↻ Tải lại
          </button>
        </div>

        {/* Filter panel */}
        {filterOpen && (
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-900/50">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="flex flex-col gap-1 text-sm">
                Trạng thái
                <select
                  className="rounded border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
                  value={filter.statusFilter}
                  onChange={(e) => setFilter((f) => ({ ...f, statusFilter: e.target.value as HistoryFilter['statusFilter'] }))}
                >
                  <option value="">Tất cả</option>
                  <option value="paid">Đã thanh toán</option>
                  <option value="debt">Ghi nợ</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Tên sản phẩm
                <input
                  className="rounded border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
                  placeholder="Tìm trong phiếu..."
                  value={filter.productName}
                  onChange={(e) => setFilter((f) => ({ ...f, productName: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Nhà cung cấp
                <input
                  className="rounded border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
                  placeholder="Tên NCC..."
                  value={filter.supplier}
                  onChange={(e) => setFilter((f) => ({ ...f, supplier: e.target.value }))}
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1 text-sm">
                  Từ ngày
                  <input
                    type="date"
                    className="rounded border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
                    value={filter.dateFrom}
                    onChange={(e) => setFilter((f) => ({ ...f, dateFrom: e.target.value }))}
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  Đến ngày
                  <input
                    type="date"
                    className="rounded border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
                    value={filter.dateTo}
                    onChange={(e) => setFilter((f) => ({ ...f, dateTo: e.target.value }))}
                  />
                </label>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={applyFilter}
                className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm text-white hover:bg-emerald-700"
              >
                Áp dụng
              </button>
              <button
                type="button"
                onClick={clearFilter}
                className="rounded-lg border border-zinc-300 px-4 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Xóa bộ lọc
              </button>
            </div>
          </div>
        )}

        {histErr ? <p className="text-red-600 text-sm">{histErr}</p> : null}

        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-700">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-zinc-100 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              <tr>
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Ngày</th>
                <th className="px-3 py-2">Nhà cung cấp</th>
                <th className="px-3 py-2">Người tạo</th>
                <th className="px-3 py-2 text-center">Số SP</th>
                <th className="px-3 py-2 text-right">Tổng tiền</th>
                <th className="px-3 py-2 text-center">Trạng thái</th>
                <th className="px-3 py-2 text-center">Chi tiết</th>
              </tr>
            </thead>
            <tbody>
              {histLoading ? (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-zinc-400">Đang tải...</td>
                </tr>
              ) : history.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-zinc-400">Chưa có phiếu nhập nào.</td>
                </tr>
              ) : (
                history.map((r) => (
                  <tr key={r.id} className="border-t border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                    <td className="px-3 py-2 font-mono text-xs text-zinc-500">#{r.id}</td>
                    <td className="px-3 py-2">{r.date}</td>
                    <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">{r.supplier || '—'}</td>
                    <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">{r.created_by}</td>
                    <td className="px-3 py-2 text-center tabular-nums">{r.item_count}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">
                      {fmt(r.total_amount)} ₫
                    </td>
                    <td className="px-3 py-2 text-center">
                      {r.is_debt ? (
                        <div className="flex flex-col items-center gap-1">
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                            Ghi nợ
                          </span>
                          <button
                            type="button"
                            onClick={() => setPayTarget(r.id)}
                            className="text-xs text-emerald-600 hover:text-emerald-700 hover:underline dark:text-emerald-400"
                          >
                            Trả nợ
                          </button>
                        </div>
                      ) : (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                          Đã thanh toán
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center align-middle">
                      <button
                        type="button"
                        onClick={() => openDetail(r.id)}
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
        </div>
      </section>

      {/* Pay Debt Confirm Modal */}
      {payTarget && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
          onClick={() => setPayTarget(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">Khất nợ hoàn tất?</h3>
            <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-300">
              Xác nhận đã thanh toán xong cho phiếu nhập <strong>#{payTarget}</strong>? Hành động này không thể hoàn tác.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                disabled={payLoading}
                onClick={onPayDebtConfirm}
                className="flex-1 rounded-lg bg-emerald-600 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {payLoading ? 'Đang xử lý...' : 'Xác nhận trả nợ'}
              </button>
              <button
                type="button"
                onClick={() => setPayTarget(null)}
                className="flex-1 rounded-lg border border-zinc-300 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Detail Modal ───────────────────────────────────────────── */}
      {(detailReceipt || detailLoading) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setDetailReceipt(null)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-700">
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
                {detailLoading ? 'Đang tải...' : `Phiếu nhập #${detailReceipt?.id}`}
              </h3>
              <button
                type="button"
                onClick={() => setDetailReceipt(null)}
                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
              >
                ✕
              </button>
            </div>

            {detailReceipt && (
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <div><p className="text-zinc-500">Ngày</p><p className="font-medium">{detailReceipt.date}</p></div>
                  <div><p className="text-zinc-500">Người tạo</p><p className="font-medium">{detailReceipt.created_by}</p></div>
                  <div><p className="text-zinc-500">Nhà cung cấp</p><p className="font-medium">{detailReceipt.supplier || '—'}</p></div>
                  <div>
                    <p className="text-zinc-500">Trạng thái</p>
                    {detailReceipt.is_debt ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">Ghi nợ</span>
                    ) : (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">Đã thanh toán</span>
                    )}
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
                      {detailReceipt.items.map((item) => (
                        <tr key={item.id} className="border-t border-zinc-200 dark:border-zinc-700">
                          <td className="px-3 py-2">
                            <p className="font-medium">{item.product_name || `SP #${item.product_id}`}</p>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{item.quantity}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{fmt(item.import_price)} ₫</td>
                          <td className="px-3 py-2 text-right tabular-nums font-medium">
                            {fmt(Number(item.import_price) * item.quantity)} ₫
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-zinc-300 bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800">
                        <td colSpan={3} className="px-3 py-2 text-right font-semibold">Tổng cộng</td>
                        <td className="px-3 py-2 text-right tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">
                          {fmt(detailReceipt.total_amount)} ₫
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

// ─── Import Line Row ────────────────────────────────────────────────────────
function ImportLineRow({
  index,
  line,
  setLines,
  onSelectProduct,
  onRemove,
}: {
  index: number
  line: Line
  setLines: Dispatch<SetStateAction<Line[]>>
  onSelectProduct: (lineKey: string, p: Product) => void
  onRemove: () => void
}) {
  const [suggestions, setSuggestions] = useState<Product[]>([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const q = line.pickQuery.trim()
    if (!q) {
      setSuggestions([])
      return
    }
    const t = window.setTimeout(() => {
      apiGet<Product[]>(`/products?q=${encodeURIComponent(q)}`)
        .then(setSuggestions)
        .catch(() => setSuggestions([]))
    }, 280)
    return () => window.clearTimeout(t)
  }, [line.pickQuery])

  return (
    <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Dòng {index + 1}</span>
        <button type="button" onClick={onRemove} className="text-xs text-red-600 hover:underline">
          Xóa dòng
        </button>
      </div>

      <div className="grid gap-3 lg:grid-cols-6">
        <div className="relative lg:col-span-2">
          <label className="flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
            Sản phẩm (gõ tên hoặc SKU)
            <input
              className="rounded border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
              placeholder="Tìm và chọn…"
              value={line.product_id ? line.product_summary : line.pickQuery}
              onChange={(e) => {
                const v = e.target.value
                setLines((L) =>
                  L.map((x) =>
                    x.key === line.key
                      ? { ...x, product_id: null, product_summary: '', pickQuery: v }
                      : x,
                  ),
                )
                setOpen(true)
              }}
              onFocus={() => { if (line.product_id) return; setOpen(true) }}
            />
          </label>
          {open && !line.product_id && line.pickQuery.trim() && suggestions.length > 0 ? (
            <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-600 dark:bg-zinc-900">
              {suggestions.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    onClick={() => { onSelectProduct(line.key, p); setOpen(false) }}
                  >
                    <span className="font-medium">{p.name}</span>
                    <span className="ml-2 font-mono text-zinc-500">{p.sku}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <label className="flex flex-col gap-1 text-xs">
          Số lượng
          <input
            className="rounded border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
            value={line.quantity}
            onChange={(e) => {
              const v = e.target.value
              setLines((L) => L.map((x) => (x.key === line.key ? { ...x, quantity: v } : x)))
            }}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          Giá nhập
          <input
            className="rounded border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
            value={line.import_price}
            onChange={(e) => {
              const v = e.target.value
              setLines((L) => L.map((x) => (x.key === line.key ? { ...x, import_price: v } : x)))
            }}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          Mã lô
          <input
            className="rounded border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
            value={line.batch_code}
            onChange={(e) => {
              const v = e.target.value
              setLines((L) => L.map((x) => (x.key === line.key ? { ...x, batch_code: v } : x)))
            }}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          HSD
          <input
            type="date"
            className="rounded border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
            value={line.expiry_date}
            onChange={(e) => {
              const v = e.target.value
              setLines((L) => L.map((x) => (x.key === line.key ? { ...x, expiry_date: v } : x)))
            }}
          />
        </label>
      </div>
    </div>
  )
}
