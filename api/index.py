"""
LLM Output Auditor — FastAPI Backend
Stress-tests LLM prompts by running them N times, scoring consistency
and hallucination risk, then generating a structured QA report.
"""

import asyncio
import json
import os
import time

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from starlette.responses import StreamingResponse

from api.scoring import (
    compute_consistency,
    compute_grade,
    compute_hallucination_risk,
)

dotenv_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
load_dotenv(dotenv_path)

app = FastAPI(
    title="LLM Output Auditor",
    description="Stress-test LLM prompts and score outputs for consistency and hallucination risk.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request / Response Models ────────────────────────────────────────────

class AuditRequest(BaseModel):
    prompt: str
    system_prompt: str = ""
    ground_truth: str = ""
    runs: int = 5


# ── Endpoints ────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "ok", "service": "llm-output-auditor"}


@app.post("/run-audit")
async def run_audit(request: AuditRequest):
    """
    Run an audit: calls Groq API concurrently to fit within Vercel's 10s limit,
    and returns a single JSON report.
    """
    api_key = os.getenv("GROQ_API_KEY")

    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="GROQ_API_KEY not configured. Add it to your .env file.",
        )

    if request.runs < 1 or request.runs > 20:
        raise HTTPException(status_code=400, detail="Run count must be between 1 and 20.")

    async def run_task(i):
        # Slight stagger to avoid rate limits
        await asyncio.sleep(i * 0.2)
        return await _call_groq(
            api_key=api_key,
            prompt=request.prompt,
            system_prompt=request.system_prompt,
            run_number=i + 1,
        )

    # Run all calls concurrently
    results = await asyncio.gather(*(run_task(i) for i in range(request.runs)))

    # Compute aggregate scores
    successful_responses = [r["response"] for r in results if r["status"] == "success"]

    consistency_score = (
        compute_consistency(successful_responses)
        if len(successful_responses) >= 2
        else (100.0 if successful_responses else 0.0)
    )

    # Compute hallucination risk per run
    for r in results:
        if r["status"] == "success" and request.ground_truth.strip():
            risk = compute_hallucination_risk(r["response"], request.ground_truth)
            r["hallucination_risk"] = risk["risk_level"]
            r["flagged_claims"] = risk["flagged_claims"]
            r["keyword_coverage"] = risk["keyword_coverage"]
        elif r["status"] == "success":
            r["hallucination_risk"] = "N/A"
            r["flagged_claims"] = []
            r["keyword_coverage"] = 1.0

    error_count = sum(1 for r in results if r["status"] == "error")
    high_risk_count = sum(1 for r in results if r.get("hallucination_risk") == "HIGH")

    grade = compute_grade(error_count, high_risk_count, consistency_score)

    return {
        "overall_grade": grade,
        "consistency_score": round(consistency_score, 2),
        "total_runs": request.runs,
        "successful_runs": len(successful_responses),
        "errors": error_count,
        "high_risk_runs": high_risk_count,
        "runs": sorted(results, key=lambda x: x["run_number"]),
        "prompt": request.prompt,
        "system_prompt": request.system_prompt,
        "ground_truth": request.ground_truth,
        "timestamp": _timestamp(),
    }


# ── Groq API Caller ────────────────────────────────────────────────────

async def _call_groq(
    api_key: str,
    prompt: str,
    system_prompt: str,
    run_number: int,
) -> dict:
    """
    Call Groq API.
    Returns a result dict for this run.
    """
    start = time.time()

    try:
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

        messages = []
        if system_prompt.strip():
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        body: dict = {
            "model": "llama-3.3-70b-versatile",
            "messages": messages,
        }

        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers=headers,
                json=body,
            )
            if resp.status_code != 200:
                raise Exception(
                    f"Groq API returned {resp.status_code}: {resp.text}"
                )
            
            data = resp.json()
            full_response = data["choices"][0]["message"]["content"]

        latency = round(time.time() - start, 2)

        return {
            "run_number": run_number,
            "status": "success",
            "response": full_response,
            "response_preview": full_response[:500],
            "word_count": len(full_response.split()),
            "latency_s": latency,
            "timestamp": _timestamp(),
        }

    except Exception as exc:
        latency = round(time.time() - start, 2)
        return {
            "run_number": run_number,
            "status": "error",
            "response": "",
            "response_preview": "",
            "error": str(exc),
            "word_count": 0,
            "latency_s": latency,
            "hallucination_risk": "N/A",
            "flagged_claims": [],
            "keyword_coverage": 0,
            "timestamp": _timestamp(),
        }


# ── Utilities ─────────────────────────────────────────────────────────────

def _sse_event(data: dict) -> str:
    """Format a dict as an SSE data line."""
    return f"data: {json.dumps(data)}\n\n"


def _timestamp() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
