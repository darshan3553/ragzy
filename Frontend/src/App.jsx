import { useState, useEffect, useRef } from "react";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL;
console.log("API_URL:", API_URL);

export default function App() {
  const [messages, setMessages] = useState([]);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const addMessage = (msg) => {
    setMessages((prev) => [...prev, msg]);
  };

  const handleFileUploaded = (fileInfo) => {
    setUploadedFiles((prev) => [...prev, fileInfo]);
  };

  

  const removeFile = (index) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans text-gray-800">
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
          body { font-family: 'Inter', sans-serif; }

          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .message-fade-in {
            animation: fadeIn 0.3s cubic-bezier(0.165, 0.84, 0.44, 1) forwards;
          }

          @keyframes pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: .4; transform: scale(0.8); }
          }
          .dot-pulse {
            animation: pulse 1.5s infinite;
          }
          .dot-pulse:nth-child(2) { animation-delay: 0.2s; }
          .dot-pulse:nth-child(3) { animation-delay: 0.4s; }

          .custom-scrollbar::-webkit-scrollbar { width: 8px; }
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background-color: #d1d5db;
            border-radius: 4px;
          }
        `}
      </style>

      {/* Header */}
      <header className="w-full p-4 bg-white shadow-lg flex items-center justify-center relative z-10">
        <h1 className="text-2xl font-bold text-indigo-700">📚 Chat with PDFs</h1>
        {/* + New Chat button removed per request */}
      </header>

      {/* Responsive Layout */}
      <div className="flex-1 flex overflow-hidden max-md:flex-col">
        
        {/* Sidebar */}
        <aside className="
          w-72 bg-white border-r border-gray-200 p-6 flex flex-col shadow-inner 
          overflow-y-auto custom-scrollbar
          max-md:w-full max-md:border-r-0 max-md:border-b max-md:p-4
        ">
          {/* File Upload */}
          <div className="mb-6">
            <FileUpload
              onFileUploaded={handleFileUploaded}
              setIsUploading={setIsUploading}
              isUploading={isUploading}
            />
          </div>

          {/* Uploaded PDFs */}
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Uploaded PDFs</h2>
          <div className="flex-1 overflow-y-auto space-y-3 pr-2">
            {uploadedFiles.length === 0 ? (
              <p className="text-gray-400 text-sm italic">No PDFs uploaded yet.</p>
            ) : (
              uploadedFiles.map((f, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 bg-indigo-50 rounded-lg text-sm transition-all hover:bg-indigo-100 shadow-sm"
                >
                  <span className="truncate text-indigo-800 font-medium">
                    {f.filename}
                  </span>
                  <div className="flex items-center space-x-2 ml-2">
                    <span className="text-xs text-gray-500">{f.pages} pages</span>
                    <button
                      onClick={() => removeFile(idx)}
                      className="text-gray-400 hover:text-red-500 transition-colors"
                      aria-label="Remove file"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4"
                        fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round"
                          strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* Main Chat Area */}
        <main className="flex-1 flex flex-col bg-slate-50">
          <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
            <ChatBox messages={messages} isLoading={isLoading} />
          </div>

          <div className="p-6 bg-white border-t border-gray-200 shadow-xl z-10">
            <SearchBar
              onSearch={addMessage}
              isLoading={isLoading}
              setIsLoading={setIsLoading}
            />
          </div>
        </main>
      </div>
    </div>
  );
}

/* ----------------- File Upload ----------------- */
function FileUpload({ onFileUploaded, setIsUploading, isUploading }) {
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState("");

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    setFile(selectedFile);
    setMessage(selectedFile ? `Selected: ${selectedFile.name}` : "");
  };

  const handleUpload = async () => {
    if (!file) {
      setMessage("Please select a PDF first!");
      return;
    }
    setIsUploading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await axios.post(`${API_URL}/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const info = {
        filename: res.data.filename,
        pages: res.data.num_pages,
        chunks: res.data.chunks,
      };

      setMessage(`✅ Uploaded: ${info.filename}`);
      onFileUploaded(info);
    } catch (err) {
      setMessage("❌ Upload failed: " + (err.response?.data?.error || err.message));
    } finally {
      setIsUploading(false);
      setFile(null);
    }
  };

  return (
    <div className="p-4 border border-gray-200 rounded-2xl bg-white shadow-sm">
      <label className="block mb-2 text-sm font-semibold text-gray-700">
        Upload PDF
      </label>
      <input
        type="file"
        accept="application/pdf"
        onChange={handleFileChange}
        className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 file:py-2 file:px-4 file:rounded-md"
      />
      <button
        onClick={handleUpload}
        disabled={!file || isUploading}
        className={`mt-3 w-full px-4 py-2 text-white rounded-xl shadow-md transition-all ${
          !file || isUploading
            ? "bg-gray-400 cursor-not-allowed"
            : "bg-green-600 hover:bg-green-700 active:scale-95"
        }`}
      >
        {isUploading ? "Uploading..." : "Upload & Process"}
      </button>
      {message && <p className="mt-2 text-xs text-center text-gray-500">{message}</p>}
    </div>
  );
}

/* ----------------- Search Bar ----------------- */
function SearchBar({ onSearch, isLoading, setIsLoading }) {
  const [question, setQuestion] = useState("");

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!question.trim() || isLoading) return;

    onSearch({ sender: "user", text: question });
    setQuestion("");
    setIsLoading(true);

    try {
      const res = await axios.post(`${API_URL}/ask`, { question });
      onSearch({ sender: "ai", text: res.data.answer });
    } catch {
      onSearch({
        sender: "ai",
        text: "Sorry, I couldn't get an answer. Please upload a PDF first.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSearch} className="relative">
      <input
        type="text"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        className="w-full px-5 py-3 pr-14 text-sm bg-gray-100 border border-gray-300 rounded-full"
        placeholder="Ask a question..."
        disabled={isLoading}
      />
      <button
        type="submit"
        disabled={!question.trim() || isLoading}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-indigo-600 text-white rounded-full"
      >
        →
      </button>
    </form>
  );
}

/* ----------------- Chat Box ----------------- */
function ChatBox({ messages, isLoading }) {
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  return (
    <div className="space-y-6">
      {messages.length === 0 ? (
        <div className="flex justify-center items-center h-full">
          <p className="text-gray-400 text-lg italic text-center">
            Upload a PDF and ask a question to get started.
            Refresh to new chat
          </p>
        </div>
      ) : (
        messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${
              msg.sender === "user" ? "justify-end" : "justify-start"
            } items-start message-fade-in`}
          >
            {msg.sender === "ai" && <span className="text-lg mr-2 mt-2">🤖</span>}

            <div
              className={`p-4 rounded-3xl max-w-[85%] md:max-w-xl shadow-md transition-all ${
                msg.sender === "user"
                  ? "bg-indigo-600 text-white rounded-br-none"
                  : "bg-white text-gray-900 border border-gray-100 rounded-bl-none"
              }`}
            >
              <div className="whitespace-pre-wrap">{msg.text}</div>
            </div>
          </div>
        ))
      )}

      {isLoading && (
        <div className="flex justify-start">
          <div className="p-4 rounded-3xl max-w-[85%] md:max-w-xl shadow-md bg-white text-gray-900 border border-gray-100 rounded-bl-none">
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-indigo-500 rounded-full dot-pulse"></div>
              <div className="w-2 h-2 bg-indigo-500 rounded-full dot-pulse"></div>
              <div className="w-2 h-2 bg-indigo-500 rounded-full dot-pulse"></div>
            </div>
          </div>
        </div>
      )}

      <div ref={chatEndRef} />
    </div>
  );
}
