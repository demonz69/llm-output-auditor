# LLM Output Auditor

A developer tool that stress-tests LLM prompts by running them multiple times, then scores the outputs for consistency, hallucination risk against a ground truth, and generates a structured QA report.

## Why it matters for AI QA work
When building LLM applications, a prompt that works once might fail unpredictably. This tool automates the process of testing prompt reliability by:
1. **Measuring Consistency**: Uses TF-IDF cosine similarity across multiple runs to ensure the model isn't giving wildly different answers.
2. **Detecting Hallucinations**: Extracts key claims from a provided "ground truth" and checks if the LLM covered them, flagging responses with missing facts.
3. **Structured Reporting**: Generates a PASS/WARN/FAIL grade and detailed JSON exports for CI/CD or QA logs.

## Setup Instructions

### 1. Backend (FastAPI)

```bash
cd backend
python -m venv venv
# Windows: venv\Scripts\activate
# Unix: source venv/bin/activate

pip install -r requirements.txt

# Create .env and add your Anthropic API Key
cp .env.example .env
# Edit .env with your key

# Run the server
uvicorn main:app --reload --port 8000
```

### 2. Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at `http://localhost:5173`.

## How to run a sample audit
1. Open the UI at `http://localhost:5173`.
2. Click **Load Sample** in the Setup tab.
3. Select your desired number of runs (e.g., 5x).
4. Click **Run Audit**.
5. Watch the real-time logs in the Run Log tab.
6. Once complete, view the detailed scores in the Report tab.

## Deployment Targets
- **Frontend**: Designed for deployment on Vercel. Connect the repository, set the framework to Vite, and set the build command to `npm run build`. Set the `VITE_API_URL` environment variable to your backend URL.
- **Backend**: Designed for Railway or Render. Use the included `Dockerfile`. Provide the `ANTHROPIC_API_KEY` as an environment variable.

---
*Developed for a full-stack engineering portfolio highlighting agentic UI creation, FastAPI backend integrations, and LLM auditing.*
