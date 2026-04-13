from fastapi import APIRouter, Depends, HTTPException

from app.db.session import get_db
from app.models import StockAdjustment
from app.schemas.stock import StockAdjustmentCreate, StockAdjustmentOut
from app.services import stock_adjust as stock_svc

router = APIRouter()


@router.post("/adjust", response_model=StockAdjustmentOut, status_code=201)
def stock_adjust(body: StockAdjustmentCreate, db=Depends(get_db)) -> StockAdjustment:
    try:
        return stock_svc.apply_stock_take(db, body.batch_id, body.actual_quantity)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
