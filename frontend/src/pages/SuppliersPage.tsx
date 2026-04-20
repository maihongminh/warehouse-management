import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { apiDelete, apiGet, apiPatch, apiPost } from '../api'
import type { Supplier } from '../types'
import ConfirmDialog from '../components/ConfirmDialog'

function fmt(dt: string) {
  return new Date(dt).toLocaleDateString('vi-VN')
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [okMsg, setOkMsg] = useState<string | null>(null)

  // Add form
  const [addName, setAddName] = useState('')
  const [addPhone, setAddPhone] = useState('')
  const [addAddress, setAddAddress] = useState('')
  const [addNote, setAddNote] = useState('')
  const [addLoading, setAddLoading] = useState(false)

  // Edit modal
  const [editTarget, setEditTarget] = useState<Supplier | null>(null)
  const [editData, setEditData] = useState({ name: '', phone: '', address: '', note: '' })
  const [editLoading, setEditLoading] = useState(false)

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const load = () => {
    setLoading(true)
    apiGet<Supplier[]>('/suppliers?include_inactive=true')
      .then(setSuppliers)
      .catch((e: Error) => setErr(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const flash = (msg: string) => {
    setOkMsg(msg)
    setTimeout(() => setOkMsg(null), 3000)
  }

  const doAdd = async (e: FormEvent) => {
    e.preventDefault()
    if (!addName.trim()) return
    setAddLoading(true)
    setErr(null)
    try {
      await apiPost<Supplier>('/suppliers', {
        name: addName.trim(),
        phone: addPhone.trim() || null,
        address: addAddress.trim() || null,
        note: addNote.trim() || null,
      })
      flash(`Đã thêm nhà cung cấp «${addName}».`)
      setAddName(''); setAddPhone(''); setAddAddress(''); setAddNote('')
      load()
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : String(ex))
    } finally {
      setAddLoading(false)
    }
  }

  const openEdit = (s: Supplier) => {
    setEditTarget(s)
    setEditData({ name: s.name, phone: s.phone ?? '', address: s.address ?? '', note: s.note ?? '' })
  }

  const doEdit = async (e: FormEvent) => {
    e.preventDefault()
    if (!editTarget) return
    setEditLoading(true)
    setErr(null)
    try {
      await apiPatch(`/suppliers/${editTarget.id}`, {
        name: editData.name.trim(),
        phone: editData.phone.trim() || null,
        address: editData.address.trim() || null,
        note: editData.note.trim() || null,
      })
      flash(`Đã cập nhật «${editTarget.name}».`)
      setEditTarget(null)
      load()
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : String(ex))
    } finally {
      setEditLoading(false)
    }
  }

  const doDelete = async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    try {
      await apiDelete(`/suppliers/${deleteTarget.id}`)
      flash(`Đã xóa «${deleteTarget.name}».`)
      setDeleteTarget(null)
      load()
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : String(ex))
    } finally {
      setDeleteLoading(false)
    }
  }

  const doRestore = async (s: Supplier) => {
    try {
      await apiPatch(`/suppliers/${s.id}`, { is_active: true })
      flash(`Đã khôi phục «${s.name}».`)
      load()
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : String(ex))
    }
  }

  const active = suppliers.filter(s => s.is_active)
  const inactive = suppliers.filter(s => !s.is_active)

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Nhà cung cấp</h1>
        <span className="text-sm text-zinc-500">{active.length} đang hoạt động</span>
      </div>

      {okMsg && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
          ✓ {okMsg}
        </div>
      )}
      {err && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300">
          ✗ {err}
        </div>
      )}

      {/* ─── Add Form ─────────────────────────────────────────────────── */}
      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900">
        <h2 className="mb-4 text-base font-semibold text-zinc-800 dark:text-zinc-100">Thêm nhà cung cấp mới</h2>
        <form onSubmit={doAdd} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-1 text-sm">
            <span>Tên NCC <span className="text-red-500">*</span></span>
            <input
              required
              value={addName}
              onChange={e => setAddName(e.target.value)}
              placeholder="VD: Công ty Dược ABC"
              className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Số điện thoại
            <input
              value={addPhone}
              onChange={e => setAddPhone(e.target.value)}
              placeholder="0901..."
              className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Địa chỉ
            <input
              value={addAddress}
              onChange={e => setAddAddress(e.target.value)}
              placeholder="Địa chỉ liên hệ"
              className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Ghi chú
            <input
              value={addNote}
              onChange={e => setAddNote(e.target.value)}
              placeholder="Điều kiện thanh toán..."
              className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800"
            />
          </label>
          <div className="flex items-end sm:col-span-2 lg:col-span-4">
            <button
              type="submit"
              disabled={addLoading}
              className="rounded-lg bg-emerald-600 px-6 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {addLoading ? 'Đang thêm...' : '+ Thêm nhà cung cấp'}
            </button>
          </div>
        </form>
      </section>

      {/* ─── Active List ─────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-zinc-800 dark:text-zinc-100">Danh sách nhà cung cấp ({active.length})</h2>
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-700">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-zinc-100 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-3">Tên nhà cung cấp</th>
                <th className="px-4 py-3">Điện thoại</th>
                <th className="px-4 py-3">Địa chỉ</th>
                <th className="px-4 py-3">Ghi chú</th>
                <th className="px-4 py-3 text-center">Ngày tạo</th>
                <th className="px-4 py-3 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-zinc-400">Đang tải...</td>
                </tr>
              ) : active.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-zinc-400">Chưa có nhà cung cấp nào.</td>
                </tr>
              ) : (
                active.map(s => (
                  <tr key={s.id} className="border-t border-zinc-200 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800/40">
                    <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">{s.name}</td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{s.phone || '—'}</td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{s.address || '—'}</td>
                    <td className="px-4 py-3 text-zinc-500 dark:text-zinc-500 text-xs max-w-[200px] truncate" title={s.note ?? ''}>{s.note || '—'}</td>
                    <td className="px-4 py-3 text-center text-zinc-500 text-xs">{fmt(s.created_at)}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(s)}
                          className="rounded px-3 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/30"
                        >
                          Sửa
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(s)}
                          className="rounded px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                        >
                          Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ─── Inactive List ─────────────────────────────────────────────── */}
      {inactive.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-zinc-500">Đã ngừng hợp tác ({inactive.length})</h2>
          <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-700 opacity-70">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-zinc-100 text-xs uppercase tracking-wide text-zinc-400 dark:bg-zinc-800">
                <tr>
                  <th className="px-4 py-3">Tên</th>
                  <th className="px-4 py-3">Điện thoại</th>
                  <th className="px-4 py-3">Địa chỉ</th>
                  <th className="px-4 py-3 text-center">Khôi phục</th>
                </tr>
              </thead>
              <tbody>
                {inactive.map(s => (
                  <tr key={s.id} className="border-t border-zinc-200 dark:border-zinc-700">
                    <td className="px-4 py-3 text-zinc-500 line-through">{s.name}</td>
                    <td className="px-4 py-3 text-zinc-400">{s.phone || '—'}</td>
                    <td className="px-4 py-3 text-zinc-400">{s.address || '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => doRestore(s)}
                        className="rounded px-3 py-1 text-xs font-medium text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                      >
                        Khôi phục
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ─── Edit Modal ─────────────────────────────────────────────────── */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setEditTarget(null)}>
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900" onClick={e => e.stopPropagation()}>
            <h3 className="mb-5 text-lg font-bold text-zinc-900 dark:text-zinc-100">Chỉnh sửa nhà cung cấp</h3>
            <form onSubmit={doEdit} className="space-y-4">
              <label className="flex flex-col gap-1 text-sm">
                Tên <span className="text-red-500">*</span>
                <input
                  required
                  className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800"
                  value={editData.name}
                  onChange={e => setEditData({ ...editData, name: e.target.value })}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Số điện thoại
                <input
                  className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800"
                  value={editData.phone}
                  onChange={e => setEditData({ ...editData, phone: e.target.value })}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Địa chỉ
                <input
                  className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800"
                  value={editData.address}
                  onChange={e => setEditData({ ...editData, address: e.target.value })}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Ghi chú
                <textarea
                  rows={2}
                  className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800"
                  value={editData.note}
                  onChange={e => setEditData({ ...editData, note: e.target.value })}
                />
              </label>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditTarget(null)}
                  className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {editLoading ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Delete Confirm ─────────────────────────────────────────────── */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Xác nhận xóa nhà cung cấp"
        message={deleteTarget
          ? `Xóa «${deleteTarget.name}»?\nNhà cung cấp sẽ bị ẩn khỏi danh sách nhập kho. Lịch sử nhập kho cũ vẫn được giữ nguyên.`
          : ''}
        confirmLabel={deleteLoading ? 'Đang xóa...' : 'Xác nhận xóa'}
        confirmVariant="danger"
        onConfirm={doDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
