from fastapi import FastAPI
from routers.products import router as products_router

app = FastAPI(title="Kroger API Wrapper")

app.include_router(products_router)

@app.get("/")
def root():
    return {"message": "Kroger API is running"}