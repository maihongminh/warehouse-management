export type Product = {
  id: number
  name: string
  sku: string
  unit: string
  default_import_price: string
  default_sale_price: string
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
    batch_id: number | null
    quantity: number
    sale_price: string
    import_price_snapshot: string | null
  }[]
}
