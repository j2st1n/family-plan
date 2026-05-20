FROM node:22-alpine AS frontend
WORKDIR /app
COPY src/parent-web/package.json src/parent-web/package-lock.json ./parent-web/
COPY src/child-pwa/package.json src/child-pwa/package-lock.json ./child-pwa/
RUN cd parent-web && npm ci && cd ../child-pwa && npm ci
COPY src/parent-web/index.html src/parent-web/vite.config.js ./parent-web/
COPY src/parent-web/src ./parent-web/src
COPY src/child-pwa/index.html src/child-pwa/vite.config.js ./child-pwa/
COPY src/child-pwa/src ./child-pwa/src
COPY src/child-pwa/public ./child-pwa/public
RUN cd parent-web && npm run build && cd ../child-pwa && npm run build

FROM python:3.11-slim
WORKDIR /app

RUN groupadd -g 1000 app \
    && useradd -u 1000 -g 1000 -m app \
    && mkdir -p /app/static \
    && chown -R app:app /app

COPY --from=frontend /app/parent-web/dist /app/static-built/parent
COPY --from=frontend /app/child-pwa/dist /app/static-built/child
RUN mkdir -p /app/static-built/assets && cp -r /app/static-built/parent/assets/* /app/static-built/assets/ && cp -r /app/static-built/child/assets/* /app/static-built/assets/

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
