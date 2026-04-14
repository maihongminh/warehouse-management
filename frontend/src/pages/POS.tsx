import { useEffect, useMemo, useState } from 'react'
import { apiGet, apiPost } from '../api'
import type { Batch, Product, SaleWithItems } from '../types'

type CartLine = {
  key: string
  product: Product
  batches: Batch[]
  selected_batch_id: number | null
  quantity: number
  sale_price: string
}

type SaleStatus = 'draft' | 'completed' | 'cancelled'

const STATUS_LABEL: Record<SaleStatus, string> = {
  draft: 'Nháp',
  completed: 'Hoàn thành',
  cancelled: 'Đã hủy',
}
const STATUS_CLASS: Record<SaleStatus, string> = {
  draft: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200',
  completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
}

function fmt(n: string | number) {
  return Number(n).toLocaleString('vi-VN')
}

export default function POS() {
  const [q, setQ] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [selected, setSelected] = useState<Product | null>(null)
  const [batches, setBatches] = useState<Batch[]>([])
  const [cart, setCart] = useState<CartLine[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Current draft sale (if any)
  const [draftSale, setDraftSale] = useState<SaleWithItems | null>(null)
  // Completed/cancelled result display
  const [resultSale, setResultSale] = useState<SaleWithItems | null>(null)
  // Cancel confirm pending
  const [cancelPending, setCancelPending] = useState(false)

  // Drafts list panel
  const [drafts, setDrafts] = useState<Pick<SaleWithItems, 'id' | 'date' | 'total_amount' | 'status' | 'created_by'>[]>([])
  const [showDrafts, setShowDrafts] = useState(false)

  useEffect(() => {
    const qs = q ? `?q=${encodeURIComponent(q)}` : ''
    apiGet<Product[]>(`/products${qs}`)
      .then(setProducts)
      .catch((e: Error) => setErr(e.message))
  }, [q])

  useEffect(() => {
    if (!selected) { setBatches([]); return }
    apiGet<Batch[]>(`/products/${selected.id}/batches`)
      .then(setBatches)
      .catch(() => setBatches([]))
  }, [selected])

  const loadDrafts = () => {
    apiGet<typeof drafts>('/sales?status=draft&limit=20')
      .then(setDrafts)
      .catch(() => setDrafts([]))
  }

  const addToCart = (p: Product) => {
    setErr(null)
    setCart((c) => {
      const ex = c.find((x) => x.product.id === p.id && x.selected_batch_id === null)
      if (ex) return c.map((x) => x.key === ex.key ? { ...x, quantity: x.quantity + 1 } : x)
      
      const newLineKey = crypto.randomUUID()
      const bData = selected?.id === p.id ? batches : []
      
      if (bData.length === 0) {
        apiGet<Batch[]>(`/products/${p.id}/batches`)
          .then(res => {
            setCart(curr => curr.map(item => item.key === newLineKey ? { ...item, batches: res } : item))
          })
          .catch(() => {})
      }
      
      return [...c, { 
        key: newLineKey,
        product: p, 
        batches: bData,
        selected_batch_id: null,
        quantity: 1, 
        sale_price: p.default_sale_price 
      }]
    })
  }

  const removeFromCart = (lineKey: string) => {
    setCart((c) => c.filter((x) => x.key !== lineKey))
  }

  const clearCart = () => {
    setCart([])
    setDraftSale(null)
    setResultSale(null)
  }

  const total = useMemo(
    () => cart.reduce((s, l) => s + Number(l.sale_price) * l.quantity, 0),
    [cart],
  )

  // ── Tạo phiếu nháp ────────────────────────────────────────────────
  const saveDraft = async () => {
    setErr(null)
    if (!cart.length) { setErr('Giỏ hàng trống.'); return }
    setLoading(true)
    try {
      const today = new Date().toISOString().slice(0, 10)
      const sale = await apiPost<SaleWithItems>('/sales', {
        date: today,
        created_by: 'pos',
        lines: cart.map((l) => ({ 
          product_id: l.product.id, 
          batch_id: l.selected_batch_id,
          quantity: l.quantity, 
          sale_price: l.sale_price 
        })),
      })
      setDraftSale(sale)
      setResultSale(null)
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  // ── Thanh toán (complete) ─────────────────────────────────────────
  const checkout = async () => {
    setErr(null)
    setLoading(true)
    try {
      let saleId = draftSale?.id
      // Nếu chưa có draft → tạo + complete trong 1 luồng
      if (!saleId) {
        if (!cart.length) { setErr('Giỏ hàng trống.'); setLoading(false); return }
        const today = new Date().toISOString().slice(0, 10)
        const sale = await apiPost<SaleWithItems>('/sales', {
          date: today,
          created_by: 'pos',
          lines: cart.map((l) => ({ 
            product_id: l.product.id, 
            batch_id: l.selected_batch_id,
            quantity: l.quantity, 
            sale_price: l.sale_price 
          })),
        })
        saleId = sale.id
      }
      const completed = await apiPost<{ sale: SaleWithItems }>(`/sales/${saleId}/complete`, {})
      setResultSale(completed.sale)
      setDraftSale(null)
      setCart([])
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  // ── Hủy phiếu ─────────────────────────────────────────────────────
  const cancelSale = async () => {
    if (!draftSale) return
    setLoading(true)
    setCancelPending(false)
    try {
      const cancelled = await apiPost<SaleWithItems>(`/sales/${draftSale.id}/cancel`, {})
      setResultSale(cancelled)
      setDraftSale(null)
      setCart([])
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  // ── Load draft từ lịch sử ─────────────────────────────────────────
  const loadDraftSale = async (id: number) => {
    setLoading(true)
    try {
      const sale = await apiGet<SaleWithItems>(`/sales/${id}`)
      // Rebuild cart từ draft (không có product name → chỉ set draft)
      setDraftSale(sale)
      setCart([]) // cart sẽ empty, nhưng draft đã có, có thể checkout
      setShowDrafts(false)
      setResultSale(null)
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold text-zinc-800 dark:text-zinc-100">POS — Bán hàng</h1>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={() => { setShowDrafts((v) => !v); loadDrafts() }}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            📋 Phiếu nháp
          </button>
        </div>
      </div>

      {/* Drafts panel */}
      {showDrafts && (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/50">
          <p className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">Phiếu nháp gần đây</p>
          {drafts.length === 0 ? (
            <p className="text-sm text-zinc-400">Không có phiếu nháp.</p>
          ) : (
            <div className="space-y-1">
              {drafts.map((d) => (
                <div key={d.id} className="flex items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
                  <span className="font-mono text-zinc-500">#{d.id}</span>
                  <span>{d.date}</span>
                  <span>{fmt(d.total_amount)} ₫</span>
                  <button
                    type="button"
                    onClick={() => loadDraftSale(d.id)}
                    className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-white hover:bg-zinc-700"
                  >
                    Mở
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        {/* ── Tìm sản phẩm ── */}
        <div className="space-y-3">
          <input
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-900"
            placeholder="Tìm sản phẩm theo tên hoặc SKU…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          <div className="max-h-64 overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-700">
            {products.length === 0 ? (
              <p className="p-4 text-center text-sm text-zinc-400">Không tìm thấy sản phẩm.</p>
            ) : (
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-zinc-100 text-xs uppercase text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                  <tr>
                    <th className="px-3 py-2 text-left">Sản phẩm</th>
                    <th className="px-3 py-2 text-right">Giá bán</th>
                    <th className="px-3 py-2 text-center">Thêm</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr
                      key={p.id}
                      className={`border-t border-zinc-200 dark:border-zinc-700 ${selected?.id === p.id ? 'bg-emerald-50 dark:bg-emerald-950/20' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/40'}`}
                    >
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          className="text-left"
                          onClick={() => setSelected((s) => s?.id === p.id ? null : p)}
                        >
                          <p className="font-medium">{p.name}</p>
                          <p className="text-xs font-mono text-zinc-400">{p.sku}</p>
                        </button>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-zinc-600 dark:text-zinc-300">
                        {fmt(p.default_sale_price)} ₫
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => addToCart(p)}
                          className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700 active:scale-95 transition-transform"
                        >
                          + Thêm
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Lô của sản phẩm được chọn */}
          {selected && (
            <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
              <p className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">
                Lô còn hàng (FEFO): <span className="text-emerald-700 dark:text-emerald-400">{selected.name}</span>
              </p>
              {batches.length === 0 ? (
                <p className="text-sm text-red-500">⚠ Hết hàng trong kho</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-zinc-500">
                      <th className="pb-1">Mã lô</th>
                      <th className="pb-1">HSD</th>
                      <th className="pb-1 text-right">Tồn</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batches.map((b) => (
                      <tr key={b.id} className="border-t border-zinc-100 dark:border-zinc-800">
                        <td className="py-1 font-mono text-xs">{b.batch_code || '—'}</td>
                        <td className="py-1">{b.expiry_date}</td>
                        <td className="py-1 text-right tabular-nums font-medium">{b.quantity_remaining}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>

        {/* ── Giỏ hàng ── */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-100">Giỏ hàng</h2>
            {draftSale && (
              <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300">
                Nháp #{draftSale.id}
              </span>
            )}
            {cart.length > 0 && (
              <button
                type="button"
                onClick={clearCart}
                className="ml-auto text-xs text-zinc-400 hover:text-red-500"
              >
                Xóa tất cả
              </button>
            )}
          </div>

          {/* Draft loaded — chưa có cart items */}
          {draftSale && cart.length === 0 && (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm dark:border-zinc-700 dark:bg-zinc-800">
              <p className="font-medium text-zinc-700 dark:text-zinc-200">Phiếu nháp #{draftSale.id} đã tải</p>
              <p className="text-xs text-zinc-500 mt-1">Gồm {draftSale.items.length} sản phẩm — Tổng: {fmt(draftSale.total_amount)} ₫</p>
              <p className="text-xs text-zinc-400 mt-1">Bấm "Thanh toán" để hoàn thành hoặc "Hủy phiếu" để hủy.</p>
            </div>
          )}

          {/* Cart items */}
          {cart.length > 0 && (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {cart.map((l) => (
                <div
                  key={l.key}
                  className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900"
                >
                  {/* Row 1: Product name + delete */}
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-sm leading-tight">{l.product.name}</p>
                      <p className="text-xs font-mono text-zinc-400">{l.product.sku}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFromCart(l.key)}
                      className="mt-0.5 flex-shrink-0 rounded-full p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                      title="Xóa khỏi giỏ"
                    >
                      ✕
                    </button>
                  </div>
                  {/* Row 1.5: Batch select (override FEFO) */}
                  <div className="mb-3">
                    <select
                      className="w-full rounded border border-zinc-300 bg-zinc-50 px-2 py-1 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                      value={l.selected_batch_id || ''}
                      onChange={(e) => {
                        const val = e.target.value ? Number(e.target.value) : null
                        setCart((c) => c.map((x) => (x.key === l.key ? { ...x, selected_batch_id: val } : x)))
                      }}
                    >
                      <option value="">Tự động (FEFO) - Ưu tiên lô cận Date</option>
                      {l.batches.map((b) => (
                        <option key={b.id} value={b.id}>
                          Lô: {b.batch_code || `ID ${b.id}`} ({b.quantity_remaining}) — HSD: {b.expiry_date}
                        </option>
                      ))}
                    </select>
                  </div>
                  {/* Row 2: SL | Đơn giá | Thành tiền */}
                  <div className="grid grid-cols-3 gap-2 items-end">
                    <div>
                      <p className="mb-0.5 text-xs text-zinc-500">Số lượng</p>
                      <input
                        type="number"
                        min={1}
                        className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm tabular-nums dark:border-zinc-600 dark:bg-zinc-800"
                        value={l.quantity}
                        onChange={(e) => {
                          const n = Math.max(1, Number(e.target.value) || 1)
                          setCart((c) => c.map((x) => x.key === l.key ? { ...x, quantity: n } : x))
                        }}
                      />
                    </div>
                    <div>
                      <p className="mb-0.5 text-xs text-zinc-500">Đơn giá (₫)</p>
                      <input
                        className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm tabular-nums dark:border-zinc-600 dark:bg-zinc-800"
                        value={l.sale_price}
                        onChange={(e) => {
                          const v = e.target.value
                          setCart((c) => c.map((x) => x.key === l.key ? { ...x, sale_price: v } : x))
                        }}
                      />
                    </div>
                    <div className="text-right">
                      <p className="mb-0.5 text-xs text-zinc-500">Thành tiền</p>
                      <p className="text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                        {fmt(Number(l.sale_price) * l.quantity)} ₫
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}


          {cart.length === 0 && !draftSale && (
            <p className="text-zinc-400 text-sm">Chưa có mặt hàng — bấm "+ Thêm" để thêm sản phẩm.</p>
          )}

          {/* Total */}
          {(cart.length > 0 || draftSale) && (
            <div className="flex items-center justify-between rounded-lg bg-zinc-100 px-4 py-3 dark:bg-zinc-800">
              <span className="text-sm font-medium text-zinc-600 dark:text-zinc-300">Tổng cộng</span>
              <span className="text-xl font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
                {fmt(total || (draftSale ? draftSale.total_amount : 0))} ₫
              </span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            {cart.length > 0 && !draftSale && (
              <button
                type="button"
                disabled={loading}
                onClick={saveDraft}
                className="flex-1 rounded-xl border border-zinc-300 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800 disabled:opacity-60"
              >
                💾 Lưu nháp
              </button>
            )}
            <button
              type="button"
              disabled={loading || (cart.length === 0 && !draftSale)}
              onClick={checkout}
              className="flex-1 rounded-xl bg-emerald-600 py-2.5 font-medium text-white hover:bg-emerald-700 disabled:opacity-50 text-sm transition-colors"
            >
              {loading ? 'Đang xử lý...' : '✅ Thanh toán'}
            </button>
            {draftSale && !cancelPending && (
              <button
                type="button"
                disabled={loading}
                onClick={() => setCancelPending(true)}
                className="rounded-xl border border-red-300 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950/30 disabled:opacity-60"
              >
                🗑 Hủy phiếu
              </button>
            )}
          </div>

          {/* Inline cancel confirm */}
          {cancelPending && draftSale && (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 dark:border-red-800 dark:bg-red-950/30">
              <p className="flex-1 text-sm text-red-700 dark:text-red-300">
                Xác nhận hủy phiếu <strong>#{draftSale.id}</strong>?
              </p>
              <button
                type="button"
                disabled={loading}
                onClick={cancelSale}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
              >
                {loading ? 'Đang hủy...' : 'Xác nhận hủy'}
              </button>
              <button
                type="button"
                onClick={() => setCancelPending(false)}
                className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-100 dark:border-red-700 dark:hover:bg-red-950/50"
              >
                Thôi
              </button>
            </div>
          )}

          {err ? <p className="text-red-600 text-sm">{err}</p> : null}

          {/* Result card */}
          {resultSale && (
            <div className={`rounded-xl border p-4 text-sm ${resultSale.status === 'completed' ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30' : 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30'}`}>
              <div className="mb-2 flex items-center gap-2">
                <p className="font-semibold text-zinc-800 dark:text-zinc-100">
                  Hóa đơn #{resultSale.id}
                </p>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[resultSale.status as SaleStatus]}`}>
                  {STATUS_LABEL[resultSale.status as SaleStatus] ?? resultSale.status}
                </span>
                <span className="ml-auto font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                  {fmt(resultSale.total_amount)} ₫
                </span>
              </div>
              <div className="space-y-1">
                {resultSale.items.map((it) => (
                  <div key={it.id} className="flex justify-between text-xs text-zinc-600 dark:text-zinc-300">
                    <span>{it.product_name || `SP #${it.product_id}`} · SL {it.quantity}</span>
                    <span>{fmt(Number(it.sale_price) * it.quantity)} ₫</span>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setResultSale(null)}
                className="mt-3 text-xs text-zinc-400 hover:text-zinc-600"
              >
                Đóng
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
