import { useEffect, useState } from 'react'
import { apiGet } from '../api'
import type { PaginatedResponse, ProductInventory } from '../types'
import Pagination from '../components/Pagination'

type SortKey = 'name' | 'sku' | 'total_quantity' | 'default_sale_price' | 'expiry'

function getDaysUntilExpiry(batches: ProductInventory['batches']): number | null {
  const active = batches.filter((b) => b.quantity_remaining > 0)
  if (!active.length) return null
  const earliest = active
    .map((b) => new Date(b.expiry_date).getTime())
    .sort((a, b) => a - b)[0]
  return Math.ceil((earliest - Date.now()) / 86400000)
}

function fmt(n: string | number) {
  return Number(n).toLocaleString('vi-VN')
}

export default function InventoryPage() {
  const [paged, setPaged] = useState<PaginatedResponse<ProductInventory> | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [q, setQ] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortAsc, setSortAsc] = useState(true)

  const load = (targetPage: number = page, size: number = pageSize) => {
    const qs = `page=${targetPage}&size=${size}${q ? `&q=${encodeURIComponent(q)}` : ''}`
    apiGet<PaginatedResponse<ProductInventory>>(`/inventory/products?${qs}`)
      .then(setPaged)
      .catch((e: Error) => setErr(e.message))
  }

  useEffect(() => {
    load(page, pageSize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((a) => !a)
    else {
      setSortKey(key)
      setSortAsc(true)
    }
  }

  const sorted = [...(paged?.items ?? [])].sort((a, b) => {
    let va: number | string = 0
    let vb: number | string = 0
    if (sortKey === 'name') { va = a.name; vb = b.name }
    else if (sortKey === 'sku') { va = a.sku; vb = b.sku }
    else if (sortKey === 'total_quantity') { va = a.total_quantity; vb = b.total_quantity }
    else if (sortKey === 'default_sale_price') { va = Number(a.default_sale_price); vb = Number(b.default_sale_price) }
    else if (sortKey === 'expiry') {
      va = getDaysUntilExpiry(a.batches) ?? 99999
      vb = getDaysUntilExpiry(b.batches) ?? 99999
    }
    if (typeof va === 'string') return sortAsc ? va.localeCompare(vb as string) : (vb as string).localeCompare(va)
    return sortAsc ? (va as number) - (vb as number) : (vb as number) - (va as number)
  })

  const SortIcon = ({ k }: { k: SortKey }) => (
    <span className="ml-1 text-zinc-400">
      {sortKey === k ? (sortAsc ? '▲' : '▼') : '⇅'}
    </span>
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold text-zinc-800 dark:text-zinc-100">Quản lý kho</h1>
        <div className="ml-auto flex gap-2">
          <input
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
            placeholder="Lọc tên / SKU…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (setPage(1), load(1))}
          />
          <button
            type="button"
            onClick={() => { setPage(1); load(1) }}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-700"
          >
            Tìm
          </button>
        </div>
      </div>

      {err ? <p className="text-red-600">{err}</p> : null}

      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-700">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-zinc-100 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
            <tr>
              <th
                className="cursor-pointer px-3 py-3 hover:text-zinc-700 dark:hover:text-zinc-200"
                onClick={() => toggleSort('sku')}
              >
                SKU <SortIcon k="sku" />
              </th>
              <th
                className="cursor-pointer px-3 py-3 hover:text-zinc-700 dark:hover:text-zinc-200"
                onClick={() => toggleSort('name')}
              >
                Tên sản phẩm <SortIcon k="name" />
              </th>
              <th className="px-3 py-3">ĐVT</th>
              <th className="px-3 py-3">Quy đổi</th>
              <th
                className="cursor-pointer px-3 py-3 text-right hover:text-zinc-700 dark:hover:text-zinc-200"
                onClick={() => toggleSort('total_quantity')}
              >
                Tổng tồn <SortIcon k="total_quantity" />
              </th>
              <th
                className="cursor-pointer px-3 py-3 text-right hover:text-zinc-700 dark:hover:text-zinc-200"
                onClick={() => toggleSort('default_sale_price')}
              >
                Giá bán <SortIcon k="default_sale_price" />
              </th>
              <th className="px-3 py-3 text-right">Giá vốn</th>
              <th
                className="cursor-pointer px-3 py-3 text-right hover:text-zinc-700 dark:hover:text-zinc-200"
                onClick={() => toggleSort('expiry')}
              >
                HSD gần nhất <SortIcon k="expiry" />
              </th>
              <th className="px-3 py-3">Lô hàng</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => {
              const activeBatches = p.batches.filter((b) => b.quantity_remaining > 0)
              const avgImportPrice = activeBatches.length
                ? activeBatches.reduce((s, b) => s + Number(b.import_price) * b.quantity_remaining, 0) /
                  p.total_quantity
                : 0
              const daysLeft = getDaysUntilExpiry(p.batches)
              const expiryWarning =
                daysLeft !== null && daysLeft <= 7
                  ? 'bg-red-50 dark:bg-red-950/30'
                  : daysLeft !== null && daysLeft <= 30
                  ? 'bg-amber-50 dark:bg-amber-950/20'
                  : ''
              const earliestBatch = activeBatches.sort(
                (a, b) => new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime(),
              )[0]

              return (
                <tr
                  key={p.id}
                  className={`border-t border-zinc-200 dark:border-zinc-700 ${expiryWarning}`}
                >
                  <td className="px-3 py-2.5 font-mono text-xs text-zinc-500">{p.sku}</td>
                  <td className="px-3 py-2.5 font-medium text-zinc-900 dark:text-zinc-100">{p.name}</td>
                  <td className="px-3 py-2.5 text-zinc-600 dark:text-zinc-400">{p.unit}</td>
                  <td className="px-3 py-2.5 text-center text-zinc-600 dark:text-zinc-400">
                    {p.conversion_rate > 1 ? `1:${p.conversion_rate}` : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    <span
                      className={
                        p.total_quantity <= 0
                          ? 'font-semibold text-red-600'
                          : p.total_quantity <= 10
                          ? 'font-semibold text-amber-600'
                          : 'font-semibold text-emerald-700 dark:text-emerald-400'
                      }
                    >
                      {fmt(p.total_quantity)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                    {fmt(p.default_sale_price)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-zinc-500">
                    {avgImportPrice > 0 ? fmt(avgImportPrice.toFixed(0)) : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {earliestBatch ? (
                      <span className={daysLeft !== null && daysLeft <= 7 ? 'font-semibold text-red-600' : daysLeft !== null && daysLeft <= 30 ? 'text-amber-600' : 'text-zinc-600 dark:text-zinc-400'}>
                        {earliestBatch.expiry_date}
                        {daysLeft !== null && (
                          <span className="ml-1 text-xs">({daysLeft}d)</span>
                        )}
                      </span>
                    ) : (
                      <span className="text-zinc-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {activeBatches.slice(0, 3).map((b) => (
                        <span
                          key={b.id}
                          className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-mono text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                          title={`HSD: ${b.expiry_date} | SL: ${b.quantity_remaining} | Giá: ${fmt(b.import_price)}`}
                        >
                          {b.batch_code || `#${b.id}`} ({b.quantity_remaining})
                        </span>
                      ))}
                      {activeBatches.length > 3 && (
                        <span className="text-xs text-zinc-400">+{activeBatches.length - 3}</span>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-zinc-500">
                  Không có dữ liệu tồn kho.
                </td>
              </tr>
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

      <div className="flex gap-4 text-xs text-zinc-500">
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-red-100 dark:bg-red-950/50" /> HSD ≤ 7 ngày
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-amber-100 dark:bg-amber-950/30" /> HSD ≤ 30 ngày
        </span>
        <span className="flex items-center gap-1">
          <span className="font-semibold text-emerald-700">Xanh</span> = còn hàng
        </span>
        <span className="flex items-center gap-1">
          <span className="font-semibold text-amber-600">Vàng</span> = tồn thấp (≤10)
        </span>
      </div>
    </div>
  )
}
