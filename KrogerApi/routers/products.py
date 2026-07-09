from fastapi import APIRouter, HTTPException, Query
import httpx
from auth import get_access_token

router = APIRouter(prefix="/products", tags=["products"])

KROGER_BASE = "https://api.kroger.com/v1"

@router.get("/search")
async def search_products(
    term: str = Query(..., description="Search term"),
    location_id: str = Query(None, description="Kroger location ID for pricing"),
    limit: int = Query(10, le=50)
):
    token = await get_access_token()
    params = {"filter.term": term, "filter.limit": limit}
    if location_id:
        params["filter.locationId"] = location_id

    async with httpx.AsyncClient() as client:
        res = await client.get(
            f"{KROGER_BASE}/products",
            headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
            params=params
        )
    
    if res.status_code != 200:
        raise HTTPException(status_code=res.status_code, detail=res.text)
    
    return res.json()


@router.get("/{product_id}")
async def get_product(product_id: str):
    token = await get_access_token()

    async with httpx.AsyncClient() as client:
        res = await client.get(
            f"{KROGER_BASE}/products/{product_id}",
            headers={"Authorization": f"Bearer {token}", "Accept": "application/json"}
        )

    if res.status_code != 200:
        raise HTTPException(status_code=res.status_code, detail=res.text)

    return res.json()