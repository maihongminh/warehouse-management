import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { apiGet, apiPost } from '../api'
import type { Batch, Product, SaleWithItems } from '../types'

type CartLine = {
  product: Product
  quantity: number
  sale_price: string
}

export default function POS() {
  const [q, setQ] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [selected, setSelected] = useState<Product | null>(null)
  const [batches, setBatches] = useState<Batch[]>([])
  const [cart, setCart] = useState<CartLine[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState<SaleWithItems | null>(null)

  useEffect(() => {
    const qs = q ? `?q=${encodeURIComponent(q)}` : ''
    apiGet<Product[]>(`/products${qs}`)
      .then(setProducts)
      .catch((e: Error) => setErr(e.message))
  }, [q])

  useEffect(() => {
    if (!selected) {
      setBatches([])
      return
    }
    apiGet<Batch[]>(`/products/${selected.id}/batches`)
      .then(setBatches)
      .catch(() => setBatches([]))
  }, [selected])

  const addToCart = (p: Product) => {
    setErr(null)
    setCart((c) => {
      const ex = c.find((x) => x.product.id === p.id)
      if (ex) {
        return c.map((x) =>
          x.product.id === p.id ? { ...x, quantity: x.quantity + 1 } : x,
        )
      }
      return [
        ...c,
        {
          product: p,
          quantity: 1,
          sale_price: p.default_sale_price,
        },
      ]
    })
  }

  const total = useMemo(() => {
    return cart.reduce((s, l) => s + Number(l.sale_price) * l.quantity, 0)
  }, [cart])

  const checkout = async (e: FormEvent) => {
    e.preventDefault()
    setErr(null)
    setDone(null)
    if (!cart.length) {
      setErr('Giỏ hàng trống.')
      return
    }
    const today = new Date().toISOString().slice(0, 10)
    try {
      const sale = await apiPost<SaleWithItems>('/sales', {
        date: today,
        created_by: 'pos',
        lines: cart.map((l) => ({
          product_id: l.product.id,
          quantity: l.quantity,
          sale_price: l.sale_price,
        })),
      })
      const completed = await apiPost<{ sale: SaleWithItems }>(`/sales/${sale.id}/complete`, {})
      setDone(completed.sale)
      setCart([])
    } catch (e) {
      setErr((e as Error).message)
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div>
        <input
          className="mb-3 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-900"
          placeholder="Tìm sản phẩm…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <ul className="max-h-72 space-y-1 overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-700">
          {products.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800"
                onClick={() => {
                  setSelected(p)
                  addToCart(p)
                }}
              >
                <span>{p.name}</span>
                <span className="font-mono text-sm text-zinc-500">{p.sku}</span>
              </button>
            </li>
          ))}
        </ul>

        {selected ? (
          <div className="mt-4 rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
            <p className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">
              Lô còn hàng (FEFO — HSD tăng dần): {selected.name}
            </p>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-zinc-500">
                  <th className="pb-1">Lô</th>
                  <th className="pb-1">HSD</th>
                  <th className="pb-1">Tồn</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b.id}>
                    <td className="py-0.5 font-mono">{b.batch_code || '—'}</td>
                    <td className="py-0.5">{b.expiry_date}</td>
                    <td className="py-0.5 tabular-nums">{b.quantity_remaining}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      <div>
        <h2 className="mb-2 text-lg font-medium">Giỏ hàng</h2>
        {cart.length === 0 ? (
          <p className="text-zinc-500">Chưa có mặt hàng.</p>
        ) : (
          <ul className="space-y-2">
            {cart.map((l) => (
              <li
                key={l.product.id}
                className="flex flex-wrap items-end justify-between gap-2 rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-700"
              >
                <div>
                  <p className="font-medium">{l.product.name}</p>
                  <label className="mt-1 flex items-center gap-2 text-sm text-zinc-600">
                    SL
                    <input
                      type="number"
                      min={1}
                      className="w-20 rounded border px-2 py-0.5 dark:border-zinc-600 dark:bg-zinc-900"
                      value={l.quantity}
                      onChange={(e) => {
                        const n = Math.max(1, Number(e.target.value) || 1)
                        setCart((c) =>
                          c.map((x) => (x.product.id === l.product.id ? { ...x, quantity: n } : x)),
                        )
                      }}
                    />
                  </label>
                </div>
                <label className="flex flex-col text-xs text-zinc-500">
                  Đơn giá
                  <input
                    className="w-28 rounded border px-2 py-1 dark:border-zinc-600 dark:bg-zinc-900"
                    value={l.sale_price}
                    onChange={(e) => {
                      const v = e.target.value
                      setCart((c) =>
                        c.map((x) => (x.product.id === l.product.id ? { ...x, sale_price: v } : x)),
                      )
                    }}
                  />
                </label>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-lg">
          Tạm tính:{' '}
          <strong className="tabular-nums">{total.toLocaleString('vi-VN')}</strong>
        </p>
        <form onSubmit={checkout} className="mt-4">
          <button
            type="submit"
            className="w-full rounded-xl bg-emerald-600 py-3 font-medium text-white hover:bg-emerald-700"
          >
            Thanh toán
          </button>
        </form>
        {err ? <p className="mt-2 text-red-600">{err}</p> : null}
        {done ? (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm dark:border-emerald-900 dark:bg-emerald-950/40">
            <p className="font-medium text-emerald-800 dark:text-emerald-200">
              Hóa đơn #{done.id} — {done.status} — Tổng {done.total_amount}
            </p>
            <ul className="mt-2 space-y-1">
              {done.items.map((it) => (
                <li key={it.id} className="font-mono text-xs text-zinc-700 dark:text-zinc-300">
                  sp {it.product_id} · lô {it.batch_id} · SL {it.quantity} · {it.sale_price} (
                  vốn {it.import_price_snapshot ?? '—'})
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  )
}
