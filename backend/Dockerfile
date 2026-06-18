# Hugging Face Spaces (Docker SDK) expects the app to listen on port 7860,
# and runs the container as a non-root user - this template follows their
# standard pattern.

FROM python:3.11

RUN useradd -m -u 1000 user
USER user
ENV PATH="/home/user/.local/bin:$PATH"

WORKDIR /app

COPY --chown=user ./requirements.txt requirements.txt

# Install the CPU-only build of torch first. sentence-transformers depends
# on torch, and pip's default wheel is the much larger CUDA build - there's
# no GPU here, so this keeps the image smaller and the build faster.
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu && \
    pip install --no-cache-dir --upgrade -r requirements.txt

COPY --chown=user . /app

EXPOSE 7860

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860"]
