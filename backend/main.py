import os
import re
import json
import tempfile
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

# Load environment variables FIRST before importing NLP engine
load_dotenv(dotenv_path=Path(__file__).parent / ".env")

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from openai import OpenAI
import pdfplumber
from database import db
from nlp_engine import nlp_engine
from ml_models import ItemResponseTheory, BayesianKnowledgeTracing, DifficultyAdaptor, LearningPathRecommender
from adaptive_integration import AdaptiveIntegration

OPENAI_API_KEY   = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL     = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
HOST             = os.getenv("HOST", "0.0.0.0")
PORT             = int(os.getenv("PORT", "8000"))
MAX_UPLOAD_MB    = int(os.getenv("MAX_UPLOAD_MB", "10"))
MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024

_raw_origins = os.getenv("ALLOWED_ORIGINS", "*")
ALLOWED_ORIGINS = ["*"] if _raw_origins.strip() == "*" else [o.strip() for o in _raw_origins.split(",")]

if not OPENAI_API_KEY or OPENAI_API_KEY == "your_openai_api_key_here":
    raise RuntimeError("\n\nOPENAI_API_KEY is not set. Open backend/.env and add your key from https://platform.openai.com/api-keys\n")

client = OpenAI(api_key=OPENAI_API_KEY)

app = FastAPI(title="Coding Assistant API", version="3.0.0")
app.add_middleware(CORSMiddleware, allow_origins=ALLOWED_ORIGINS, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

SUPPORTED_EXTENSIONS = {
    ".py": "Python", ".js": "JavaScript", ".ts": "TypeScript",
    ".jsx": "JavaScript (React)", ".tsx": "TypeScript (React)",
    ".java": "Java", ".cpp": "C++", ".c": "C", ".cs": "C#",
    ".go": "Go", ".rb": "Ruby", ".php": "PHP", ".swift": "Swift",
    ".kt": "Kotlin", ".rs": "Rust", ".html": "HTML", ".css": "CSS",
    ".sql": "SQL", ".sh": "Shell/Bash", ".r": "R", ".m": "MATLAB",
}


# ── Models ────────────────────────────────────────────────────────────────────
class DebugRequest(BaseModel):
    code: str
    language: Optional[str] = "auto-detect"

class DebugResponse(BaseModel):
    original_code: str
    debugged_code: str
    language: str
    errors_found: list[str]
    fixes_applied: list[str]
    explanation: str

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: list[ChatMessage]

class SearchRequest(BaseModel):
    query: str

class SearchResponse(BaseModel):
    topic: str
    answer: str
    key_points: list[str]
    example_code: Optional[str] = None

class SaveDebugRequest(BaseModel):
    user_id: str
    code: str
    language: str
    errors_found: list[str]
    fixes_applied: list[str]
    explanation: str

class DebugHistoryRequest(BaseModel):
    user_id: str

class UsageCheckRequest(BaseModel):
    user_id: str

class UsageIncrementRequest(BaseModel):
    user_id: str

# ── Helpers ───────────────────────────────────────────────────────────────────
def sanitize_code(code: str) -> str:
    code = code.replace('\u201c', '"').replace('\u201d', '"')
    code = code.replace('\u2018', "'").replace('\u2019', "'")
    code = code.replace('\u2013', '-').replace('\u2014', '-')
    code = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', code)
    return code

def format_code_lines(code: str) -> str:
    """Ensure code has proper newlines. If it comes back as one long line, reformat it.
    
    KEY FIX: tracks parenthesis depth so semicolons inside for(;;) loops are
    never treated as statement terminators — only semicolons at paren_depth == 0
    cause a newline, exactly like real formatters do.
    """
    if not code:
        return code
    # If already has real newlines, return as-is
    if "\n" in code:
        return code

    out = []
    depth = 0        # brace depth  → controls indentation
    paren_depth = 0  # paren depth  → semicolons inside for(;;) are NOT split
    i = 0
    length = len(code)

    while i < length:
        ch = code[i]

        # ── String literals — pass through untouched ──────────────────────
        if ch in ('"', "'", '`'):
            q = ch
            segment = ch
            i += 1
            while i < length and code[i] != q:
                if code[i] == '\\' and i + 1 < length:
                    segment += code[i] + code[i + 1]
                    i += 2
                else:
                    segment += code[i]
                    i += 1
            segment += code[i] if i < length else ''
            i += 1
            out.append(segment)
            continue

        # ── Parentheses — track depth so for(;;) semicolons are safe ──────
        if ch == '(':
            paren_depth += 1
            out.append(ch)
            i += 1

        elif ch == ')':
            paren_depth = max(0, paren_depth - 1)
            out.append(ch)
            i += 1

        # ── Opening brace ─────────────────────────────────────────────────
        elif ch == '{':
            # trim any trailing space already in out before adding ' {'
            if out and out[-1] == ' ':
                out[-1] = ''
            out.append(' {')
            depth += 1
            out.append('\n' + '    ' * depth)
            i += 1
            while i < length and code[i] == ' ':
                i += 1

        # ── Closing brace ─────────────────────────────────────────────────
        elif ch == '}':
            depth = max(0, depth - 1)
            out.append('\n' + '    ' * depth + '}')
            j = i + 1
            while j < length and code[j] == ' ':
                j += 1
            rest = code[j:j + 7]
            if rest.startswith(('else', 'catch', 'finally')):
                out.append(' ')
            else:
                out.append('\n' + '    ' * depth)
            i += 1
            while i < length and code[i] == ' ':
                i += 1

        # ── Semicolon — ONLY split when outside parentheses ───────────────
        elif ch == ';':
            out.append(';')
            if paren_depth == 0:
                # Normal statement terminator → new line
                out.append('\n' + '    ' * depth)
                i += 1
                while i < length and code[i] == ' ':
                    i += 1
            else:
                # Inside for(init; cond; incr) — keep on same line
                i += 1
                # Preserve exactly one space after the semicolon if missing
                if i < length and code[i] != ' ':
                    out.append(' ')

        # ── Everything else ───────────────────────────────────────────────
        else:
            out.append(ch)
            i += 1

    result = ''.join(out)
    # Clean up: collapse consecutive blank lines, strip trailing whitespace
    lines = result.split('\n')
    cleaned = []
    prev_blank = False
    for idx2, line in enumerate(lines):
        is_blank = line.strip() == ''
        # Skip blank lines immediately before a closing brace line
        next_line = lines[idx2 + 1].strip() if idx2 + 1 < len(lines) else ''
        if is_blank and next_line.startswith('}'):
            continue
        if is_blank and prev_blank:
            continue
        cleaned.append(line.rstrip())
        prev_blank = is_blank
    return '\n'.join(cleaned).strip()


def build_debug_prompt(code: str, language: str) -> str:
    return f"""You are a coding assistant helping students debug their code. Analyze the {language} code below, find ALL bugs, and return a fixed version.

CODE:
{code}

Return ONLY valid JSON (no markdown):
{{
  "language": "<language name>",
  "debugged_code": "<complete fixed code>",
  "errors_found": ["<error 1>", "<error 2>"],
  "fixes_applied": ["<fix 1>", "<fix 2>"],
  "explanation": "<detailed friendly summary explaining what was wrong and how it was fixed, written for a student learning to code>"
}}

Rules:
- debugged_code must be 100% complete and runnable
- Only fix actual bugs, preserve original style
- If no bugs found, return original code unchanged
- errors_found and fixes_applied must be same length
- explanation must be detailed, educational, and friendly"""

def parse_response(text: str) -> dict:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r'^```[a-z]*\s*', '', cleaned)
        cleaned = re.sub(r'\s*```$', '', cleaned)
        cleaned = cleaned.strip()
    cleaned = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', '', cleaned)
    try:
        return json.loads(cleaned, strict=False)
    except json.JSONDecodeError:
        pass
    match = re.search(r'\{[\s\S]*\}', cleaned)
    if match:
        try:
            return json.loads(match.group(), strict=False)
        except json.JSONDecodeError:
            pass
    raise ValueError("Could not parse response as JSON")

