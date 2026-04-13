import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import type { FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { apiGet, apiPost } from '../api'
import type { Product } from '../types'

type Line = {
  key: string
  product_id: number | null
  /** Hiển thị sau khi chọn */
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

export default function ImportPage() {
  const [searchParams] = useSearchParams()
  const prefilled = useRef(false)

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [lines, setLines] = useState<Line[]>(() => [newLine()])
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

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

  // Mở từ Sản phẩm: /import?productId=...
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
      .catch(() => {
        prefilled.current = false
      })
  }, [searchParams])

  const addLine = () => {
    setLines((L) => [...L, newLine()])
  }

  const removeLine = (key: string) => {
    setLines((L) => (L.length <= 1 ? L : L.filter((x) => x.key !== key)))
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setErr(null)
    setMsg(null)
    const payload = {
      date,
      created_by: 'pos',
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
        setMsg(`Đã tạo phiếu nhập #${r.id}`)
        setLines([newLine()])
      })
      .catch((e: Error) => setErr(e.message))
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <section className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 text-sm text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">
        <h2 className="mb-2 font-semibold">Quy trình nhập kho</h2>
        <ol className="list-decimal space-y-1 pl-5">
          <li>
            <strong>Danh mục</strong> — tạo sản phẩm (tên, SKU, giá mặc định) ở màn hình <em>Sản phẩm</em> nếu chưa có.
          </li>
          <li>
            <strong>Phiếu nhập</strong> — chọn từng sản phẩm, số lượng, giá nhập thực tế, mã lô và HSD. Hệ thống gộp
            tồn theo (sản phẩm + mã lô + HSD).
          </li>
          <li>Sau khi ghi nhận, kiểm tra tồn tại màn <em>Kho</em> hoặc dùng <em>POS</em> để bán.</li>
        </ol>
      </section>

      <form onSubmit={onSubmit} className="space-y-4">
        <label className="flex max-w-xs flex-col gap-1 text-sm">
          Ngày nhập
          <input
            type="date"
            className="rounded border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </label>

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
            className="rounded-lg border border-zinc-300 px-4 py-2 dark:border-zinc-600"
          >
            + Dòng
          </button>
          <button type="submit" className="rounded-lg bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700">
            Ghi nhận nhập kho
          </button>
        </div>
        {msg ? <p className="text-emerald-700 dark:text-emerald-400">{msg}</p> : null}
        {err ? <p className="text-red-600">{err}</p> : null}
      </form>
    </div>
  )
}

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
        <button
          type="button"
          onClick={onRemove}
          className="text-xs text-red-600 hover:underline"
        >
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
                      ? {
                          ...x,
                          product_id: null,
                          product_summary: '',
                          pickQuery: v,
                        }
                      : x,
                  ),
                )
                setOpen(true)
              }}
              onFocus={() => {
                if (line.product_id) return
                setOpen(true)
              }}
            />
          </label>
          {open && !line.product_id && line.pickQuery.trim() && suggestions.length > 0 ? (
            <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-600 dark:bg-zinc-900">
              {suggestions.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    onClick={() => {
                      onSelectProduct(line.key, p)
                      setOpen(false)
                    }}
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
