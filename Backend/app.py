from fastapi import FastAPI, File, UploadFile, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import os
import PyPDF2
import faiss
import numpy as np
from together import Together
from openai import OpenAI
from typing import List
import logging
import json

# ------------------------------------------------------------
# 🔹 Basic Setup
# ------------------------------------------------------------
logging.basicConfig(level=logging.INFO)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_FOLDER = "/tmp/uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# ------------------------------------------------------------
# 🔹 Global State
# ------------------------------------------------------------
pdf_chunks: List[str] = []
pdf_index = None
pdf_filename = ""

# ------------------------------------------------------------
# 🔹 Initialize API Clients
# ------------------------------------------------------------
NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY", "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")
nvidia_client = OpenAI(
    base_url="https://integrate.api.nvidia.com/v1",
    api_key=NVIDIA_API_KEY
)

TOGETHER_API_KEY = os.getenv("TOGETHER_API_KEY", "tgp_v1_XLdVuzxsDTmKQ7me8KRrT4EKvL9huq1eVJS752gIrtk")
together_client = Together(api_key=TOGETHER_API_KEY)

EMBEDDING_MODEL = "nvidia/nv-embedqa-e5-v5"

# ------------------------------------------------------------
# 🔹 Utility Functions
# ------------------------------------------------------------
def embed_texts(texts: List[str], input_type: str = "passage") -> np.ndarray:
    try:
        response = nvidia_client.embeddings.create(
            model=EMBEDDING_MODEL,
            input=texts,
            encoding_format="float",
            extra_body={"input_type": input_type, "truncate": "END"}
        )
        embeddings = [item.embedding for item in response.data]
        return np.array(embeddings, dtype=np.float32)
    except Exception as e:
        logging.error(f"Embedding error: {e}")
        raise HTTPException(status_code=500, detail=f"Embedding failed: {str(e)}")

def chunk_text(text: str, chunk_size: int = 800, overlap: int = 150) -> List[str]:
    text = text.replace('\n\n', ' ').replace('\n', ' ')
    sentences = [s.strip() + '.' for s in text.split('. ') if s.strip()]
    
    if not sentences:
        words = text.split()
        return [' '.join(words[i:i + chunk_size]) for i in range(0, len(words), chunk_size - overlap) if words[i:i + chunk_size]]
    
    chunks = []
    current_chunk = []
    current_length = 0
    
    for sentence in sentences:
        sentence_length = len(sentence.split())
        
        if current_length + sentence_length > chunk_size and current_chunk:
            chunks.append(' '.join(current_chunk))
            current_chunk = current_chunk[-3:] if len(current_chunk) > 3 else []
            current_length = sum(len(s.split()) for s in current_chunk)
        
        current_chunk.append(sentence)
        current_length += sentence_length
    
    if current_chunk:
        chunks.append(' '.join(current_chunk))
    
    return [c.strip() for c in chunks if c.strip()]

class Question(BaseModel):
    question: str

@app.get("/")
async def root():
    return {"RAG PDF Q&A API is running."}
# ------------------------------------------------------------
# 🔹 API Endpoints
# ------------------------------------------------------------
@app.get("/api")
async def health_check():
    return {
        "status": "healthy",
        "service": "RAG PDF Q&A API",
        "pdf_loaded": pdf_index is not None,
        "chunks_count": len(pdf_chunks)
    }

@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    global pdf_chunks, pdf_index, pdf_filename

    if not file.filename or not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Please upload a valid PDF file")

    file_path = os.path.join(UPLOAD_FOLDER, file.filename)
    
    try:
        content = await file.read()
        with open(file_path, "wb") as buffer:
            buffer.write(content)

        pdf_reader = PyPDF2.PdfReader(file_path)
        text = "\n".join(page.extract_text() or "" for page in pdf_reader.pages)

        if not text.strip():
            raise HTTPException(status_code=400, detail="No text in PDF")

        pdf_chunks = chunk_text(text)
        
        if not pdf_chunks:
            raise HTTPException(status_code=400, detail="Failed to create chunks")

        batch_size = 20
        all_embeddings = []
        
        for i in range(0, len(pdf_chunks), batch_size):
            batch = pdf_chunks[i:i + batch_size]
            batch_embeddings = embed_texts(batch, input_type="passage")
            all_embeddings.append(batch_embeddings)
        
        embeddings = np.vstack(all_embeddings)
        dim = embeddings.shape[1]
        pdf_index = faiss.IndexFlatL2(dim)
        pdf_index.add(embeddings)
        pdf_filename = file.filename

        return {
            "filename": file.filename,
            "pages": len(pdf_reader.pages),
            "chunks": len(pdf_chunks),
            "message": "PDF uploaded successfully!",
        }

    finally:
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except:
                pass

@app.post("/api/ask")
async def ask_question(question_data: Question):
    global pdf_chunks, pdf_index, pdf_filename

    if pdf_index is None or not pdf_chunks:
        raise HTTPException(status_code=400, detail="No PDF loaded")

    question = question_data.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question cannot be empty")

    try:
        question_embedding = embed_texts([question], input_type="query")
        k = min(5, len(pdf_chunks))
        D, I = pdf_index.search(question_embedding, k)
        
        relevant_chunks = [pdf_chunks[I[0][i]] for i in range(len(I[0]))]
        context = "\n\n".join([f"[Passage {i+1}]\n{chunk}" for i, chunk in enumerate(relevant_chunks)])

        messages = [
            {
                "role": "system",
                "content": "You are a helpful assistant that answers questions based on the provided passages. Be concise and accurate."
            },
            {
                "role": "user",
                "content": f"Context:\n{context}\n\nQuestion: {question}\n\nAnswer:"
            }
        ]

        response = together_client.chat.completions.create(
            model="mistralai/Mixtral-8x7B-Instruct-v0.1",
            messages=messages,
            temperature=0.2,
            max_tokens=500
        )

        answer = response.choices[0].message.content.strip()
        
        return {
            "answer": answer,
            "chunks_used": len(relevant_chunks),
            "document": pdf_filename
        }

    except Exception as e:
        logging.error(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
@app.post("/api/clear")
async def clear_pdf():
    global pdf_chunks, pdf_index, pdf_filename
    pdf_chunks = []
    pdf_index = None
    pdf_filename = ""
    return {"message": "Cleared"}