def extract_pdf_text(file_bytes: bytes) -> str:
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp.write(file_bytes); tmp_path = tmp.name
    try:
        parts = []
        with pdfplumber.open(tmp_path) as pdf:
            for page in pdf.pages:
                t = page.extract_text()
                if t: parts.append(t)
        return "\n".join(parts)
    finally:
        os.unlink(tmp_path)


# ── Routes ────────────────────────────────────────────────────────────────────

@app.post("/api/debug", response_model=DebugResponse)
async def debug_code(request: DebugRequest):
    if not request.code.strip():
        raise HTTPException(status_code=400, detail="Code cannot be empty")
    clean_code = sanitize_code(request.code)
    prompt = build_debug_prompt(clean_code, request.language or "auto-detect")
    try:
        completion = client.chat.completions.create(
            messages=[
                {"role": "system", "content": "You are a helpful coding assistant for students. Always respond with valid JSON only. Never use markdown or code fences. Never include control characters in JSON strings."},
                {"role": "user", "content": prompt},
            ],
            model=OPENAI_MODEL, temperature=0.1, max_tokens=4096,
        )
        parsed = parse_response(completion.choices[0].message.content)
        raw_code = parsed.get("debugged_code", clean_code)
        return DebugResponse(
            original_code=clean_code,
            debugged_code=format_code_lines(raw_code),
            language=parsed.get("language", request.language or "Unknown"),
            errors_found=parsed.get("errors_found", []),
            fixes_applied=parsed.get("fixes_applied", []),
            explanation=parsed.get("explanation", ""),
        )
    except Exception as e:
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@app.post("/api/chat")
async def chat(request: ChatRequest):
    """CS Tutor — answers only CS/coding questions using Groq."""
    try:
        messages = [
            {
                "role": "system",
                "content": (
                    "You are a friendly and helpful CS Tutor for students learning computer science and programming. "
                    "You ONLY answer questions related to computer science, coding, programming languages, algorithms, "
                    "data structures, software development, databases, networks, operating systems, and related technical topics. "
                    "If asked about anything unrelated to CS, politely say you can only help with CS topics. "
                    "Give clear, educational, beginner-friendly answers. Use examples when helpful. "
                    "Format your responses clearly with line breaks for readability."
                )
            }
        ] + [{"role": m.role, "content": m.content} for m in request.messages]

        completion = client.chat.completions.create(
            messages=messages,
            model=OPENAI_MODEL,
            temperature=0.5,
            max_tokens=1024,
        )
        reply = completion.choices[0].message.content
        return {"reply": reply}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat error: {str(e)}")


