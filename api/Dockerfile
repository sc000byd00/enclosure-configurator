# API for the enclosure configurator. Runs as a Hugging Face Docker Space (port 7860)
# or anywhere else that runs a container.
FROM python:3.12-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends git libgl1 libglib2.0-0 libxrender1 \
    && rm -rf /var/lib/apt/lists/*

RUN useradd -m -u 1000 user
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app

USER user
ENV CACHE_DIR=/tmp/enclosure-cache \
    PORT=7860 \
    ALLOWED_ORIGINS=http://localhost:3000
EXPOSE 7860
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --proxy-headers --forwarded-allow-ips='*'"]
