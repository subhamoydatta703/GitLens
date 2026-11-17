import os

import httpx
from dotenv import load_dotenv
from fastapi import HTTPException

load_dotenv()

MODEL = "nvidia/nemotron-3.5-super-vl:free"
URL = "https://openrouter.ai/api/v1/chat/completions"


async def generate_content(payload: str, system_instruction: str) -> str:
    api_key = os.environ.get("OPENROUTER_API_KEY", "").strip()
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="Set OPENROUTER_API_KEY in the backend environment before generating analysis.",
        )

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(180, connect=10)) as client:
            response = await client.post(
                URL,
                headers={"Authorization": f"Bearer {api_key}"},
                json={
                    "model": MODEL,
                    "messages": [
                        {"role": "system", "content": system_instruction},
                        {"role": "user", "content": payload},
                    ],
                    "max_tokens": 8192,
                    "temperature": 0.3,
                    "reasoning": {"enabled": False},
                },
            )
            response.raise_for_status()
            data = response.json()
            choice = data["choices"][0]
            text = choice["message"]["content"]
            finish_reason = choice["finish_reason"]
    except httpx.HTTPStatusError as error:
        raise HTTPException(
            status_code=error.response.status_code if error.response.status_code in {429, 503, 504} else 502,
            detail="OpenRouter could not complete the request.",
        ) from error
    except (httpx.RequestError, ValueError, KeyError, IndexError, TypeError) as error:
        raise HTTPException(
            status_code=502,
            detail="Could not get a valid response from OpenRouter.",
        ) from error

    if finish_reason != "stop":
        raise HTTPException(status_code=502, detail="OpenRouter did not complete the response.")

    if not isinstance(text, str) or not text.strip():
        raise HTTPException(status_code=502, detail="No content was returned by OpenRouter.")

    return text