@app.post("/api/search", response_model=SearchResponse)
async def search_cs(request: SearchRequest):
    """CS Search — uses Groq to answer CS/coding questions with structure."""
    query = request.query.strip()
    if not query:
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    try:
        prompt = f"""You are a CS knowledge base. Answer this question about computer science or programming:

QUESTION: {query}

Respond ONLY in valid JSON (no markdown):
{{
  "topic": "<short topic name, e.g. 'Arrays in Python'>",
  "answer": "<clear, detailed explanation in 3-5 sentences>",
  "key_points": ["<point 1>", "<point 2>", "<point 3>", "<point 4>"],
  "example_code": "<short relevant code example, or null if not applicable>"
}}

Rules:
- If the question is NOT about CS/coding/programming, set answer to "This search tool is for CS and coding topics only. Please ask about programming, algorithms, data structures, or computer science."
- key_points must have 3-5 items
- example_code should be null if no code example is needed
- Keep all strings on one line (no literal newlines inside JSON strings, use \\n instead)"""

        completion = client.chat.completions.create(
            messages=[
                {"role": "system", "content": "You are a CS knowledge base. Always respond with valid JSON only. No markdown. No code fences. Use \\n for newlines inside strings."},
                {"role": "user", "content": prompt},
            ],
            model=OPENAI_MODEL,
            temperature=0.3,
            max_tokens=1024,
        )
        parsed = parse_response(completion.choices[0].message.content)
        return SearchResponse(
            topic=parsed.get("topic", query),
            answer=parsed.get("answer", ""),
            key_points=parsed.get("key_points", []),
            example_code=parsed.get("example_code") or None,
        )
    except Exception as e:
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Search error: {str(e)}")


