FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir --default-timeout=100 --retries 5 -r requirements.txt

COPY . .

RUN addgroup --gid 1001 appgroup && \
    adduser --uid 1001 --gid 1001 --no-create-home --disabled-password --gecos "" appuser

USER appuser

EXPOSE 8002

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8002/health')"

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8002"]
