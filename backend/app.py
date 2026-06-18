from fastapi import FastAPI, UploadFile, File
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import os

from rag import (
    extract_text,
    chunk_text,
    store_chunks,
    count_docs,
    generate_answer
)

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def home():
    return {
        "message": "PDF Chatbot API Running"
    }


@app.get("/health")
def health():
    return {
        "status": "healthy"
    }


@app.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):

    if not file.filename.lower().endswith(".pdf"):
        return {
            "error": "Only PDF files are allowed"
        }

    file_path = os.path.join(UPLOAD_DIR, file.filename)

    with open(file_path, "wb") as buffer:
        buffer.write(await file.read())

    try:
        text = extract_text(file_path)

    except Exception as e:
        return {
            "error": f"Couldn't read this PDF: {e}"
        }

    if not text.strip():
        return {
            "error": (
                "Couldn't find any readable text in this PDF. "
                "It might be a scanned/image-only document."
            )
        }

    chunks = chunk_text(text)

    try:
        result = store_chunks(chunks)

    except Exception as e:
        return {
            "error": str(e)
        }

    return {
        "message": "PDF uploaded",
        "filename": file.filename,
        "characters": len(text),
        "chunks": result["count"]
    }


class ChatRequest(BaseModel):
    question: str


@app.post("/chat")
async def chat(request: ChatRequest):

    answer = generate_answer(request.question)

    return {
        "question": request.question,
        "answer": answer
    }


@app.get("/count")
def count():
    return {
        "documents": count_docs()
    }