@app.post("/api/upload", response_model=DebugResponse)
async def upload_and_debug(file: UploadFile = File(...), language: Optional[str] = Form("auto-detect")):
    file_bytes = await file.read()
    if len(file_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail=f"File too large. Max {MAX_UPLOAD_MB} MB.")
    filename = file.filename or ""
    ext = Path(filename).suffix.lower()
    if ext == ".pdf":
        try: code = extract_pdf_text(file_bytes)
        except Exception as e: raise HTTPException(status_code=400, detail=f"Failed to read PDF: {str(e)}")
    else:
        try: code = file_bytes.decode("utf-8")
        except UnicodeDecodeError:
            try: code = file_bytes.decode("latin-1")
            except: raise HTTPException(status_code=400, detail="Cannot read file - unsupported encoding")
    detected_language = SUPPORTED_EXTENSIONS.get(ext, language or "auto-detect")
    if not code.strip():
        raise HTTPException(status_code=400, detail="File is empty")
    return await debug_code(DebugRequest(code=code, language=detected_language))


@app.get("/api/languages")
async def get_languages():
    return {"languages": list(SUPPORTED_EXTENSIONS.values()) + ["auto-detect"]}


# ── Debug History & Usage Tracking ────────────────────────────────────────────

@app.post("/api/save-debug")
async def save_debug(request: SaveDebugRequest):
    """Save debug session to history"""
    try:
        debug_id = db.save_debug(
            request.user_id,
            request.code,
            request.language,
            request.errors_found,
            request.fixes_applied,
            request.explanation
        )
        return {
            "success": True,
            "debug_id": debug_id,
            "message": "Debug saved to history"
        }
    except Exception as e:
        print(f"[ERROR] Failed to save debug: {e}")
        return {"success": False, "error": str(e)}

@app.post("/api/debug-history")
async def get_debug_history(request: DebugHistoryRequest):
    """Get last 7 debug sessions for a user"""
    try:
        debugs = db.get_last_7_debugs(request.user_id)
        return {
            "user_id": request.user_id,
            "debugs": debugs,
            "count": len(debugs),
            "success": True
        }
    except Exception as e:
        print(f"[ERROR] Failed to get debug history: {e}")
        return {"success": False, "error": str(e)}

@app.post("/api/check-usage")
async def check_usage(request: UsageCheckRequest):
    """Check daily usage for a user"""
    try:
        result = db.check_usage(request.user_id)
        return result
    except Exception as e:
        print(f"[ERROR] Failed to check usage: {e}")
        return {"debug_count": 0, "limit": 50, "remaining": 50, "exceeded": False}

@app.post("/api/increment-usage")
async def increment_usage(request: UsageIncrementRequest):
    """Increment usage count for today"""
    try:
        result = db.increment_usage(request.user_id)
        return result
    except Exception as e:
        print(f"[ERROR] Failed to increment usage: {e}")
        return {"debug_count": 0, "limit": 50, "remaining": 50, "exceeded": False}

@app.get("/health")
async def health():
    return {"status": "ok", "service": "Coding Assistant API", "model": OPENAI_MODEL}

# ═════════════════════════════════════════════════════════════════════════════
# NLP ANALYSIS ENDPOINTS
# ═════════════════════════════════════════════════════════════════════════════

class NLPAnalysisRequest(BaseModel):
    question: str
    context: str = ""
    grade_level: str = "6"

class NLPIntentRequest(BaseModel):
    text: str

class NLPSentimentRequest(BaseModel):
    text: str

class NLPTopicRequest(BaseModel):
    text: str

@app.post("/api/nlp/analyze")
async def analyze_error(request: NLPAnalysisRequest):
    """Analyze code error or debugging question with NLP"""
    try:
        analysis = nlp_engine.analyze_question(request.question, request.context)
        return {"success": True, "analysis": analysis}
    except Exception as e:
        return {"success": False, "error": str(e), "analysis": None}

@app.post("/api/nlp/intent")
async def detect_intent(request: NLPIntentRequest):
    """Detect what user wants: debug, explain error, improve code"""
    try:
        intent = nlp_engine.detect_intent(request.text)
        return {"success": True, "intent": intent}
    except Exception as e:
        return {"success": False, "error": str(e), "intent": None}

