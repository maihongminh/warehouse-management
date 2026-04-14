const base = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000/api'

async function parseError(res: Response): Promise<string> {
  try {
    const j = await res.json()
    if (j.detail) {
      if (typeof j.detail === 'string') return j.detail
      if (Array.isArray(j.detail)) return j.detail.map((x: { msg?: string }) => x.msg ?? JSON.stringify(x)).join(', ')
    }
    return JSON.stringify(j)
  } catch {
    return res.statusText
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${base}${path}`)
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<T>
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<T>
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<T>
}

export async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    body: formData,
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<T>
}

export async function apiGetBlob(path: string): Promise<Blob> {
  const res = await fetch(`${base}${path}`)
  if (!res.ok) throw new Error(await parseError(res))
  return res.blob()
}

export async function apiDelete(path: string): Promise<void> {
  const res = await fetch(`${base}${path}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await parseError(res))
}

export { base as apiBase }
