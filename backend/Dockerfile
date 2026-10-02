FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1
WORKDIR /srv
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app app
COPY assets assets
COPY alembic.ini .
COPY migrations migrations
RUN useradd -m appuser
USER appuser
CMD ["uvicorn","app.main:app","--host","0.0.0.0","--port","8000"]
