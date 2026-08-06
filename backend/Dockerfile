FROM python:3.11-slim

WORKDIR /app
ENV PYTHONUNBUFFERED=1

# tesseract-ocr backs the PDF extractor's OCR fallback for scanned/image-only pages.
RUN apt-get update \
    && apt-get install --no-install-recommends -y tesseract-ocr \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Bake the embedding model into the image at build time instead of
# downloading it on the first real request -- avoids first-request latency
# and a runtime dependency on outbound network access to Hugging Face.
RUN python -c "from fastembed import TextEmbedding; TextEmbedding(model_name='BAAI/bge-small-en-v1.5')"

COPY . .

CMD ["sh", "-c", "python -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
