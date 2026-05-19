FROM python:3.11-slim

WORKDIR /app

RUN groupadd -g 1000 app \
    && useradd -u 1000 -g 1000 -m app \
    && mkdir -p /app/data \
    && chown -R app:app /app

COPY src/backend/pyproject.toml src/backend/README.md ./
RUN pip install --no-cache-dir -e .

COPY src/backend/app ./app
COPY src/backend/alembic.ini ./alembic.ini
COPY src/backend/alembic ./alembic
COPY VERSION ./

RUN chown -R app:app /app

USER app

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
