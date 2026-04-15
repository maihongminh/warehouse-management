export type Product = {
  id: number
  name: string
  sku: string
  unit: string
  default_import_price: string
  default_sale_price: string
  conversion_rate: number
  is_active: boolean
  created_at: string
}

export type Batch = {
  id: number
  product_id: number
  batch_code: string
  expiry_date: string
  import_price: string
  quantity_remaining: number
  created_at: string
}

export type ProductInventory = {
  id: number
  name: string
  sku: string
  unit: string
  default_import_price: string
  default_sale_price: string
  conversion_rate: number
  total_quantity: number
  batches: Batch[]
}

export type Dashboard = {
  revenue_today: string
  profit_today: string
  low_stock_count: number
  expiring_soon_count: number
}

export type SaleWithItems = {
  id: number
  date: string
  total_amount: string
  status: string
  created_by: string
  items: {
    id: number
    product_id: number
    product_name: string
    batch_id: number | null
    quantity: number
    sale_price: string
    import_price_snapshot: string | null
  }[]
}

export type ImportReceiptListItem = {
  id: number
  date: string
  created_by: string
  supplier: string | null
  is_debt: boolean
  total_amount: string
  item_count: number
}

export type ImportItemOut = {
  id: number
  product_id: number
  batch_id: number
  quantity: number
  import_price: string
  product_name: string
}

export type ImportReceiptOut = {
  id: number
  date: string
  created_by: string
  supplier: string | null
  is_debt: boolean
  total_amount: string
  items: ImportItemOut[]
}

export type PaginatedResponse<T> = {
  items: T[]
  total: number
  page: number
  size: number
  total_pages: number
}
