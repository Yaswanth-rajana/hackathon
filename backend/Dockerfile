FROM python:3.11-slim

RUN groupadd -r nobody && useradd -r -g nobody nobody

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN chown -R nobody:nobody /app

USER nobody

CMD ["sh", "-c", "gunicorn -k uvicorn.workers.UvicornWorker -w $(expr 2 \\* $(nproc) + 1) -b 0.0.0.0:8000 --timeout 60 --graceful-timeout 30 app.main:app"]
