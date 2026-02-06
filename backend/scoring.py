"""
Scoring module for LLM Output Auditor.
Handles consistency scoring, hallucination risk detection, and overall grading.
"""

import re
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


def compute_consistency(responses: list[str]) -> float:
    """
    Compute pairwise cosine similarity across all responses using TF-IDF vectors.
    Returns a percentage score (0-100).
    """
    if len(responses) < 2:
        return 100.0

    vectorizer = TfidfVectorizer(stop_words="english")
    tfidf_matrix = vectorizer.fit_transform(responses)

    sim_matrix = cosine_similarity(tfidf_matrix)

    # Extract upper triangle (excluding diagonal)
    n = len(responses)
    pairs = []
    for i in range(n):
        for j in range(i + 1, n):
            pairs.append(sim_matrix[i][j])

    return round(float(np.mean(pairs)) * 100, 2) if pairs else 100.0


STOP_WORDS = frozenset([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for',
    'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
    'before', 'after', 'above', 'below', 'between', 'out', 'off', 'over',
    'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when',
    'where', 'why', 'how', 'all', 'both', 'each', 'few', 'more', 'most',
    'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same',
    'so', 'than', 'too', 'very', 'just', 'because', 'but', 'and', 'or',
    'if', 'while', 'about', 'up', 'its', 'it', 'this', 'that', 'these',
    'those', 'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'him',
    'his', 'she', 'her', 'they', 'them', 'their', 'what', 'which', 'who',
    'also', 'well', 'like', 'even', 'back', 'much', 'get', 'got', 'use',
    'used', 'using', 'make', 'made', 'take', 'one', 'two', 'new', 'know',
])


def extract_key_claims(text: str) -> list[str]:
    """Extract key claims/keywords from ground truth text."""
    words = re.findall(r'\b[a-zA-Z0-9]+\b', text.lower())
    claims = [w for w in words if w not in STOP_WORDS and len(w) > 2]
    return list(set(claims))


def compute_hallucination_risk(response: str, ground_truth: str) -> dict:
    """
    Check hallucination risk by measuring keyword coverage.
    Extracts key claims from ground truth, checks how many appear in the response.
    """
    claims = extract_key_claims(ground_truth)

    if not claims:
        return {
            "risk_level": "LOW",
            "keyword_coverage": 1.0,
            "flagged_claims": [],
        }

    response_lower = response.lower()
    covered = []
    flagged = []

    for claim in claims:
        if claim in response_lower:
            covered.append(claim)
        else:
            flagged.append(claim)

    coverage = len(covered) / len(claims) if claims else 1.0

    if coverage >= 0.7:
        risk_level = "LOW"
    elif coverage >= 0.4:
        risk_level = "MEDIUM"
    else:
        risk_level = "HIGH"

    return {
        "risk_level": risk_level,
        "keyword_coverage": round(coverage, 2),
        "flagged_claims": flagged,
    }


def compute_grade(error_count: int, high_risk_count: int, consistency_score: float) -> str:
    """
    Grading logic:
    PASS: zero errors, zero high-risk runs, consistency > 75%
    WARN: ≤1 failure total (error or high-risk), consistency > 50%
    FAIL: anything else
    Errors count as failures — a run that errored is NOT a pass.
    """
    total_failures = error_count + high_risk_count

    if total_failures == 0 and consistency_score > 75:
        return "PASS"
    elif total_failures <= 1 and consistency_score > 50:
        return "WARN"
    else:
        return "FAIL"