@app.post("/api/nlp/sentiment")
async def analyze_sentiment(request: NLPSentimentRequest):
    """Analyze student frustration with error"""
    try:
        sentiment = nlp_engine.analyze_sentiment(request.text)
        return {"success": True, "sentiment": sentiment}
    except Exception as e:
        return {"success": False, "error": str(e), "sentiment": None}

@app.post("/api/nlp/topics")
async def extract_topics(request: NLPTopicRequest):
    """Extract programming topics from error"""
    try:
        topics = nlp_engine.extract_topics(request.text)
        return {"success": True, "topics": topics}
    except Exception as e:
        return {"success": False, "error": str(e), "topics": []}

@app.post("/api/nlp/classify")
async def classify_debug_question(request: NLPAnalysisRequest):
    """Classify debugging question and strategy"""
    try:
        strategy = nlp_engine.classify_question_type(request.question)
        return {"success": True, "strategy": strategy}
    except Exception as e:
        return {"success": False, "error": str(e), "strategy": None}


# ═════════════════════════════════════════════════════════════════════════════
# ADAPTIVE LEARNING ENDPOINTS
# ═════════════════════════════════════════════════════════════════════════════

class AdaptiveSubmitAnswerRequest(BaseModel):
    student_id: str
    question_id: str
    answer: str
    is_correct: bool
    time_taken: Optional[float] = None
    difficulty_rating: Optional[float] = None

class AdaptiveProgressRequest(BaseModel):
    student_id: str

class AdaptiveRecommendRequest(BaseModel):
    student_id: str
    grade_level: Optional[str] = "6"

class AdaptiveAnalyzeCodeRequest(BaseModel):
    student_id: str
    code: str
    language: str
    is_correct: bool
    time_taken: Optional[float] = None

# Initialize adaptive systems
irt = ItemResponseTheory()
bkt = BayesianKnowledgeTracing()
adaptor = DifficultyAdaptor()
recommender = LearningPathRecommender()
adaptive = AdaptiveIntegration()

@app.post("/api/adaptive/submit-answer")
async def submit_answer(request: AdaptiveSubmitAnswerRequest):
    """Record debugging assessment for adaptive learning"""
    try:
        assessment_id = db.record_assessment(
            request.student_id,
            request.language if hasattr(request, 'language') else "debugging",
            request.is_correct,
            request.time_taken,
            request.difficulty_rating
        )
        return {
            "success": True,
            "assessment_id": assessment_id,
            "message": "Assessment recorded"
        }
    except Exception as e:
        print(f"[ERROR] Failed to record assessment: {e}")
        return {"success": False, "error": str(e)}

@app.post("/api/adaptive/student-progress")
async def get_progress(request: AdaptiveProgressRequest):
    """Get overall progress and per-language mastery"""
    try:
        progress = db.get_student_progress(request.student_id)
        return {
            "success": True,
            "data": progress
        }
    except Exception as e:
        print(f"[ERROR] Failed to get progress: {e}")
        return {"success": False, "error": str(e), "data": None}

@app.post("/api/adaptive/recommend-next")
async def get_recommendations(request: AdaptiveRecommendRequest):
    """Get personalized learning recommendations"""
    try:
        recommendations = db.get_recommendations(request.student_id, limit=3)

        if not recommendations:
            # Generate recommendations using ML if none exist
            progress = db.get_student_progress(request.student_id)
            objectives = progress.get('objectives', [])

            recommendations = []
            for obj in objectives:
                priority = 1.0 - obj['mastery']
                rec_id = db.add_recommendation(
                    request.student_id,
                    obj['language'],
                    f"Continue improving in {obj['language']}",
                    "intermediate" if obj['mastery'] < 0.5 else "advanced",
                    priority
                )

        return {
            "success": True,
            "recommendations": recommendations[:3]
        }
    except Exception as e:
        print(f"[ERROR] Failed to get recommendations: {e}")
        return {"success": False, "error": str(e), "recommendations": []}

