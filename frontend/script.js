const API_BASE = "https://vlad0009-pdf-chatbot-backend.hf.space";

document.addEventListener("DOMContentLoaded", () => {

    const pdfInput       = document.getElementById("pdfFile");
    const dropzone        = document.getElementById("dropzone");
    const fileChip         = document.getElementById("fileChip");
    const fileNameEl        = document.getElementById("fileName");
    const fileSizeEl         = document.getElementById("fileSize");
    const removeFileBtn       = document.getElementById("removeFile");
    const uploadBtn             = document.getElementById("uploadBtn");
    const statusEl               = document.getElementById("status");
    const chatBox                  = document.getElementById("chat-box");
    const emptyState                = document.getElementById("emptyState");
    const questionInput              = document.getElementById("question");
    const sendBtn                      = document.getElementById("sendBtn");
    const activeDocName                 = document.getElementById("activeDocName");

    let selectedFile = null;

    // ---------- small helpers ----------

    function formatBytes(bytes) {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    function setStatus(message, type) {
        statusEl.textContent = message;
        statusEl.className = "status";
        if (type) {
            statusEl.classList.add("is-visible", `status--${type}`);
        }
    }

    function resetUploadButton() {
        uploadBtn.disabled = false;
        uploadBtn.textContent = "Upload PDF";
        uploadBtn.classList.remove("uploaded");
    }

    function setFile(file) {
        selectedFile = file;
        fileNameEl.textContent = file.name;
        fileSizeEl.textContent = formatBytes(file.size);
        fileChip.hidden = false;
        setStatus("", null);

        // a fresh file always gets a fresh, clickable button -
        // otherwise a second upload after a successful first one
        // would find the button stuck on "Document Uploaded"
        resetUploadButton();

        appendMessage(
            "bot",
            `📄 Selected "${file.name}". Click "Upload PDF" to process it.`
        );
    }

    function clearFile() {
        selectedFile = null;
        pdfInput.value = "";
        fileChip.hidden = true;
        uploadBtn.textContent = "Upload PDF";
        uploadBtn.classList.remove("uploaded");
        uploadBtn.disabled = true;
    }

    function appendMessage(role, text) {
        if (emptyState && emptyState.isConnected) {
            emptyState.remove();
        }

        const wrapper = document.createElement("div");
        wrapper.className = `message message--${role}`;

        const label = document.createElement("span");
        label.className = "message-label";
        label.textContent = role === "user" ? "You" : "Assistant";

        const bubble = document.createElement("div");
        bubble.className = "message-bubble";
        bubble.textContent = text;

        wrapper.append(label, bubble);
        chatBox.appendChild(wrapper);
        chatBox.scrollTop = chatBox.scrollHeight;

        return wrapper;
    }

    function showLoadingBubble() {
        const wrapper = document.createElement("div");
        wrapper.className = "message message--bot";
        wrapper.id = "loading";

        const label = document.createElement("span");
        label.className = "message-label";
        label.textContent = "Assistant";

        const bubble = document.createElement("div");
        bubble.className = "message-bubble loading-dots";
        bubble.innerHTML = "<span></span><span></span><span></span>";

        wrapper.append(label, bubble);
        chatBox.appendChild(wrapper);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    // ---------- initial state ----------

    appendMessage(
        "bot",
        "👋 Welcome to PDF Chatbot.\n\nUpload a PDF on the left and I'll help you explore its contents. Once it's loaded you can ask for:\n• Summaries\n• Key topics\n• Definitions\n• Explanations of specific sections"
    );

    // ---------- file selection ----------

    pdfInput.addEventListener("change", () => {
        const file = pdfInput.files[0];
        if (file) setFile(file);
    });

    ["dragover", "dragenter"].forEach((evt) =>
        dropzone.addEventListener(evt, (e) => {
            e.preventDefault();
            dropzone.classList.add("dragover");
        })
    );

    ["dragleave", "dragend"].forEach((evt) =>
        dropzone.addEventListener(evt, () => dropzone.classList.remove("dragover"))
    );

    dropzone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropzone.classList.remove("dragover");
        const file = e.dataTransfer.files[0];
        if (file) {
            pdfInput.files = e.dataTransfer.files;
            setFile(file);
        }
    });

    removeFileBtn.addEventListener("click", (e) => {
        e.preventDefault();
        clearFile();
    });

    // ---------- upload ----------

    async function uploadPDF() {
        if (!selectedFile) return;

        const formData = new FormData();
        formData.append("file", selectedFile);

        uploadBtn.disabled = true;
        setStatus("Uploading PDF…", "loading");

        appendMessage(
            "bot",
            `⏳ Processing "${selectedFile.name}"...\n\nExtracting text and preparing the document for questions.`
        );

        try {
            const response = await fetch(`${API_BASE}/upload`, {
                method: "POST",
                body: formData
            });

            const data = await response.json();

            if (!response.ok || data.error) {
                throw new Error(data.error || `Server responded ${response.status}`);
            }

            setStatus("PDF uploaded — ready to chat", "success");

            uploadBtn.textContent = "Document Uploaded";
            uploadBtn.disabled = true;
            uploadBtn.classList.add("uploaded");

            if (activeDocName) {
                activeDocName.textContent = data.filename || selectedFile.name;
            }

            appendMessage(
                "bot",
                `📄 ${data.filename || selectedFile.name} uploaded successfully.\n\nTry asking:\n• What is this document about?\n• Summarize this document\n• List the key topics\n• Explain a specific section`
            );

        } catch (error) {
            console.error(error);
            setStatus(error.message || "Upload failed. Check the server and try again.", "error");
            resetUploadButton();
        }
    }

    uploadBtn.addEventListener("click", uploadPDF);

    // ---------- chat ----------

    async function askQuestion() {
        const question = questionInput.value.trim();
        if (!question) return;

        appendMessage("user", question);
        questionInput.value = "";
        showLoadingBubble();

        try {
            const response = await fetch(`${API_BASE}/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ question })
            });

            if (!response.ok) throw new Error(`Server responded ${response.status}`);

            const data = await response.json();
            document.getElementById("loading")?.remove();
            appendMessage("bot", data.answer);

        } catch (error) {
            console.error(error);
            document.getElementById("loading")?.remove();
            appendMessage("bot", "Something went wrong getting a response. Please try again.");
        }
    }

    sendBtn.addEventListener("click", askQuestion);

    questionInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            askQuestion();
        }
    });

});