import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import type { FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { apiGet, apiPatch, apiPost, apiUpload } from '../api'
import type { ImportReceiptListItem, ImportReceiptOut, PaginatedResponse, Product, Supplier } from '../types'
import Pagination from '../components/Pagination'
import ConfirmDialog from '../components/ConfirmDialog'
import { fCurrency, fQty } from '../utils/format'

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

const newLine = (): Line => ({
  key: Math.random().toString(36).slice(2),
  product_id: null,
  product_summary: '',
  pickQuery: '',
  quantity: '1',
  import_price: '0',
  batch_code: '',
  expiry_date: '',
})


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
  const [supplierId, setSupplierId] = useState<number | ''>('')
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  // Confirm dialog for submit
  const [submitConfirm, setSubmitConfirm] = useState(false)
  const [pendingPayload, setPendingPayload] = useState<object | null>(null)

  // Quick Add Supplier
  const [showQuickSupplier, setShowQuickSupplier] = useState(false)
  const [quickName, setQuickName] = useState('')
  const [quickPhone, setQuickPhone] = useState('')
  const [quickLoading, setQuickLoading] = useState(false)

  // Draft persistence
  const [hasDraft, setHasDraft] = useState(false)

  // Quick Add Product
  const [showQuickProduct, setShowQuickProduct] = useState(false)
  const [qpName, setQpName] = useState('')
  const [qpUnit, setQpUnit] = useState('hộp')
  const [qpDip, setQpDip] = useState('0')
  const [qpDsp, setQpDsp] = useState('0')
  const [qpLoading, setQpLoading] = useState(false)

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
      const res = await apiUpload<{ lines: any[]; errors: string[]; supplier_id: number | null; supplier_name: string | null }>('/import-receipts/parse-excel', fd)
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
      // Tự động chọn NCC nếu đọc được từ file
      if (res.supplier_id) {
        setSupplierId(res.supplier_id)
        loadSuppliers() // reload để hiển thị NCC mới nếu vừa tạo
        setMsg(`✅ Nạp thành công ${res.lines.length} dòng. Nhà CC: «${res.supplier_name}» đã được tự động chọn.`)
      } else if (res.errors && res.errors.length > 0) {
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
  const [pagedHistory, setPagedHistory] = useState<PaginatedResponse<ImportReceiptListItem> | null>(null)
  const [historyPage, setHistoryPage] = useState(1)
  const [historyPageSize, setHistoryPageSize] = useState(50)
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

  // Load suppliers
  const loadSuppliers = useCallback(() => {
    apiGet<Supplier[]>('/suppliers').then(setSuppliers).catch(() => setSuppliers([]))
  }, [])

  useEffect(() => { loadSuppliers() }, [loadSuppliers])

  // --- Draft Persistence ---
  const DRAFT_KEY = 'wm_import_draft'

  // Load draft on mount
  useEffect(() => {
    const saved = localStorage.getItem(DRAFT_KEY)
    if (saved) {
      try {
        const data = JSON.parse(saved)
        if (data.lines && data.lines.length > 0 && data.lines[0].product_id) {
          setHasDraft(true)
        }
      } catch (e) {
        localStorage.removeItem(DRAFT_KEY)
      }
    }
  }, [])

  const restoreDraft = () => {
    const saved = localStorage.getItem(DRAFT_KEY)
    if (saved) {
      try {
        const data = JSON.parse(saved)
        setLines(data.lines || [newLine()])
        setSupplierId(data.supplierId || '')
        setIsDebt(data.isDebt || false)
        setDate(data.date || new Date().toISOString().slice(0, 10))
        setMsg('✅ Đã khôi phục bản nháp.')
      } catch (e) {}
    }
    setHasDraft(false)
  }

  const discardDraft = () => {
    localStorage.removeItem(DRAFT_KEY)
    setHasDraft(false)
  }

  // Save draft on changes
  useEffect(() => {
    const isActuallyNew = lines.length === 1 && !lines[0].product_id && !supplierId
    if (isActuallyNew) return

    const timer = setTimeout(() => {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        lines, supplierId, isDebt, date
      }))
    }, 1000)
    return () => clearTimeout(timer)
  }, [lines, supplierId, isDebt, date])


  const [globalQuery, setGlobalQuery] = useState('')
  const [globalSuggestions, setGlobalSuggestions] = useState<Product[]>([])
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false)

  useEffect(() => {
    const q = globalQuery.trim()
    if (!q) {
      setGlobalSuggestions([])
      return
    }
    const t = window.setTimeout(() => {
      apiGet<PaginatedResponse<Product>>(`/products?size=20&q=${encodeURIComponent(q)}`)
        .then(res => setGlobalSuggestions(res.items))
        .catch(() => setGlobalSuggestions([]))
    }, 280)
    return () => window.clearTimeout(t)
  }, [globalQuery])

  const addProductToImport = useCallback((p: Product) => {
    setLines((L) => {
      const emptyIdx = L.findIndex((x) => !x.product_id)
      const lineData = {
        product_id: p.id,
        product_summary: `${p.name} · ${p.sku}`,
        pickQuery: '',
        quantity: '1',
        import_price: String(p.default_import_price ?? '0'),
      }
      if (emptyIdx !== -1) {
        const newL = [...L]
        newL[emptyIdx] = { ...newL[emptyIdx], ...lineData }
        return newL
      }
      return [...L, { ...newLine(), ...lineData }]
    })
    setGlobalQuery('')
    setGlobalSearchOpen(false)
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
  const loadHistory = useCallback((f: HistoryFilter, targetPage: number = historyPage, targetSize: number = historyPageSize) => {
    setHistLoading(true)
    setHistErr(null)
    const params = new URLSearchParams()
    if (f.statusFilter === 'debt') params.set('is_debt', 'true')
    if (f.statusFilter === 'paid') params.set('is_debt', 'false')
    if (f.productName) params.set('product_name', f.productName)
    if (f.dateFrom) params.set('date_from', f.dateFrom)
    if (f.dateTo) params.set('date_to', f.dateTo)
    if (f.supplier) params.set('supplier', f.supplier)
    
    params.set('page', String(targetPage))
    params.set('size', String(targetSize))

    apiGet<PaginatedResponse<ImportReceiptListItem>>(`/import-receipts?${params.toString()}`)
      .then(setPagedHistory)
      .catch((e: Error) => setHistErr(e.message))
      .finally(() => setHistLoading(false))
  }, [historyPage, historyPageSize])

  useEffect(() => {
    loadHistory(activeFilter, historyPage, historyPageSize)
  }, [loadHistory, activeFilter, historyPage, historyPageSize])

  const addLine = () => setLines((L) => [...L, newLine()])
  const removeLine = (key: string) =>
    setLines((L) => (L.length <= 1 ? L : L.filter((x) => x.key !== key)))

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setErr(null)
    setMsg(null)
    if (!supplierId) {
      setErr('Vui lòng chọn nhà cung cấp.')
      return
    }
    const selectedSupplier = suppliers.find((s) => s.id === supplierId)
    const payload = {
      date,
      created_by: 'pos',
      supplier: selectedSupplier?.name || null,
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
    setPendingPayload(payload)
    setSubmitConfirm(true)
  }

  const doSubmit = () => {
    if (!pendingPayload) return
    setSubmitConfirm(false)
    apiPost<{ id: number }>('/import-receipts', pendingPayload)
      .then((r) => {
        setMsg(`✅ Đã tạo phiếu nhập #${r.id}`)
        setLines([newLine()])
        setIsDebt(false)
        setSupplierId('')
        setPendingPayload(null)
        localStorage.removeItem(DRAFT_KEY) // Clear draft on success
        loadHistory(activeFilter)
      })
      .catch((e: Error) => setErr(e.message))
  }

  const doQuickAddSupplier = async (e: FormEvent) => {
    e.preventDefault()
    if (!quickName.trim()) return
    setQuickLoading(true)
    try {
      const newS = await apiPost<Supplier>('/suppliers', {
        name: quickName.trim(),
        phone: quickPhone.trim() || null
      })
      setSuppliers(prev => [...prev, newS])
      setSupplierId(newS.id)
      setQuickName(''); setQuickPhone('')
      setShowQuickSupplier(false)
      setMsg(`✅ Đã thêm và chọn Nhà cung cấp: «${newS.name}»`)
    } catch (ex: any) {
      setErr(ex.message)
    } finally {
      setQuickLoading(false)
    }
  }

  const doQuickAddProduct = async (e: FormEvent) => {
    e.preventDefault()
    if (!qpName.trim()) return
    setQpLoading(true)
    try {
      const p = await apiPost<Product>('/products', {
        name: qpName.trim(),
        unit: qpUnit.trim(),
        default_import_price: qpDip,
        default_sale_price: qpDsp,
        is_active: true
      })
      addProductToImport(p)
      setQpName(''); setQpUnit('hộp'); setQpDip('0'); setQpDsp('0')
      setShowQuickProduct(false)
      setMsg(`✅ Đã thêm và chọn sản phẩm: «${p.name}»`)
    } catch (ex: any) {
      setErr(ex.message)
    } finally {
      setQpLoading(false)
    }
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
    const f = { ...filter }
    setActiveFilter(f)
    setHistoryPage(1)
    loadHistory(f, 1)
  }

  const clearFilter = () => {
    const f = defaultFilter()
    setFilter(f)
    setActiveFilter(f)
    setHistoryPage(1)
    loadHistory(f, 1)
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

        {hasDraft && (
          <div className="mb-4 flex items-center justify-between rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
            <div className="flex items-center gap-2">
              <span>⚠️ Bạn có bản nhập kho chưa hoàn tất từ trước.</span>
              <button
                type="button"
                onClick={restoreDraft}
                className="font-bold underline hover:text-amber-600"
              >
                Khôi phục ngay
              </button>
            </div>
            <button
              type="button"
              onClick={discardDraft}
              className="text-xs text-zinc-400 hover:text-zinc-600 underline"
            >
              Bỏ qua
            </button>
          </div>
        )}

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
              <span>Nhà cung cấp <span className="text-red-500">*</span></span>
              <select
                className={`flex-1 rounded border px-2 py-1.5 dark:bg-zinc-900 ${
                  supplierId
                    ? 'border-zinc-300 dark:border-zinc-600'
                    : 'border-red-400 dark:border-red-600'
                }`}
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">-- Chọn nhà cung cấp --</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}{s.phone ? ` · ${s.phone}` : ''}</option>
                ))}
              </select>
              <div className="flex items-center gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setShowQuickSupplier(true)}
                  className="text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
                >
                  + Thêm nhanh NCC
                </button>
                <span className="text-zinc-300 dark:text-zinc-700">|</span>
                <span className="text-xs text-zinc-400">Quản lý tại <a href="/suppliers" className="text-emerald-600 hover:underline">màn hình Nhà CC</a></span>
              </div>
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

          <div className="relative z-10 pt-4">
            <label className="flex flex-col gap-1 text-sm font-medium">
              Thêm sản phẩm vào phiếu nhập
              <input
                autoFocus
                className="rounded-lg border border-zinc-300 px-4 py-3 shadow-sm dark:border-zinc-600 dark:bg-zinc-900"
                placeholder="Gõ tên hoặc SKU sản phẩm để tìm kiếm..."
                value={globalQuery}
                onChange={(e) => {
                  setGlobalQuery(e.target.value)
                  setGlobalSearchOpen(true)
                }}
                onFocus={() => setGlobalSearchOpen(true)}
              />
              <div className="mt-1 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowQuickProduct(true)}
                  className="text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
                >
                  + Thêm nhanh Sản phẩm mới (danh mục)
                </button>
              </div>
            </label>
            {globalSearchOpen && globalQuery.trim() && globalSuggestions.length > 0 && (
              <ul className="absolute left-0 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-800">
                {globalSuggestions.map((p) => (
                  <li key={p.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-700/50">
                    <button
                      type="button"
                      onClick={() => addProductToImport(p)}
                      className="w-full px-4 py-3 text-left hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-emerald-800 dark:text-emerald-400">{p.name}</span>
                        <span className="text-xs font-mono text-zinc-500">{p.sku}</span>
                      </div>
                      <div className="mt-0.5 text-xs text-zinc-500">
                        Giá vốn/Giá bán: {fCurrency(p.default_import_price || 0)}đ / {fCurrency(p.default_sale_price || 0)}đ
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-4">
            {lines.map((line, i) => (
              <ImportLineRow
                key={line.key}
                index={i}
                line={line}
                setLines={setLines}
                onRemove={() => removeLine(line.key)}
              />
            ))}
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="button"
              onClick={addLine}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600 hidden"
            >
              + Thêm dòng
            </button>
            <button type="submit" className="rounded-lg bg-emerald-600 px-8 py-3 font-semibold text-white shadow hover:bg-emerald-700 ml-auto">
              Chốt Ghi Tạm / Lưu Phiếu Nhập
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
              ) : !pagedHistory || pagedHistory.items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-zinc-400">Chưa có phiếu nhập nào.</td>
                </tr>
              ) : (
                pagedHistory.items.map((r) => (
                  <tr key={r.id} className="border-t border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                    <td className="px-3 py-2 font-mono text-xs text-zinc-500">#{r.id}</td>
                    <td className="px-3 py-2">{r.date}</td>
                    <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">{r.supplier || '—'}</td>
                    <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">{r.created_by}</td>
                    <td className="px-3 py-2 text-center tabular-nums">{fQty(r.item_count)}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">
                      {fCurrency(r.total_amount)}
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
          {pagedHistory && (
            <Pagination 
              page={historyPage} 
              totalPages={pagedHistory.total_pages} 
              pageSize={historyPageSize}
              onPageChange={setHistoryPage} 
              onPageSizeChange={(s) => { setHistoryPageSize(s); setHistoryPage(1) }}
            />
          )}
        </div>
      </section>

      {/* Submit Import Confirm Dialog */}
      <ConfirmDialog
        open={submitConfirm}
        title="Xác nhận nhập kho"
        message={
          pendingPayload
            ? `Xác nhận ghi nhận phiếu nhập kho với ${(pendingPayload as { lines: unknown[] }).lines.length} sản phẩm?\nHành động này không thể hoàn tác.`
            : ''
        }
        confirmLabel="Ghi nhận nhập kho"
        onConfirm={doSubmit}
        onCancel={() => setSubmitConfirm(false)}
      />

      {/* Pay Debt Confirm Dialog */}
      <ConfirmDialog
        open={!!payTarget}
        title="Xác nhận thanh toán nợ"
        message={payTarget ? `Xác nhận đã thanh toán xong cho phiếu nhập #${payTarget}?\nHành động này không thể hoàn tác.` : ''}
        confirmLabel={payLoading ? 'Đang xử lý...' : 'Xác nhận trả nợ'}
        onConfirm={onPayDebtConfirm}
        onCancel={() => setPayTarget(null)}
      />

      {/* Delete Supplier Confirm - moved to SuppliersPage */}

      {/* ─── Detail Modal ───────────────────────────────────────────── */}
      {(detailReceipt || detailLoading) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setDetailReceipt(null)}
        >
          <div
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900"
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
                          <td className="px-3 py-2 text-right tabular-nums">{fQty(item.quantity)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{fCurrency(item.import_price)} ₫</td>
                          <td className="px-3 py-2 text-right tabular-nums font-medium">
                            {fCurrency(Number(item.import_price) * item.quantity)} ₫
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-zinc-300 bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800">
                        <td colSpan={3} className="px-3 py-2 text-right font-semibold">Tổng cộng</td>
                        <td className="px-3 py-2 text-right tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">
                          {fCurrency(detailReceipt.total_amount)} ₫
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

      {/* Quick Add Supplier Modal */}
      <QuickSupplierModal
        open={showQuickSupplier}
        loading={quickLoading}
        name={quickName}
        setName={setQuickName}
        phone={quickPhone}
        setPhone={setQuickPhone}
        onClose={() => setShowQuickSupplier(false)}
        onSubmit={doQuickAddSupplier}
      />

      <QuickProductModal
        open={showQuickProduct}
        loading={qpLoading}
        name={qpName} setName={setQpName}
        unit={qpUnit} setUnit={setQpUnit}
        dip={qpDip} setDip={setQpDip}
        dsp={qpDsp} setDsp={setQpDsp}
        onClose={() => setShowQuickProduct(false)}
        onSubmit={doQuickAddProduct}
      />
    </div>
  )
}

// ─── Quick Add Product Modal ──────────────────────────────────────────────────
function QuickProductModal({
  open, loading,
  name, setName,
  unit, setUnit,
  dip, setDip,
  dsp, setDsp,
  onClose, onSubmit
}: any) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900" onClick={e => e.stopPropagation()}>
        <h3 className="mb-4 text-lg font-bold text-zinc-900 dark:text-zinc-100">Thêm nhanh Sản phẩm</h3>
        <form onSubmit={onSubmit} className="space-y-4">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Tên sản phẩm *
            <input
              required autoFocus
              className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800"
              value={name} onChange={e => setName(e.target.value)}
              placeholder="VD: Thuốc cảm cúm..."
            />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1 text-sm font-medium">
              Đơn vị (vỉ, hộp,...)
              <input
                className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800"
                value={unit} onChange={e => setUnit(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-zinc-400">
              Mã SKU
              <input disabled placeholder="Tự động" className="rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800" />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1 text-sm font-medium">
              Giá nhập mặc định
              <input
                type="number"
                className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800"
                value={dip} onChange={e => setDip(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Giá bán mặc định
              <input
                type="number"
                className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800"
                value={dsp} onChange={e => setDsp(e.target.value)}
              />
            </label>
          </div>
          <p className="text-xs text-zinc-500 italic">* Lưu ý: SKU sẽ được hệ thống tự động tạo (SPxxxx).</p>
          <div className="mt-6 flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-lg bg-emerald-600 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {loading ? 'Đang lưu...' : 'Lưu & Chọn'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-300 px-4 py-3 text-sm font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400"
            >
              Hủy
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Import Line Row ────────────────────────────────────────────────────────
function ImportLineRow({
  index,
  line,
  setLines,
  onRemove,
}: {
  index: number
  line: Line
  setLines: Dispatch<SetStateAction<Line[]>>
  onRemove: () => void
}) {
  // Hide completely empty lines if they are just placeholders waiting to be replaced
  if (!line.product_id) {
    return null
  }

  return (
    <div className={`rounded-xl border ${!line.product_id ? 'border-dashed border-zinc-300 dark:border-zinc-600' : 'border-emerald-200 bg-emerald-50/30 dark:border-emerald-900/30 dark:bg-emerald-900/10'} p-4`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Dòng {index + 1}</span>
        <button type="button" onClick={onRemove} className="text-xs text-red-600 hover:underline">
          Xóa dòng
        </button>
      </div>

      <div className="grid gap-3 lg:grid-cols-6 items-end">
        <div className="lg:col-span-2 flex flex-col justify-center">
          <span className="text-xs text-zinc-500 mb-1">Sản phẩm</span>
          <div className="font-semibold text-sm">
            {line.product_id ? line.product_summary : <span className="italic text-zinc-400">Chưa chọn sản phẩm...</span>}
          </div>
        </div>

        <label className="flex flex-col gap-1 text-xs">
          Số lượng
          <div className="flex">
            <input
              type="number"
              min="1"
              step="1"
              className="min-w-0 flex-1 rounded border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
              value={line.quantity}
              onChange={(e) => {
                const v = e.target.value
                setLines((L) => L.map((x) => (x.key === line.key ? { ...x, quantity: v } : x)))
              }}
            />
          </div>
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
            min={new Date().toISOString().split('T')[0]}
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

// ─── Quick Add Supplier Modal ────────────────────────────────────────────────
function QuickSupplierModal({
  open,
  loading,
  name, setName,
  phone, setPhone,
  onClose,
  onSubmit
}: any) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900" onClick={e => e.stopPropagation()}>
        <h3 className="mb-4 text-lg font-bold text-zinc-900 dark:text-zinc-100">Thêm nhanh Nhà CC</h3>
        <form onSubmit={onSubmit} className="space-y-4">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Tên nhà cung cấp *
            <input
              required
              autoFocus
              className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="VD: Công ty Dược ABC"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Số điện thoại
            <input
              className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="0912..."
            />
          </label>
          <div className="mt-6 flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-lg bg-emerald-600 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {loading ? 'Đang lưu...' : 'Lưu & Chọn'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400"
            >
              Hủy
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
