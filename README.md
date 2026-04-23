# CodeFix - AI Code Debugger for Teachers

A full-stack AI-powered code debugging tool built for teachers. Paste or upload code files in any language, and CodeFix will detect and fix all errors using Groq's LLaMA 3.3 70B model.

## Features

- Paste code directly or upload files (PDF, .py, .js, .java, .cpp, and 15+ more formats)
- Auto-detects programming language
- Lists every error found with a matching fix applied
- Side-by-side diff view to see exactly what changed
- Copy fixed code with one click
- Powered by Groq (ultra-fast inference)

---

## Setup

### 1. Get a Groq API Key

1. Go to https://console.groq.com
2. Create a free account
3. Generate an API key from the dashboard

---

### 2. Backend (Python + FastAPI)

```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Set your Groq API key
export GROQ_API_KEY=your_key_here

# Start the server
uvicorn main:app --reload --port 8000
```

Backend runs at: http://localhost:8000

API docs available at: http://localhost:8000/docs

---

### 3. Frontend (React + Vite)

```bash
cd frontend

# Install dependencies
npm install

# Start the dev server
npm run dev
```

Frontend runs at: http://localhost:3000

---

## API Endpoints

| Method | Endpoint        | Description                          |
|--------|-----------------|--------------------------------------|
| POST   | /api/debug      | Debug code sent as JSON body         |
| POST   | /api/upload     | Upload a file and debug its code     |
| GET    | /api/languages  | List all supported languages         |
| GET    | /health         | Health check                         |

### POST /api/debug

```json
{
  "code": "def hello(:\n    print('world')",
  "language": "Python"
}
```

### Response

```json
{
  "original_code": "...",
  "debugged_code": "def hello():\n    print('world')",
  "language": "Python",
  "errors_found": ["Missing closing parenthesis in function definition"],
  "fixes_applied": ["Added closing parenthesis to def hello():"],
  "explanation": "Fixed syntax error in function definition."
}
```

---

## Supported File Types

PDF, .py, .js, .ts, .jsx, .tsx, .java, .cpp, .c, .cs, .go, .rb, .php, .swift, .kt, .rs, .html, .css, .sql, .sh, .r, .m

---

## Tech Stack

- **Backend**: Python, FastAPI, Groq SDK, pdfplumber
- **Frontend**: React 18, Vite, CSS (no UI library)
- **AI Model**: LLaMA 3.3 70B via Groq
