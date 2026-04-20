import { useState } from 'react'
import { apiPost } from '../api'
import type { Supplier } from '../types'

interface Props {
  onCreated: (supplier: Supplier) => void
  onClose: () => void
}

export default function SupplierQuickAddModal({ onCreated, onClose }: Props) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setErr('Vui lòng nhập tên nhà cung cấp.'); return }
    setLoading(true)
    setErr(null)
    try {
      const supplier = await apiPost<Supplier>('/suppliers', { name, phone: phone || null, address: address || null, note: note || null })
      onCreated(supplier)
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : String(ex))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-700">
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Thêm nhà cung cấp</h3>
          <button type="button" onClick={onClose} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <label className="flex flex-col gap-1 text-sm">
            Tên nhà cung cấp *
            <input
              className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="VD: Dược phẩm ABC"
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Số điện thoại
            <input
              className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0901234567"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Địa chỉ
            <input
              className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Ghi chú
            <textarea
              className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800 resize-none"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          {err && <p className="text-sm text-red-600">{err}</p>}
          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-lg bg-emerald-600 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {loading ? 'Đang lưu...' : 'Lưu nhà cung cấp'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Hủy
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
