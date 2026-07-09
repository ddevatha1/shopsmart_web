import httpx
import base64
import os
from dotenv import load_dotenv

load_dotenv()

KROGER_TOKEN_URL = "https://api.kroger.com/v1/connect/oauth2/token"

async def get_access_token() -> str:
    client_id = os.getenv("KROGER_CLIENT_ID")
    client_secret = os.getenv("KROGER_CLIENT_SECRET")
    
    credentials = base64.b64encode(f"{client_id}:{client_secret}".encode()).decode()
    
    async with httpx.AsyncClient() as client:
        response = await client.post(
            KROGER_TOKEN_URL,
            headers={
                "Authorization": f"Basic {credentials}",
                "Content-Type": "application/x-www-form-urlencoded"
            },
            data={"grant_type": "client_credentials", "scope": "product.compact"}
        )
        response.raise_for_status()
        return response.json()["access_token"]