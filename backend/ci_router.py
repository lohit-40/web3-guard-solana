from fastapi import APIRouter, Header, HTTPException, Depends
from pydantic import BaseModel
from google import genai
import os
import json

ci_router = APIRouter()

class PRScanRequest(BaseModel):
    files: dict[str, str] # filename -> content
    ecosystem: str = "Rust" # Rust or Solidity

# Load the base API config
def get_gemini_client():
    raw_keys = os.getenv("GEMINI_API_KEY", "")
    keys = [k.strip() for k in raw_keys.split(",") if k.strip()]
    if not keys:
        raise HTTPException(status_code=500, detail="Gemini API Key missing")
    return genai.Client(api_key=keys[0])

@ci_router.post("/scan_pr")
async def scan_pull_request(payload: PRScanRequest, x_api_key: str = Header(None)):
    if x_api_key != "WEB3GUARD_HACKATHON_DEMO" and x_api_key != os.getenv("CI_API_KEY"):
        raise HTTPException(status_code=401, detail="Invalid or Missing API Key. Use WEB3GUARD_HACKATHON_DEMO for testing.")
    
    if not payload.files:
        return {"report": "No valid smart contract files found in this PR."}

    # Format the payload for the prompt
    code_context = ""
    for filename, code in payload.files.items():
        code_context += f"## File: {filename}\n```\n{code}\n```\n\n"

    system_instruction = f"""
You are the Web3 Guard CI/CD GitHub Bot. 
You are analyzing a Pull Request containing {payload.ecosystem} smart contracts.
Identify any security vulnerabilities (Reentrancy, Integer Overflows, Unsafe CPIs, Account Substitution, etc).
Return your response precisely formatted as a Markdown GitHub PR Comment.
Use emojis, bold syntax, and clear severity headers (Critical, High, Medium, Low).
If no vulnerabilities exist, return an enthusiastic congratulatory message stating 'Web3 Guard: All Clear! \u2705'.
Do NOT wrap your response in a generic JSON block unless necessary, return pure markdown text.
    """

    client = get_gemini_client()
    try:
        response = client.models.generate_content(
            model='gemini-2.0-flash',
            contents=code_context,
            config=genai.types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0.1
            )
        )
        return {"report": response.text.strip()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
