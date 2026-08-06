FROM python:3.11-slim

WORKDIR /app
ENV PYTHONUNBUFFERED=1

# tesseract-ocr backs the PDF extractor's OCR fallback for scanned/image-only pages.
RUN apt-get update \
    && apt-get install --no-install-recommends -y tesseract-ocr \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["sh", "-c", "python -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
