import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { apiGet, apiPost } from '../api'
import type { Product } from '../types'

export default function Products() {
  const [list, setList] = useState<Product[]>([])
  const [q, setQ] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [okMsg, setOkMsg] = useState<string | null>(null)
  const [lastCreatedId, setLastCreatedId] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [sku, setSku] = useState('')
  const [unit, setUnit] = useState('hộp')
  const [dip, setDip] = useState('0')
  const [dsp, setDsp] = useState('0')

  const load = () => {
    const qs = q ? `?q=${encodeURIComponent(q)}` : ''
    apiGet<Product[]>(`/products${qs}`)
      .then(setList)
      .catch((e: Error) => setErr(e.message))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onSearch = (e: FormEvent) => {
    e.preventDefault()
    load()
  }

  const onCreate = (e: FormEvent) => {
    e.preventDefault()
    setErr(null)
    setOkMsg(null)
    apiPost<Product>('/products', {
      name,
      sku,
      unit,
      default_import_price: dip,
      default_sale_price: dsp,
      is_active: true,
    })
      .then((created) => {
        setName('')
        setSku('')
        setOkMsg(`Đã tạo «${created.name}» (${created.sku}).`)
        load()
        setLastCreatedId(created.id)
      })
      .catch((e: Error) => setErr(e.message))
  }

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-700 dark:bg-zinc-900">
        <h2 className="mb-2 font-semibold text-zinc-900 dark:text-zinc-100">Quy trình: thêm sản phẩm → nhập kho</h2>
        <ol className="list-decimal space-y-1 pl-5 text-zinc-600 dark:text-zinc-300">
          <li>
            <strong>Danh mục</strong> — điền form bên dưới (SKU duy nhất, giá mặc định dùng gợi ý khi nhập kho / POS).
          </li>
          <li>
            <strong>Tồn thật</strong> — sau khi lưu, app chuyển sang{' '}
            <Link to="/import" className="font-medium text-emerald-700 underline dark:text-emerald-400">
              Nhập kho
            </Link>
            : chọn sản phẩm, số lượng, giá nhập, mã lô, HSD.
          </li>
        </ol>
        <p className="mt-2 text-zinc-500">
          Đã có sản phẩm? Vào <Link to="/import" className="text-emerald-700 underline dark:text-emerald-400">Nhập kho</Link>{' '}
          hoặc bấm «Nhập kho» trên từng dòng trong bảng.
        </p>
      </section>

      <form onSubmit={onSearch} className="flex flex-wrap gap-2">
        <input
          className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-900"
          placeholder="Tìm tên hoặc SKU…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button
          type="submit"
          className="rounded-lg bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700"
        >
          Tìm
        </button>
      </form>

      <section className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-900/40">
        <h2 className="mb-3 text-lg font-medium text-zinc-800 dark:text-zinc-100">Thêm sản phẩm (danh mục)</h2>
        <form onSubmit={onCreate} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm">
            Tên
            <input
              required
              className="rounded border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            SKU
            <input
              required
              className="rounded border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Đơn vị
            <input
              className="rounded border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Giá nhập mặc định
            <input
              className="rounded border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
              value={dip}
              onChange={(e) => setDip(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Giá bán mặc định
            <input
              className="rounded border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
              value={dsp}
              onChange={(e) => setDsp(e.target.value)}
            />
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-white hover:bg-zinc-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
            >
              Lưu sản phẩm
            </button>
          </div>
        </form>
      </section>

      {okMsg ? (
        <div className="rounded-lg bg-emerald-50 px-3 py-3 text-sm text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200">
          <p>{okMsg}</p>
          {lastCreatedId != null ? (
            <p className="mt-2">
              <Link
                to={`/import?productId=${lastCreatedId}`}
                className="inline-flex rounded-md bg-emerald-600 px-3 py-1.5 font-medium text-white hover:bg-emerald-700"
              >
                Bước 2 — Nhập kho cho sản phẩm này
              </Link>
            </p>
          ) : null}
        </div>
      ) : null}
      {err ? <p className="text-red-600">{err}</p> : null}

      <div>
        <h2 className="mb-2 text-lg font-medium text-zinc-800 dark:text-zinc-100">Danh sách</h2>
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-700">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-zinc-100 dark:bg-zinc-800">
              <tr>
                <th className="px-3 py-2">SKU</th>
                <th className="px-3 py-2">Tên</th>
                <th className="px-3 py-2">Đơn vị</th>
                <th className="px-3 py-2">Giá bán</th>
                <th className="px-3 py-2 text-right">Tiếp theo</th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id} className="border-t border-zinc-200 dark:border-zinc-700">
                  <td className="px-3 py-2 font-mono">{p.sku}</td>
                  <td className="px-3 py-2">{p.name}</td>
                  <td className="px-3 py-2">{p.unit}</td>
                  <td className="px-3 py-2 tabular-nums">{p.default_sale_price}</td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      to={`/import?productId=${p.id}`}
                      className="inline-block rounded-md bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700"
                    >
                      Nhập kho
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
