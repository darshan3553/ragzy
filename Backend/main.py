from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import PyPDF2
import faiss
import numpy as np
from together import Together
from openai import OpenAI
from typing import List
import logging

# ------------------------------------------------------------
# 🔹 Basic Setup
# ------------------------------------------------------------
logging.basicConfig(level=logging.INFO)
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_FOLDER = "/tmp/uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# ------------------------------------------------------------
# 🔹 Global Variables
# ------------------------------------------------------------
pdf_chunks: List[str] = []
pdf_index = None
pdf_filename = ""

# ------------------------------------------------------------
# 🔹 API Clients (Keys set via environment variables on Vercel)
# ------------------------------------------------------------
NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY", "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")
TOGETHER_API_KEY = os.getenv("TOGETHER_API_KEY", "tgp_v1_XLdVuzxsDTmKQ7me8KRrT4EKvL9huq1eVJS752gIrtk")

if not NVIDIA_API_KEY or not TOGETHER_API_KEY:
    logging.warning("⚠️ API keys not set. Please configure them in Vercel dashboard.")

nvidia_client = OpenAI(
    base_url="https://integrate.api.nvidia.com/v1",
    api_key=NVIDIA_API_KEY
)

together_client = Together(api_key=TOGETHER_API_KEY)

EMBEDDING_MODEL = "nvidia/nv-embedqa-e5-v5"

# ------------------------------------------------------------
# 🔹 Utilities
# ------------------------------------------------------------
def embed_texts(texts: List[str], input_type: str = "passage") -> np.ndarray:
    """Create embeddings using NVIDIA API."""
    try:
        response = nvidia_client.embeddings.create(
            model=EMBEDDING_MODEL,
            input=texts,
            encoding_format="float",
            extra_body={"input_type": input_type, "truncate": "END"},
        )
        return np.array([item.embedding for item in response.data], dtype=np.float32)
    except Exception as e:
        logging.error(f"Embedding error: {e}")
        raise HTTPException(status_code=500, detail=f"Embedding failed: {e}")

def chunk_text(text: str, chunk_size: int = 800, overlap: int = 150) -> List[str]:
    """Split text into overlapping chunks."""
    text = text.replace("\n", " ").replace("\r", " ")
    words = text.split()
    if not words:
        return []
    return [
        " ".join(words[i : i + chunk_size])
        for i in range(0, len(words), chunk_size - overlap)
    ]

class Question(BaseModel):
    question: str

# ------------------------------------------------------------
# 🔹 Endpoints
# ------------------------------------------------------------
@app.get("/api")
async def health():
    return {
        "status": "ok",
        "pdf_loaded": pdf_index is not None,
        "chunks": len(pdf_chunks)
    }

@app.post("/api/upload")
async def upload_pdf(file: UploadFile = File(...)):
    global pdf_chunks, pdf_index, pdf_filename

    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Please upload a valid PDF file")

    file_path = os.path.join(UPLOAD_FOLDER, file.filename)
    try:
        with open(file_path, "wb") as f:
            f.write(await file.read())

        pdf_reader = PyPDF2.PdfReader(file_path)
        text = "\n".join(page.extract_text() or "" for page in pdf_reader.pages)
        if not text.strip():
            raise HTTPException(status_code=400, detail="No readable text in PDF")

        pdf_chunks = chunk_text(text)
        if not pdf_chunks:
            raise HTTPException(status_code=400, detail="No chunks created")

        # Batch embedding to prevent timeout
        all_embeds = []
        for i in range(0, len(pdf_chunks), 10):
            batch = pdf_chunks[i : i + 10]
            all_embeds.append(embed_texts(batch))
        embeds = np.vstack(all_embeds)

        pdf_index = faiss.IndexFlatL2(embeds.shape[1])
        pdf_index.add(embeds)
        pdf_filename = file.filename

        return {"message": "PDF processed successfully", "chunks": len(pdf_chunks)}
    except Exception as e:
        logging.error(f"Upload error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(file_path):
            os.remove(file_path)

@app.post("/api/ask")
async def ask_question(data: Question):
    global pdf_chunks, pdf_index, pdf_filename
    if pdf_index is None or not pdf_chunks:
        raise HTTPException(status_code=400, detail="No PDF uploaded")

    try:
        q = data.question.strip()
        if not q:
            raise HTTPException(status_code=400, detail="Question cannot be empty")

        q_embed = embed_texts([q], input_type="query")
        k = min(5, len(pdf_chunks))
        _, idxs = pdf_index.search(q_embed, k)

        context = "\n\n".join([pdf_chunks[i] for i in idxs[0]])
        messages = [
            {"role": "system", "content": "Answer using only the provided context."},
            {"role": "user", "content": f"Context:\n{context}\n\nQuestion: {q}\nAnswer:"},
        ]

        response = together_client.chat.completions.create(
            model="mistralai/Mixtral-8x7B-Instruct-v0.1",
            messages=messages,
            temperature=0.2,
            max_tokens=400,
        )

        answer = response.choices[0].message.content.strip()
        return {
            "answer": answer,
            "chunks_used": len(idxs[0]),
            "document": pdf_filename
        }
    except Exception as e:
        logging.error(f"Ask error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/clear")
async def clear():
    global pdf_chunks, pdf_index, pdf_filename
    pdf_chunks = []
    pdf_index = None
    pdf_filename = ""
    return {"message": "Cleared"}
