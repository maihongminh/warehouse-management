from fastapi import APIRouter

from app.api import import_receipts, inventory, products, reports, returns, sales, stock

api_router = APIRouter()
api_router.include_router(products.router, prefix="/products", tags=["products"])
api_router.include_router(import_receipts.router, prefix="/import-receipts", tags=["import"])
api_router.include_router(sales.router, prefix="/sales", tags=["sales"])
api_router.include_router(stock.router, prefix="/stock", tags=["stock"])
api_router.include_router(returns.router, prefix="/returns", tags=["returns"])
api_router.include_router(inventory.router, prefix="/inventory", tags=["inventory"])
api_router.include_router(reports.router, prefix="/reports", tags=["reports"])
