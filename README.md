# ⚡ Ragzy – AI-Powered RAG Chat Application

## 🌟 Overview

Ragzy is an AI-powered **Retrieval-Augmented Generation (RAG)** application that allows users to upload documents, extract text, generate embeddings, and chat interactively with the content.  
The system uses vector search paired with Large Language Models (LLMs) to provide accurate, context-aware answers grounded in your uploaded files.

🌐 **Live Demo:** https://ragzy.vercel.app  
📁 **GitHub Repository:** https://github.com/darshan3553/ragzy

---

## 🚀 Features

### 📄 Document Upload & Parsing
- Upload PDFs or text documents effortlessly.  
- Backend parsing extracts clean, structured text.

### 🔍 RAG Pipeline
- **Text Chunking** for efficient retrieval.  
- **Embedding Generation** using HuggingFace models.  
- **Vector Storage** using Pinecone or FAISS.  
- **Similarity Search** retrieves context for accurate Q&A.

### 💬 Conversational AI
- Interactive chat with document content.  
- Conversational memory for follow-up questions.

### 📁 Document Manager
- Manage uploaded files and previous chats.

### ⚙️ Modern UI
- Built using **React + Vite**.  
- Styled with **Tailwind CSS** for responsiveness and speed.

---

## 🧩 Tech Stack

| Component | Technology | Description |
|----------|------------|-------------|
| **Frontend** | React (Vite) | High-performance UI framework |
| **Styling** | Tailwind CSS | Utility-first styling |
| **Backend** | Node.js / Express | REST API for RAG, chat, and auth |
| **Orchestration** | LangChain | Document loaders, chains, vector stores |
| **Embeddings** | HuggingFace | Models like `all-mpnet-base-v2` |
| **Vector Store** | Pinecone / FAISS | Vector similarity search |
| **Hosting** | Vercel (Frontend) | Fast global CDN deployment |

---

## 🔬 RAG Workflow Explained

1. **Upload & Ingestion:**  
   Document is uploaded, parsed, chunked, and embedded → embeddings stored in vector DB.

2. **User Query:**  
   User asks a question.

3. **Vector Retrieval:**  
   Query is embedded and run through similarity search.

4. **Context Augmentation:**  
   Retrieved chunks + history are appended to the prompt.

5. **LLM Response:**  
   LLM generates an accurate, grounded answer.

6. **Streaming:**  
   Response is streamed back to the frontend chat UI.

---

## ⚙️ Getting Started (Installation)

To run Ragzy locally, set up both the **Backend** and **Frontend**.

### 🔧 Prerequisites
- Node.js 18+  
- MongoDB Atlas or local MongoDB  
- API Keys (OpenAI / Groq / Together / Pinecone)

---

## 1️⃣ Backend Setup

```bash
cd Backend
npm install
````

### Create `.env` inside `Backend/`:

```
PORT=5000
MONGO_URI=your_mongo_uri
JWT_SECRET=your_secret_key
CLIENT_URL=http://localhost:5173

# Optional:
PINECONE_API_KEY=your_key
PINECONE_ENVIRONMENT=your_env
OPENAI_API_KEY=your_openai_key
GROQ_API_KEY=your_groq_key
```

### Run backend:

```bash
npm start
# Server runs on http://localhost:5000
```

---

## 2️⃣ Frontend Setup

```bash
cd ../Frontend
npm install
```

### Create `.env` inside `Frontend/`:

```
VITE_BACKEND_URL=http://localhost:5000
```

### Run frontend:

```bash
npm run dev
# Runs on http://localhost:5173
```

---

## 📁 Repository Structure

```bash
ragzy/
├── Backend/                    # Node.js / Express API (LLM calls, RAG processing)
│   ├── routes/
│   ├── controllers/
│   ├── documents/              # Uploaded files storage
│   └── .env
├── Frontend/                   # React / Vite Application (UI, chat, document manager)
│   ├── src/
│   ├── public/
│   └── .env
├── README.md
└── package.json                # Root dependency list
```

---

## 📄 License

This project is licensed under the **MIT License**.

---
