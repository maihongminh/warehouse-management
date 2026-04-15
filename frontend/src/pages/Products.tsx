import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { apiDelete, apiGet, apiGetBlob, apiPost, apiUpload } from '../api'
import type { PaginatedResponse, Product } from '../types'
import Pagination from '../components/Pagination'

type ImportResult = {
  created: number
  updated: number
  errors: string[]
  message: string
}

export default function Products() {
  const [paged, setPaged] = useState<PaginatedResponse<Product> | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [q, setQ] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [okMsg, setOkMsg] = useState<string | null>(null)
  const [lastCreatedId, setLastCreatedId] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [sku, setSku] = useState('')
  const [unit, setUnit] = useState('hộp')
  const [dip, setDip] = useState('0')
  const [dsp, setDsp] = useState('0')
  const [conversionRate, setConversionRate] = useState('1')

  // Excel import state
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [exporting, setExporting] = useState(false)

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const load = (targetPage: number = page, size: number = pageSize) => {
    const qs = `page=${targetPage}&size=${size}${q ? `&q=${encodeURIComponent(q)}` : ''}`
    apiGet<PaginatedResponse<Product>>(`/products?${qs}`)
      .then(setPaged)
      .catch((e: Error) => setErr(e.message))
  }

  useEffect(() => {
    load(page, pageSize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize])

  const onSearch = (e: FormEvent) => {
    e.preventDefault()
    setPage(1)
    load(1)
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
      conversion_rate: Number(conversionRate),
      is_active: true,
    })
      .then((created) => {
        setName('')
        setSku('')
        setConversionRate('1')
        setOkMsg(`Đã tạo «${created.name}» (${created.sku}).`)
        load()
        setLastCreatedId(created.id)
      })
      .catch((e: Error) => setErr(e.message))
  }

  const onImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setImportResult(null)
    setErr(null)
    const fd = new FormData()
    fd.append('file', file)
    try {
      const result = await apiUpload<ImportResult>('/products/import-excel', fd)
      setImportResult(result)
      load()
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : String(ex))
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const onExportExcel = async () => {
    setExporting(true)
    try {
      const blob = await apiGetBlob('/products/export-excel')
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'DanhSachSanPham.xlsx'
      a.click()
      URL.revokeObjectURL(url)
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : String(ex))
    } finally {
      setExporting(false)
    }
  }

  const onDeleteConfirm = async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    try {
      await apiDelete(`/products/${deleteTarget.id}`)
      setDeleteTarget(null)
      load()
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : String(ex))
    } finally {
      setDeleteLoading(false)
    }
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
          Đã có sản phẩm? Vào{' '}
          <Link to="/import" className="text-emerald-700 underline dark:text-emerald-400">Nhập kho</Link>{' '}
          hoặc bấm «Nhập kho» trên từng dòng trong bảng.
        </p>
      </section>

      {/* Search + Excel buttons */}
      <div className="flex flex-wrap items-center gap-2">
        <form onSubmit={onSearch} className="flex gap-2">
          <input
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
            placeholder="Tìm tên hoặc SKU…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button
            type="submit"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-700"
          >
            Tìm
          </button>
        </form>

        <div className="ml-auto flex gap-2">
          {/* Import Excel */}
          <label className={`flex cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800 ${importing ? 'opacity-60 cursor-not-allowed' : ''}`}>
            {importing ? 'Đang nhập...' : 'Nhập từ Excel'}
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              disabled={importing}
              onChange={onImportExcel}
            />
          </label>

          {/* Export Excel */}
          <button
            type="button"
            disabled={exporting}
            onClick={onExportExcel}
            className="flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 dark:hover:bg-emerald-900/50 disabled:opacity-60"
          >
            {exporting ? 'Đang xuất...' : 'Xuất Excel'}
          </button>
        </div>
      </div>

      {/* Import result */}
      {importResult && (
        <div className={`rounded-lg px-4 py-3 text-sm ${importResult.errors.length > 0 ? 'bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200' : 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200'}`}>
          <p className="font-medium">{importResult.message}</p>
          {importResult.errors.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-xs">
              {importResult.errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}
        </div>
      )}

      {/* Create form */}
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
          <label className="flex flex-col gap-1 text-sm">
            Quy đổi (1 đơn vị = ? đơn vị nhỏ)
            <input
              type="number"
              min="1"
              className="rounded border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
              value={conversionRate}
              onChange={(e) => setConversionRate(e.target.value)}
            />
          </label>
          <div className="flex items-end sm:col-span-2 lg:col-span-3">
            <button
              type="submit"
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
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
        <h2 className="mb-2 text-lg font-medium text-zinc-800 dark:text-zinc-100">
          Danh sách ({paged?.total ?? 0})
        </h2>
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-700">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-zinc-100 text-xs uppercase text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              <tr>
                <th className="px-3 py-2">SKU</th>
                <th className="px-3 py-2">Tên</th>
                <th className="px-3 py-2">ĐVT</th>
                <th className="px-3 py-2 text-center">Quy đổi</th>
                <th className="px-3 py-2 text-right">Giá vốn</th>
                <th className="px-3 py-2 text-right">Giá bán</th>
                <th className="px-3 py-2 text-right">Tiếp theo</th>
                <th className="px-3 py-2 text-center">Xóa</th>
              </tr>
            </thead>
            <tbody>
              {paged?.items.map((p) => (
                <tr key={p.id} className="border-t border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                  <td className="px-3 py-2 font-mono text-xs text-zinc-500">{p.sku}</td>
                  <td className="px-3 py-2 font-medium">{p.name}</td>
                  <td className="px-3 py-2">{p.unit}</td>
                  <td className="px-3 py-2 text-center">
                    {p.conversion_rate > 1 ? `1:${p.conversion_rate}` : '—'}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{Number(p.default_import_price).toLocaleString('vi-VN')}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{Number(p.default_sale_price).toLocaleString('vi-VN')}</td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      to={`/import?productId=${p.id}`}
                      className="inline-block rounded-md bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700"
                    >
                      Nhập kho
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(p)}
                      className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/30"
                      title="Ẩn sản phẩm"
                    >
                      🗑 Xóa
                    </button>
                  </td>
                </tr>
              ))}
              {paged?.items.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-zinc-400">Không có sản phẩm.</td>
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
      </div>

      {/* Delete confirm modal */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setDeleteTarget(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">Xác nhận ẩn sản phẩm</h3>
            <p className="mb-1 text-sm text-zinc-600 dark:text-zinc-300">
              Bạn có chắc muốn ẩn <strong>{deleteTarget.name}</strong>?
            </p>
            <p className="mb-4 text-xs text-zinc-400">
              Sản phẩm sẽ bị ẩn khỏi danh sách và POS, dữ liệu lịch sử vẫn được giữ nguyên.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                disabled={deleteLoading}
                onClick={onDeleteConfirm}
                className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
              >
                {deleteLoading ? 'Đang xử lý...' : 'Xác nhận ẩn'}
              </button>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="flex-1 rounded-lg border border-zinc-300 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
