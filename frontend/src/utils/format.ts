/**
 * Định dạng tiền tệ/doanh thu (Làm tròn tối đa 3 chữ số thập phân)
 */
export function fCurrency(val: number | string | undefined | null): string {
  if (val === undefined || val === null) return '0'
  const n = typeof val === 'string' ? parseFloat(val) : val
  if (isNaN(n)) return '0'
  
  return new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(n)
}

/**
 * Định dạng số lượng (Giữ nguyên định dạng số tự nhiên)
 */
export function fQty(val: number | string | undefined | null): string {
  if (val === undefined || val === null) return '0'
  const n = typeof val === 'string' ? parseFloat(val) : val
  if (isNaN(n)) return '0'
  
  return new Intl.NumberFormat('vi-VN').format(n)
}

// Giữ lại fNum như một bí danh cho fQty hoặc fCurrency tùy ngữ cảnh, 
// nhưng khuyến khích dùng fCurrency cho tiền.
export const fNum = fQty
