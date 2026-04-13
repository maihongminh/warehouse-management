import { useEffect, useState } from 'react'
import { apiGet } from '../api'
import type { ProductInventory } from '../types'

export default function InventoryPage() {
  const [rows, setRows] = useState<ProductInventory[]>([])
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<number | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const load = () => {
    const qs = q ? `?q=${encodeURIComponent(q)}` : ''
    apiGet<ProductInventory[]>(`/inventory/products${qs}`)
      .then(setRows)
      .catch((e: Error) => setErr(e.message))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <input
          className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-900"
          placeholder="Lọc tên / SKU…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button
          type="button"
          onClick={load}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700"
        >
          Áp dụng
        </button>
      </div>
      {err ? <p className="text-red-600">{err}</p> : null}
      <ul className="space-y-2">
        {rows.map((p) => (
          <li key={p.id} className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
            <button
              type="button"
              className="flex w-full items-center justify-between px-4 py-3 text-left"
              onClick={() => setOpen((id) => (id === p.id ? null : p.id))}
            >
              <span>
                <span className="font-medium text-zinc-900 dark:text-zinc-100">{p.name}</span>
                <span className="ml-2 font-mono text-sm text-zinc-500">{p.sku}</span>
              </span>
              <span className="tabular-nums text-zinc-600 dark:text-zinc-300">
                Tồn: {p.total_quantity} {p.unit}
              </span>
            </button>
            {open === p.id ? (
              <div className="border-t border-zinc-200 px-4 py-3 dark:border-zinc-700">
                <p className="mb-2 text-xs uppercase tracking-wide text-zinc-500">Lô (FEFO = HSD tăng dần)</p>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-zinc-500">
                      <th className="pb-1">Mã lô</th>
                      <th className="pb-1">HSD</th>
                      <th className="pb-1">SL</th>
                      <th className="pb-1">Giá nhập</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.batches.map((b) => (
                      <tr key={b.id}>
                        <td className="py-1 font-mono">{b.batch_code || '—'}</td>
                        <td className="py-1">{b.expiry_date}</td>
                        <td className="py-1 tabular-nums">{b.quantity_remaining}</td>
                        <td className="py-1 tabular-nums">{b.import_price}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}
