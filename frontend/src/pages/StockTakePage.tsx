import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { apiGet, apiPost } from '../api'
import type { ProductInventory } from '../types'

type FlatRow = {
  productId: number
  productName: string
  sku: string
  unit: string
  batchId: number
  batchCode: string
  expiryDate: string
  systemQty: number
}

export default function StockTakePage() {
  const [rows, setRows] = useState<ProductInventory[]>([])
  const [filter, setFilter] = useState('')
  const [draft, setDraft] = useState<Record<number, string>>({})
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(() => {
    apiGet<ProductInventory[]>('/inventory/products')
      .then(setRows)
      .catch((e: Error) => setErr(e.message))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const flat = useMemo(() => {
    const f = filter.trim().toLowerCase()
    const out: FlatRow[] = []
    for (const p of rows) {
      if (f && !p.name.toLowerCase().includes(f) && !p.sku.toLowerCase().includes(f)) continue
      for (const b of p.batches) {
        out.push({
          productId: p.id,
          productName: p.name,
          sku: p.sku,
          unit: p.unit,
          batchId: b.id,
          batchCode: b.batch_code,
          expiryDate: b.expiry_date,
          systemQty: b.quantity_remaining,
        })
      }
    }
    return out
  }, [rows, filter])

  const applyRow = (batchId: number, e: FormEvent) => {
    e.preventDefault()
    setErr(null)
    setMsg(null)
    const raw = draft[batchId]?.trim() ?? ''
    const actual = Number(raw)
    if (!Number.isFinite(actual) || actual < 0) {
      setErr('Số lượng thực tế không hợp lệ.')
      return
    }
    apiPost<{ id: number; difference: number }>('/stock/adjust', {
      batch_id: batchId,
      actual_quantity: actual,
    })
      .then((adj) => {
        setMsg(`Đã điều chỉnh lô #${batchId} (chênh ${adj.difference}).`)
        setDraft((d) => {
          const n = { ...d }
          delete n[batchId]
          return n
        })
        load()
      })
      .catch((e: Error) => setErr(e.message))
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Nhập <strong>số lượng thực tế đếm được</strong> cho từng lô; hệ thống cập nhật tồn và ghi log điều chỉnh.{' '}
        <Link to="/inventory" className="text-emerald-700 underline dark:text-emerald-400">
          Xem kho
        </Link>
      </p>

      <div className="flex flex-wrap gap-2">
        <input
          className="max-w-md flex-1 rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-900"
          placeholder="Lọc tên hoặc SKU…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <button
          type="button"
          onClick={load}
          className="rounded-lg border border-zinc-300 px-4 py-2 dark:border-zinc-600"
        >
          Làm mới
        </button>
      </div>

      {msg ? <p className="text-emerald-700 dark:text-emerald-400">{msg}</p> : null}
      {err ? <p className="text-red-600">{err}</p> : null}

      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-700">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-zinc-100 dark:bg-zinc-800">
            <tr>
              <th className="px-3 py-2">Sản phẩm</th>
              <th className="px-3 py-2">SKU</th>
              <th className="px-3 py-2">Lô</th>
              <th className="px-3 py-2">HSD</th>
              <th className="px-3 py-2">SL hệ thống</th>
              <th className="px-3 py-2">SL thực tế</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {flat.map((r) => (
              <tr key={r.batchId} className="border-t border-zinc-200 dark:border-zinc-700">
                <td className="px-3 py-2">{r.productName}</td>
                <td className="px-3 py-2 font-mono text-zinc-500">{r.sku}</td>
                <td className="px-3 py-2 font-mono">{r.batchCode || '—'}</td>
                <td className="px-3 py-2">{r.expiryDate}</td>
                <td className="px-3 py-2 tabular-nums">
                  {r.systemQty} {r.unit}
                </td>
                <td className="px-3 py-2">
                  <input
                    className="w-24 rounded border border-zinc-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-900"
                    inputMode="numeric"
                    placeholder={String(r.systemQty)}
                    value={draft[r.batchId] ?? ''}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, [r.batchId]: e.target.value }))
                    }
                  />
                </td>
                <td className="px-3 py-2">
                  <form onSubmit={(e) => applyRow(r.batchId, e)}>
                    <button
                      type="submit"
                      className="rounded-md bg-emerald-600 px-2 py-1 text-xs text-white hover:bg-emerald-700"
                    >
                      Ghi nhận
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {flat.length === 0 ? <p className="p-4 text-zinc-500">Không có lô nào (hoặc chưa nhập kho).</p> : null}
      </div>
    </div>
  )
}