@app.post("/api/adaptive/analyze-code")
async def analyze_code_adaptive(request: AdaptiveAnalyzeCodeRequest):
    """Analyze code and record for adaptive learning"""
    try:
        # Record the assessment
        assessment_id = db.record_assessment(
            request.student_id,
            request.language,
            request.is_correct,
            request.time_taken
        )

        # Get updated progress
        progress = db.get_student_progress(request.student_id)

        return {
            "success": True,
            "assessment_id": assessment_id,
            "progress": progress
        }
    except Exception as e:
        print(f"[ERROR] Failed to analyze code adaptively: {e}")
        return {"success": False, "error": str(e)}


# ── Code Execution ────────────────────────────────────────────────────────────

class RunRequest(BaseModel):
    code: str
    language: str = "Python"

@app.post("/api/run")
async def run_code(request: RunRequest):
    if not request.code.strip():
        raise HTTPException(status_code=400, detail="Code cannot be empty")
    if request.language not in ("Python", "auto-detect"):
        return {"output": "", "error": f"Live execution is only supported for Python on this server.\nFor {request.language}, download the fixed code and run it locally.", "language": request.language}
    import subprocess, tempfile, sys
    code = sanitize_code(request.code)
    with tempfile.NamedTemporaryFile(suffix=".py", mode="w", delete=False, encoding="utf-8") as f:
        f.write(code)
        tmp_path = f.name
    try:
        proc = subprocess.run(
            [sys.executable, tmp_path],
            capture_output=True, text=True, timeout=5,
            env={**os.environ, "PYTHONDONTWRITEBYTECODE": "1"}
        )
        return {
            "output": proc.stdout[:5000],
            "error":  proc.stderr[:2000],
            "exit_code": proc.returncode,
            "language": "Python"
        }
    except subprocess.TimeoutExpired:
        return {"output": "", "error": "⏱ Execution timed out (5 second limit)", "exit_code": -1, "language": "Python"}
    except Exception as e:
        return {"output": "", "error": str(e), "exit_code": -1, "language": "Python"}
    finally:
        os.unlink(tmp_path)


# ── Explain Simply ────────────────────────────────────────────────────────────

class ExplainRequest(BaseModel):
    errors: list[str]
    fixes: list[str]
    language: str = "Unknown"

@app.post("/api/explain-simple")
async def explain_simple(request: ExplainRequest):
    if not request.errors:
        raise HTTPException(status_code=400, detail="No errors to explain")
    prompt = (
        f"A student just had their {request.language} code debugged. "
        f"Explain the following bugs and fixes in the simplest possible way, "
        f"as if talking to a 10-year-old who is just learning to code. "
        f"Use very simple words, fun analogies, and be encouraging.\n\n"
        f"Bugs found:\n" + "\n".join(f"- {e}" for e in request.errors) + "\n\n"
        f"Fixes applied:\n" + "\n".join(f"- {f}" for f in request.fixes) + "\n\n"
        f"Give a short, friendly explanation (3-5 sentences max per bug). Use emojis."
    )
    try:
        completion = client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model=OPENAI_MODEL, temperature=0.7, max_tokens=512,
        )
        return {"explanation": completion.choices[0].message.content.strip()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── SERVE FRONTEND ────────────────────────────────────

FRONTEND_DIST = Path(__file__).parent.parent / "frontend" / "dist"

if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

NO_CACHE_HEADERS = {"Cache-Control": "no-cache, no-store, must-revalidate", "Pragma": "no-cache", "Expires": "0"}

@app.get("/")
def serve_index():
    index_file = FRONTEND_DIST / "index.html"
    if index_file.exists():
        return FileResponse(index_file, headers=NO_CACHE_HEADERS)
    return {"message": "Frontend not built"}

@app.get("/{full_path:path}", include_in_schema=False)
def serve_frontend(full_path: str):
    if full_path.startswith("api/"):
        return {"error": "Not found"}
    file_path = FRONTEND_DIST / full_path
    if file_path.exists():
        return FileResponse(file_path)
    index_file = FRONTEND_DIST / "index.html"
    if index_file.exists():
        return FileResponse(index_file, headers=NO_CACHE_HEADERS)
    return {"error": "Not found"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=HOST, port=PORT)
