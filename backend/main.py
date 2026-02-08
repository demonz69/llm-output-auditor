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

from scoring import (
    compute_consistency,
    compute_grade,
    compute_hallucination_risk,
)

load_dotenv()

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
    Run an audit: calls Claude API N times with 600ms gaps,
    streams per-run results via SSE, then sends the final report.
    """
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="ANTHROPIC_API_KEY not configured. Add it to your .env file.",
        )

    if request.runs < 1 or request.runs > 20:
        raise HTTPException(status_code=400, detail="Run count must be between 1 and 20.")

    async def event_stream():
        results = []

        for i in range(request.runs):
            if i > 0:
                await asyncio.sleep(0.6)  # 600ms gap between calls

            # Notify that a run is starting
            yield _sse_event({
                "type": "run_start",
                "run_number": i + 1,
                "total_runs": request.runs,
                "timestamp": _timestamp(),
            })

            run_result = await _call_claude(
                api_key=api_key,
                prompt=request.prompt,
                system_prompt=request.system_prompt,
                run_number=i + 1,
            )
            results.append(run_result)

            # Notify that a run completed
            yield _sse_event({
                "type": "run_complete",
                "run": run_result,
            })

        # ── Compute aggregate scores ──
        successful_responses = [
            r["response"] for r in results if r["status"] == "success"
        ]

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
            # Error runs already have risk fields set in _call_claude

        error_count = sum(1 for r in results if r["status"] == "error")
        high_risk_count = sum(
            1 for r in results if r.get("hallucination_risk") == "HIGH"
        )

        grade = compute_grade(error_count, high_risk_count, consistency_score)

        report = {
            "type": "audit_complete",
            "report": {
                "overall_grade": grade,
                "consistency_score": round(consistency_score, 2),
                "total_runs": request.runs,
                "successful_runs": len(successful_responses),
                "errors": error_count,
                "high_risk_runs": high_risk_count,
                "runs": results,
                "prompt": request.prompt,
                "system_prompt": request.system_prompt,
                "ground_truth": request.ground_truth,
                "timestamp": _timestamp(),
            },
        }

        yield _sse_event(report)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ── Claude API Caller ────────────────────────────────────────────────────

async def _call_claude(
    api_key: str,
    prompt: str,
    system_prompt: str,
    run_number: int,
) -> dict:
    """
    Call Claude API with streaming, accumulate text_delta chunks.
    Returns a result dict for this run.
    """
    start = time.time()

    try:
        headers = {
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }

        body: dict = {
            "model": "claude-sonnet-4-20250514",
            "max_tokens": 1024,
            "stream": True,
            "messages": [{"role": "user", "content": prompt}],
        }

        if system_prompt.strip():
            body["system"] = system_prompt

        full_response = ""

        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream(
                "POST",
                "https://api.anthropic.com/v1/messages",
                headers=headers,
                json=body,
            ) as resp:
                if resp.status_code != 200:
                    error_body = await resp.aread()
                    raise Exception(
                        f"Claude API returned {resp.status_code}: "
                        f"{error_body.decode('utf-8', errors='replace')}"
                    )

                async for line in resp.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    data = line[6:]
                    if data == "[DONE]":
                        break
                    try:
                        event = json.loads(data)
                        if event.get("type") == "content_block_delta":
                            delta = event.get("delta", {})
                            if delta.get("type") == "text_delta":
                                full_response += delta.get("text", "")
                    except json.JSONDecodeError:
                        continue

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
