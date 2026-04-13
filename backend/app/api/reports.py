from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query

from app.db.session import get_db
from app.schemas.report import DashboardOut, PeriodSummaryOut
from app.services import reports as reports_svc

router = APIRouter()


@router.get("/dashboard", response_model=DashboardOut)
def dashboard(db=Depends(get_db), on_date: date | None = Query(None, alias="date")):
    data = reports_svc.dashboard(db, today=on_date)
    return data


@router.get("/period", response_model=PeriodSummaryOut)
def period_summary(
    db=Depends(get_db),
    date_from: date = Query(..., description="Từ ngày (inclusive)"),
    date_to: date = Query(..., description="Đến ngày (inclusive)"),
):
    if date_from > date_to:
        raise HTTPException(status_code=400, detail="date_from must be <= date_to")
    return reports_svc.period_summary(db, date_from, date_to)
