---
title: PDF Chatbot
emoji: 📄
colorFrom: blue
colorTo: green
sdk: docker
app_port: 7860
---

# PDF Chatbot backend

FastAPI + ChromaDB + sentence-transformers + Groq backend for the PDF Chatbot.
Upload a PDF via `/upload`, then ask questions about it via `/chat`.

Set `GROQ_API_KEY` under this Space's Settings → Variables and secrets before
using it - it isn't included in this repo.
