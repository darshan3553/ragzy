import { useState, useEffect, useRef } from "react";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL;
console.log("API_URL:", API_URL);

export default function App() {
  // persisted state (localStorage)
  const [messages, setMessages] = useState(() => {
    try {
      const raw = localStorage.getItem("ragzy_messages");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [uploadedFiles, setUploadedFiles] = useState(() => {
    try {
      const raw = localStorage.getItem("ragzy_uploadedFiles");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Toast state
  const [toast, setToast] = useState(null); // {type, text}
  const toastTimerRef = useRef(null);

  useEffect(() => {
    try {
      localStorage.setItem("ragzy_messages", JSON.stringify(messages));
    } catch (e) {
      console.error("persist messages err", e);
    }
  }, [messages]);

  useEffect(() => {
    try {
      localStorage.setItem("ragzy_uploadedFiles", JSON.stringify(uploadedFiles));
    } catch (e) {
      console.error("persist files err", e);
    }
  }, [uploadedFiles]);

  useEffect(() => {
    if (!toast) return;
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(toastTimerRef.current);
  }, [toast]);

  const addMessage = (msg) => {
    setMessages((prev) => [...prev, msg]);
  };

  const handleFileUploaded = (fileInfo) => {
    setUploadedFiles((prev) => {
      if (
        prev.some(
          (p) =>
            p.filename === fileInfo.filename &&
            p.pages === fileInfo.pages &&
            JSON.stringify(p.chunks) === JSON.stringify(fileInfo.chunks)
        )
      )
        return prev;
      return [...prev, fileInfo];
    });
    setToast({ type: "success", text: `Uploaded: ${fileInfo.filename}` });
  };

  const removeFile = (index) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
    setToast({ type: "success", text: "File removed" });
  };

  // ref to the chat scroll container (used by ChatBox scrollIntoView)
  const chatScrollRef = useRef(null);

  // Keep a CSS variable --vh in sync with actual viewport; helps when mobile keyboard is shown.
  useEffect(() => {
    const setVh = () => {
      const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
      document.documentElement.style.setProperty("--vh", `${vh}px`);
    };

    setVh();
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", setVh);
      window.visualViewport.addEventListener("scroll", setVh);
    }
    window.addEventListener("resize", setVh);

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", setVh);
        window.visualViewport.removeEventListener("scroll", setVh);
      }
      window.removeEventListener("resize", setVh);
    };
  }, []);

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans text-gray-800">
      <style>
        {`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        body { font-family: 'Inter', sans-serif; }

        :root {
          --header-h: 64px;   /* adjust to your header height if different */
          --search-h: 72px;   /* height of the fixed search bar */
          --sidebar-w: 18rem; /* 72 tailwind (w-72) */
          /* --vh is set dynamically via visualViewport (fallback to window.innerHeight) */
        }

        /* chat height computed from the current viewport (--vh). This allows mobile keyboard to resize view. */
        .chat-fixed-height {
          height: calc(var(--vh, 100vh) - var(--header-h) - var(--search-h) - env(safe-area-inset-bottom));
          overflow-y: auto;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .message-fade-in {
          animation: fadeIn 0.25s cubic-bezier(0.165,0.84,0.44,1) forwards;
        }

        @keyframes pulse {
          0%,100% { opacity:1; transform:scale(1); }
          50% { opacity:.4; transform:scale(0.8); }
        }
        .dot-pulse { animation: pulse 1.5s infinite; }
        .dot-pulse:nth-child(2) { animation-delay:0.2s; }
        .dot-pulse:nth-child(3) { animation-delay:0.4s; }

        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #d1d5db;
          border-radius: 4px;
        }

        /* fixed search bar (applies to all sizes) */
        .search-fixed {
          position: fixed;
          left: 0;
          right: 0;
          bottom: 0;
          height: var(--search-h);
          z-index: 50;
          background: rgba(255,255,255,0.98);
          border-top: 1px solid rgba(203,213,225,0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 8px 12px;
          backdrop-filter: saturate(120%) blur(4px);
        }

        /* desktop: shift left to leave space for sidebar */
        @media (min-width: 768px) {
          .search-fixed {
            left: var(--sidebar-w);
          }
        }

        /* make sure mobile stacked uploader is above the chat, but search is still fixed */
        .mobile-uploader-space {
          height: calc(var(--search-h) + 12px); /* small space so last messages not hidden */
        }

        /* toast */
        .toast {
          position: fixed;
          right: 16px;
          bottom: calc(var(--search-h) + 20px);
          z-index: 60;
          min-width: 200px;
          max-width: 320px;
          padding: 10px 14px;
          border-radius: 10px;
          box-shadow: 0 6px 20px rgba(2,6,23,0.12);
          font-size: 14px;
        }

        /* Search bar styling to match chat bubbles */
        .search-container {
          max-width: 1100px;      /* content width */
          width: 100%;
          margin: 0 auto;
          position: relative;
          padding: 0 24px;
        }

        .search-input {
          width: 100%;
          height: 56px;
          padding: 14px 64px 14px 20px; /* room for circular send button on right */
          border-radius: 28px;   /* pill */
          background: #f3f4f6;
          border: 1px solid rgba(209,213,219,0.6);
          font-size: 15px;
          line-height: 1;
          box-shadow: 0 1px 0 rgba(255,255,255,0.6) inset;
          box-sizing: border-box;
        }

        .search-send-btn {
          position: absolute;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
          width: 44px;
          height: 44px;
          border-radius: 9999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: #5b21b6;
          color: #fff;
          border: none;
          box-shadow: 0 6px 18px rgba(91,33,182,0.18);
          cursor: pointer;
        }

        .search-send-btn:disabled {
          background: #9ca3af;
          cursor: not-allowed;
          box-shadow: none;
        }

        .search-fixed, .search-container { padding-left: 0px; padding-right: 04px; }

        /* help mobile keyboard: ensure focused input is scrolled into view */
        input:focus {
          scroll-margin-bottom: 260px;
        }
      `}
      </style>

      {/* Header */}
      <header
        className="w-full p-4 bg-white shadow-lg flex items-center justify-center relative z-10"
        style={{ height: "var(--header-h)" }}
      >
        <h1 className="text-2xl font-bold text-indigo-700">📚 Chat with PDFs</h1>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Desktop sticky sidebar (md+) */}
        <aside
          className="
            hidden md:block
            w-72 bg-white border-r border-gray-200 p-6 flex flex-col
            shadow-inner
          "
          style={{
            position: "sticky",
            top: "var(--header-h)",
            height: "calc(100vh - var(--header-h))",
            alignSelf: "flex-start",
            overflowY: "auto",
          }}
        >
          <div className="mb-6">
            <FileUpload
              onFileUploaded={handleFileUploaded}
              setIsUploading={setIsUploading}
              isUploading={isUploading}
              setToast={setToast}
            />
          </div>

          <div className="mt-2">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Uploaded PDFs</h2>
            <div className="space-y-3 pr-2">
              {uploadedFiles.length === 0 ? (
                <p className="text-gray-400 text-sm italic">No PDFs uploaded yet.</p>
              ) : (
                uploadedFiles.map((f, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 bg-indigo-50 rounded-lg text-sm transition-all hover:bg-indigo-100 shadow-sm"
                  >
                    <span className="truncate text-indigo-800 font-medium">{f.filename}</span>
                    <div className="flex items-center space-x-2 ml-2">
                      <span className="text-xs text-gray-500">{f.pages} pages</span>
                      <button
                        onClick={() => removeFile(idx)}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                        aria-label="Remove file"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>

        {/* Main column */}
        <div className="flex-1 flex flex-col">
          {/* Mobile uploader (flows with page). On desktop this is hidden. */}
          <div className="md:hidden bg-white border-b border-gray-200 p-4">
            <div className="mb-3">
              <FileUpload
                onFileUploaded={handleFileUploaded}
                setIsUploading={setIsUploading}
                isUploading={isUploading}
                setToast={setToast}
              />
            </div>
            <h2 className="text-sm font-semibold text-gray-700 mb-2">Uploaded PDFs</h2>
            <div className="space-y-2">
              {uploadedFiles.length === 0 ? (
                <p className="text-gray-400 text-sm italic">No PDFs uploaded yet.</p>
              ) : (
                uploadedFiles.map((f, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-indigo-50 rounded-lg">
                    <div>
                      <div className="truncate text-indigo-800 font-medium">{f.filename}</div>
                      <div className="text-xs text-gray-500">{f.pages} pages</div>
                    </div>
                    <button onClick={() => removeFile(idx)} className="text-gray-400 hover:text-red-500">✕</button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Chat area that has a fixed height computed from --vh so keyboard doesn't hide content.
              On desktop this is a visible scroll area; on mobile this also fits above the fixed search bar. */}
          <div
            ref={chatScrollRef}
            className="bg-slate-50 p-8 custom-scrollbar chat-fixed-height"
            style={{ paddingBottom: 16 }}
          >
            <ChatBox messages={messages} isLoading={isLoading} />

            {/* on mobile we add small spacer to avoid last message flush under things */}
            <div style={{ height: 8 }} />
          </div>
        </div>
      </div>

      {/* SEARCH BAR fixed for both desktop & mobile */}
      <div className="search-fixed">
        <div className="max-w-4xl w-full mx-auto">
          <SearchBar
            onSearch={(msg) => addMessage(msg)}
            isLoading={isLoading}
            setIsLoading={setIsLoading}
          />
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className="toast"
          style={{
            background: toast.type === "success" ? "#ecfdf5" : "#fff1f2",
            color: toast.type === "success" ? "#065f46" : "#9f1239",
            border: toast.type === "success" ? "1px solid #bbf7d0" : "1px solid #fecaca",
          }}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}

/* ----------------- File Upload ----------------- */
function FileUpload({ onFileUploaded, setIsUploading, isUploading, setToast }) {
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
        uploadedAt: new Date().toISOString(),
      };

      setMessage(`✅ Uploaded: ${info.filename}`);
      onFileUploaded(info);
      if (setToast) setToast({ type: "success", text: `Uploaded: ${info.filename}` });
    } catch (err) {
      const errMsg = "❌ Upload failed: " + (err.response?.data?.error || err.message);
      setMessage(errMsg);
      if (setToast) setToast({ type: "error", text: "Upload failed" });
    } finally {
      setIsUploading(false);
      setFile(null);
    }
  };

  return (
    <div className="p-4 border border-gray-200 rounded-2xl bg-white shadow-sm">
      <label className="block mb-2 text-sm font-semibold text-gray-700">Upload PDF</label>
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
          !file || isUploading ? "bg-gray-400 cursor-not-allowed" : "bg-green-600 hover:bg-green-700 active:scale-95"
        }`}
      >
        {isUploading ? "Uploading..." : "Upload & Process"}
      </button>
      {message && <p className="mt-2 text-xs text-center text-gray-500">{message}</p>}
    </div>
  );
}

/* ----------------- Search Bar ----------------- */
/* This SearchBar auto-focuses on mount, after sending and after response */
function SearchBar({ onSearch, isLoading, setIsLoading }) {
  const [question, setQuestion] = useState("");
  const inputRef = useRef(null);

  // Auto-focus when component mounts
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // If loading finishes, refocus (so cursor ready)
  useEffect(() => {
    if (!isLoading) {
      // small timeout to avoid race with re-render
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [isLoading]);

  const handleSearch = async (e) => {
    e && e.preventDefault();
    if (!question.trim() || isLoading) return;

    // add the user's message immediately
    onSearch({ sender: "user", text: question, ts: new Date().toISOString() });

    // clear input and refocus quickly
    const q = question;
    setQuestion("");
    inputRef.current?.focus();

    setIsLoading(true);

    try {
      const res = await axios.post(`${API_URL}/ask`, { question: q });
      onSearch({ sender: "ai", text: res.data.answer, ts: new Date().toISOString() });
    } catch {
      onSearch({
        sender: "ai",
        text: "Sorry, I couldn't get an answer. Please upload a PDF first.",
        ts: new Date().toISOString(),
      });
    } finally {
      setIsLoading(false);
      // ensure the input regains focus after the response
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  };

  return (
    <form onSubmit={handleSearch} className="search-container" aria-label="Ask a question">
      <input
        ref={inputRef}
        type="text"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        className="search-input"
        placeholder="Ask a question..."
        disabled={isLoading}
        aria-label="Question"
      />

      <button
        type="submit"
        className="search-send-btn"
        disabled={!question.trim() || isLoading}
        aria-label="Send question"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="22" y1="2" x2="11" y2="13"></line>
          <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
        </svg>
      </button>
    </form>
  );
}

/* ----------------- Chat Box ----------------- */
function ChatBox({ messages, isLoading }) {
  const chatEndRef = useRef(null);

  useEffect(() => {
    // scroll latest message into view inside the chat scroll container
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
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
            className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"} items-start message-fade-in`}
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
