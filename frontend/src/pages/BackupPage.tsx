import { useCallback, useEffect, useState } from 'react'
import { apiGet, apiPost } from '../api'

type BackupFile = {
  name: string
  size_bytes: number
  created_at: string
}

type BackupInfo = {
  db_path: string | null
  backup_dir: string
  backups: BackupFile[]
}

type ScheduleConfig = {
  enabled: boolean
  interval: 'daily' | 'weekly' | 'monthly' | 'quarterly'
  keep_count: number
}

const INTERVAL_LABELS: Record<string, string> = {
  daily: 'Hàng ngày',
  weekly: 'Hàng tuần',
  monthly: 'Hàng tháng',
  quarterly: 'Hàng quý',
}

function fmtBytes(b: number): string {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1024 / 1024).toFixed(2)} MB`
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('vi-VN')
  } catch {
    return iso
  }
}

export default function BackupPage() {
  const [info, setInfo] = useState<BackupInfo | null>(null)
  const [infoLoading, setInfoLoading] = useState(false)
  const [infoErr, setInfoErr] = useState<string | null>(null)

  const [backupLoading, setBackupLoading] = useState(false)
  const [backupMsg, setBackupMsg] = useState<string | null>(null)
  const [backupErr, setBackupErr] = useState<string | null>(null)

  const [restoreTarget, setRestoreTarget] = useState<string | null>(null)
  const [restoreLoading, setRestoreLoading] = useState(false)
  const [restoreMsg, setRestoreMsg] = useState<string | null>(null)
  const [restoreErr, setRestoreErr] = useState<string | null>(null)

  const [schedule, setSchedule] = useState<ScheduleConfig>({
    enabled: false,
    interval: 'daily',
    keep_count: 30,
  })
  const [scheduleLoading, setScheduleLoading] = useState(false)
  const [scheduleSaveLoading, setScheduleSaveLoading] = useState(false)
  const [scheduleMsg, setScheduleMsg] = useState<string | null>(null)
  
  const [wipeConfirm, setWipeConfirm] = useState('')
  const [wipeLoading, setWipeLoading] = useState(false)
  const [wipeMsg, setWipeMsg] = useState<string | null>(null)
  const [wipeErr, setWipeErr] = useState<string | null>(null)
  const [showWipe, setShowWipe] = useState(false)

  // Security Settings states
  const [oldKey, setOldKey] = useState('')
  const [newKey, setNewKey] = useState('')
  const [confirmNewKey, setConfirmNewKey] = useState('')
  const [keyMsg, setKeyMsg] = useState<string | null>(null)

  const handleUpdateKey = () => {
    setKeyMsg(null)
    const currentKey = localStorage.getItem('wm_app_key') || ''
    
    if (oldKey !== currentKey) {
      setKeyMsg('Mã khóa hiện tại không chính xác.')
      return
    }
    if (!newKey) {
      setKeyMsg('Vui lòng nhập mã khóa mới.')
      return
    }
    if (newKey !== confirmNewKey) {
      setKeyMsg('Xác nhận mã mới không khớp.')
      return
    }

    localStorage.setItem('wm_app_key', newKey)
    setKeyMsg('✅ Đã cập nhật mã khóa mới.')
    setOldKey('')
    setNewKey('')
    setConfirmNewKey('')
  }

  const loadInfo = useCallback(() => {
    setInfoLoading(true)
    setInfoErr(null)
    apiGet<BackupInfo>('/backup/info')
      .then(setInfo)
      .catch((e: Error) => setInfoErr(e.message))
      .finally(() => setInfoLoading(false))
  }, [])

  const loadSchedule = useCallback(() => {
    setScheduleLoading(true)
    apiGet<ScheduleConfig>('/backup/schedule')
      .then(setSchedule)
      .catch(() => {})
      .finally(() => setScheduleLoading(false))
  }, [])

  useEffect(() => {
    loadInfo()
    loadSchedule()
  }, [loadInfo, loadSchedule])

  const doBackup = async () => {
    setBackupMsg(null)
    setBackupErr(null)
    setBackupLoading(true)
    try {
      const res = await apiPost<{ filename: string; message: string }>('/backup/now', {})
      setBackupMsg(res.message)
      loadInfo()
    } catch (e: unknown) {
      setBackupErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBackupLoading(false)
    }
  }

  const doRestore = async (filename: string) => {
    setRestoreMsg(null)
    setRestoreErr(null)
    setRestoreLoading(true)
    try {
      const res = await apiPost<{ message: string }>('/backup/restore', { filename })
      setRestoreMsg(res.message)
      setRestoreTarget(null)
    } catch (e: unknown) {
      setRestoreErr(e instanceof Error ? e.message : String(e))
    } finally {
      setRestoreLoading(false)
    }
  }

  const saveSchedule = async () => {
    setScheduleMsg(null)
    setScheduleSaveLoading(true)
    try {
      await apiPost<ScheduleConfig>('/backup/schedule', schedule)
      setScheduleMsg('✅ Đã lưu cấu hình lịch backup.')
    } catch (e: unknown) {
      setScheduleMsg(e instanceof Error ? e.message : String(e))
    } finally {
      setScheduleSaveLoading(false)
    }
  }

  const doClearData = async () => {
    if (wipeConfirm.trim().toLowerCase() !== 'đồng ý') {
      setWipeErr('Vui lòng nhập chính xác cụm từ "Đồng Ý"')
      return
    }
    setWipeMsg(null)
    setWipeErr(null)
    setWipeLoading(true)
    try {
      const res = await apiPost<{ message: string }>('/backup/clear-data', {})
      setWipeMsg(res.message)
      setWipeConfirm('')
      setShowWipe(false)
      loadInfo()
    } catch (e: unknown) {
      setWipeErr(e instanceof Error ? e.message : String(e))
    } finally {
      setWipeLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold text-zinc-800 dark:text-zinc-100">💾 Backup & Cài đặt</h1>
      </div>

      {/* DB Info */}
      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900 space-y-3">
        <h2 className="font-medium text-zinc-800 dark:text-zinc-100">Thông tin Database</h2>
        {infoLoading && <p className="text-sm text-zinc-400">Đang tải...</p>}
        {infoErr && <p className="text-sm text-red-600">{infoErr}</p>}
        {info && (
          <div className="space-y-1 text-sm">
            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
              <span className="text-zinc-500">File DB:</span>
              <span className="break-all font-mono text-xs text-zinc-700 dark:text-zinc-300">
                {info.db_path ?? '(Không phải SQLite)'}
              </span>
              <span className="text-zinc-500">Thư mục backup:</span>
              <span className="break-all font-mono text-xs text-zinc-700 dark:text-zinc-300">
                {info.backup_dir}
              </span>
            </div>
          </div>
        )}
      </section>

      {/* Manual Backup */}
      <section className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-5 dark:border-emerald-800 dark:bg-emerald-950/20 space-y-3">
        <h2 className="font-medium text-emerald-900 dark:text-emerald-200">Backup thủ công</h2>
        <p className="text-sm text-emerald-800 dark:text-emerald-400">
          Tạo bản sao file database ngay lập tức vào thư mục backup.
        </p>
        {backupMsg && (
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">{backupMsg}</p>
        )}
        {backupErr && <p className="text-sm text-red-600">{backupErr}</p>}
        <button
          type="button"
          disabled={backupLoading}
          onClick={doBackup}
          className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {backupLoading ? 'Đang tạo backup...' : '💾 Backup ngay'}
        </button>
      </section>

      {/* Backup List */}
      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-medium text-zinc-800 dark:text-zinc-100">
            Danh sách backup ({info?.backups.length ?? 0})
          </h2>
          <button
            type="button"
            onClick={loadInfo}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            ↻ Tải lại
          </button>
        </div>

        {restoreMsg && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
            {restoreMsg}
          </div>
        )}
        {restoreErr && <p className="text-sm text-red-600">{restoreErr}</p>}

        {!info || info.backups.length === 0 ? (
          <p className="text-sm text-zinc-400">Chưa có file backup nào.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                <tr>
                  <th className="px-3 py-2">Tên file</th>
                  <th className="px-3 py-2 text-right">Kích thước</th>
                  <th className="px-3 py-2">Thời gian</th>
                  <th className="px-3 py-2 text-center">Khôi phục</th>
                </tr>
              </thead>
              <tbody>
                {info.backups.map((f) => (
                  <tr key={f.name} className="border-t border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                    <td className="px-3 py-2 font-mono text-xs text-zinc-700 dark:text-zinc-300">{f.name}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-zinc-600 dark:text-zinc-400">
                      {fmtBytes(f.size_bytes)}
                    </td>
                    <td className="px-3 py-2 text-zinc-500">{fmtDate(f.created_at)}</td>
                    <td className="px-3 py-2 text-center">
                      {restoreTarget === f.name ? (
                        <div className="flex items-center justify-center gap-2">
                          <span className="text-xs text-amber-700 dark:text-amber-400">Chắc chắn?</span>
                          <button
                            type="button"
                            onClick={() => doRestore(f.name)}
                            disabled={restoreLoading}
                            className="rounded bg-amber-600 px-2 py-0.5 text-xs text-white hover:bg-amber-700 disabled:opacity-60"
                          >
                            {restoreLoading ? '...' : 'Khôi phục'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setRestoreTarget(null)}
                            className="rounded border border-zinc-300 px-2 py-0.5 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300"
                          >
                            Hủy
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => { setRestoreMsg(null); setRestoreErr(null); setRestoreTarget(f.name) }}
                          className="rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                        >
                          ↩ Restore
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Schedule */}
      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900 space-y-4">
        <h2 className="font-medium text-zinc-800 dark:text-zinc-100">Lịch backup tự động</h2>
        <p className="text-sm text-zinc-500">
          Cấu hình sẽ được lưu vào file JSON cùng thư mục backup và áp dụng khi backend khởi động.
        </p>
        {scheduleLoading && <p className="text-sm text-zinc-400">Đang tải cấu hình...</p>}

        <div className="space-y-3">
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 rounded accent-emerald-600"
              checked={schedule.enabled}
              onChange={(e) => setSchedule((s) => ({ ...s, enabled: e.target.checked }))}
            />
            <span className="font-medium text-zinc-800 dark:text-zinc-100">Bật backup tự động</span>
          </label>

          {schedule.enabled && (
            <div className="grid gap-3 sm:grid-cols-2 pl-7">
              <label className="flex flex-col gap-1 text-sm">
                Tần suất
                <select
                  className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800"
                  value={schedule.interval}
                  onChange={(e) =>
                    setSchedule((s) => ({
                      ...s,
                      interval: e.target.value as ScheduleConfig['interval'],
                    }))
                  }
                >
                  {Object.entries(INTERVAL_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Số bản giữ lại
                <input
                  type="number"
                  min={1}
                  max={365}
                  className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800"
                  value={schedule.keep_count}
                  onChange={(e) =>
                    setSchedule((s) => ({
                      ...s,
                      keep_count: Math.max(1, Number(e.target.value) || 1),
                    }))
                  }
                />
              </label>
            </div>
          )}
        </div>

        {scheduleMsg && (
          <p className={`text-sm ${scheduleMsg.startsWith('✅') ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600'}`}>
            {scheduleMsg}
          </p>
        )}

        <button
          type="button"
          disabled={scheduleSaveLoading}
          onClick={saveSchedule}
          className="rounded-lg bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 disabled:opacity-60"
        >
          {scheduleSaveLoading ? 'Đang lưu...' : 'Lưu cài đặt'}
        </button>
      </section>

      {/* Security Settings */}
      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900 space-y-4">
        <h2 className="font-medium text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
          <span>🔑 Cài đặt bảo mật</span>
        </h2>
        <p className="text-sm text-zinc-500">
          Thay đổi mã khóa truy cập ứng dụng. Hãy lưu ý ghi nhớ mã mới sau khi đổi.
        </p>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm text-zinc-600 dark:text-zinc-400">
            Mã cũ
            <input
              type="password"
              className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
              placeholder="••••"
              value={oldKey}
              onChange={(e) => setOldKey(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-zinc-600 dark:text-zinc-400">
            Mã mới
            <input
              type="password"
              className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
              placeholder="••••"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-zinc-600 dark:text-zinc-400">
            Xác nhận mã mới
            <input
              type="password"
              className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
              placeholder="••••"
              value={confirmNewKey}
              onChange={(e) => setConfirmNewKey(e.target.value)}
            />
          </label>
        </div>

        {keyMsg && (
          <p className={`text-sm ${keyMsg.startsWith('✅') ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600'}`}>
            {keyMsg}
          </p>
        )}

        <button
          type="button"
          onClick={handleUpdateKey}
          className="rounded-lg bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Cập nhật mã khóa
        </button>
      </section>

      {/* Dangerous Area */}
      <section className="rounded-xl border border-red-200 bg-red-50/40 p-5 dark:border-red-900/50 dark:bg-red-950/10 space-y-4">
        <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
          <span className="text-xl">⚠️</span>
          <h2 className="font-bold">Khu vực nguy hiểm</h2>
        </div>
        
        {!showWipe ? (
          <div className="space-y-3">
            <p className="text-sm text-red-800 dark:text-red-300">
              Xóa toàn bộ dữ liệu nghiệp vụ: Sản phẩm, Nhà cung cấp, Hóa đơn và Kho hàng. 
              <strong> Hành động này không thể hoàn tác.</strong>
            </p>
            <button
              type="button"
              onClick={() => setShowWipe(true)}
              className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:bg-zinc-900 dark:text-red-400 dark:hover:bg-red-950/20"
            >
              Xóa tất cả dữ liệu
            </button>
          </div>
        ) : (
          <div className="space-y-4 rounded-lg bg-white p-4 shadow-sm dark:bg-zinc-900">
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              Để xác nhận xóa toàn bộ dữ liệu, vui lòng nhập cụm từ <span className="font-bold text-red-600">Đồng Ý</span> vào ô bên dưới:
            </p>
            
            <input
              autoFocus
              className="w-full rounded-lg border border-red-300 px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 dark:border-red-800 dark:bg-zinc-800"
              placeholder="Nhập 'Đồng Ý'..."
              value={wipeConfirm}
              onChange={(e) => setWipeConfirm(e.target.value)}
            />
            
            {wipeErr && <p className="text-xs text-red-600">{wipeErr}</p>}
            
            <div className="flex gap-2">
              <button
                type="button"
                disabled={wipeLoading || wipeConfirm.trim().toLowerCase() !== 'đồng ý'}
                onClick={doClearData}
                className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {wipeLoading ? 'Đang thực hiện...' : 'XÁC NHẬN XÓA SẠCH'}
              </button>
              <button
                type="button"
                onClick={() => { setShowWipe(false); setWipeConfirm(''); setWipeErr(null); }}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400"
              >
                Hủy
              </button>
            </div>
          </div>
        )}

        {wipeMsg && (
          <p className="rounded-lg bg-emerald-100 p-3 text-sm font-medium text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
            {wipeMsg}
          </p>
        )}
      </section>
    </div>
  )
}
