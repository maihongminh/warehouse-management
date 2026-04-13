from fastapi import APIRouter, Depends, HTTPException

from app.db.session import get_db
from app.schemas.batch import BatchOut
from app.schemas.return_stock import CustomerReturnIn
from app.services import customer_return as ret_svc

router = APIRouter()


@router.post("/customer", response_model=BatchOut)
def customer_return(body: CustomerReturnIn, db=Depends(get_db)):
    try:
        return ret_svc.return_stock_to_batch(
            db,
            batch_id=body.batch_id,
            quantity=body.quantity,
            ref_id=body.ref_sale_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
