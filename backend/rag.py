from pypdf import PdfReader

import chromadb
from sentence_transformers import SentenceTransformer
from groq import Groq
from dotenv import load_dotenv
import os

load_dotenv()

client_groq = Groq(
    api_key=os.getenv("GROQ_API_KEY")
)

# ChromaDB
client = chromadb.PersistentClient(
    path="./chroma_db"
)

COLLECTION_NAME = "pdf_docs"

collection = client.get_or_create_collection(
    name=COLLECTION_NAME
)

# Embedding Model
model = SentenceTransformer(
    "all-MiniLM-L6-v2"
)


def extract_text(pdf_path):

    reader = PdfReader(pdf_path)

    text = ""

    for page in reader.pages:

        page_text = page.extract_text()

        if page_text:
            text += page_text + "\n"

    return text


def chunk_text(
    text,
    chunk_size=500,
    overlap=50
):
    """Split text into overlapping chunks so a sentence sitting on a
    chunk boundary still shows up in full in at least one chunk."""

    chunks = []
    step = max(chunk_size - overlap, 1)

    for i in range(0, len(text), step):

        chunk = text[i:i + chunk_size]

        if chunk.strip():
            chunks.append(chunk)

    return chunks


def reset_collection():
    """Wipe whatever was indexed before. This app only ever answers
    questions about the most recently uploaded PDF, so old chunks
    need to go - otherwise leftover chunks from a previous (e.g. test)
    upload keep getting matched against new questions."""

    global collection

    client.delete_collection(COLLECTION_NAME)
    collection = client.get_or_create_collection(name=COLLECTION_NAME)


def store_chunks(chunks):

    reset_collection()

    documents = []
    embeddings = []
    ids = []

    for i, chunk in enumerate(chunks):

        try:
            chunk = str(chunk)

            chunk = chunk.encode(
                "utf-8",
                errors="ignore"
            ).decode("utf-8")

            chunk = chunk.replace("\x00", "")

            embedding = model.encode(chunk)

            documents.append(chunk)
            embeddings.append(embedding.tolist())
            ids.append(f"chunk_{i}")

        except Exception as e:

            print(f"FAILED CHUNK: {i}")
            print("TYPE:", type(chunk))
            print("REPR:", repr(chunk))
            print("ERROR:", str(e))

            raise

    if not documents:
        return {"count": 0}

    try:
        collection.upsert(
            ids=ids,
            documents=documents,
            embeddings=embeddings
        )

    except Exception as e:
        print("UPSERT FAILED")
        print(str(e))
        raise

    return {
        "count": collection.count()
    }


def search_chunks(query, n_results=3):

    query_embedding = model.encode(query).tolist()

    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=min(n_results, max(collection.count(), 1))
    )

    return results["documents"][0]


def count_docs():
    return collection.count()


SYSTEM_PROMPT = """You are a helpful assistant that answers questions about a PDF the user has uploaded.

Rules:
- If the message is just a greeting or small talk (e.g. "hi", "hello", "thanks"), reply naturally and briefly, and invite the user to ask about the document. Don't force the document context into a greeting reply.
- When the user asks something about the document, answer only using the provided context.
- If the context doesn't contain the answer, say plainly that the document doesn't seem to cover that, instead of guessing.
- Keep answers concise and to the point.
"""


def generate_answer(question):

    if count_docs() == 0:
        return (
            "I don't have a PDF loaded yet — upload one and I'll be "
            "able to answer questions about it."
        )

    chunks = search_chunks(question)

    context = "\n\n".join(chunks)

    user_prompt = f"""Context from the document:
{context}

Question:
{question}

Answer:"""

    try:
        response = client_groq.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.3,
        )

    except Exception as e:
        return f"Sorry, I ran into a problem generating an answer: {e}"

    return response.choices[0].message.content