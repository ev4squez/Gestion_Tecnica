# Repository Guidelines

## Project Structure

- `backend/app/` contains the FastAPI application, SQLAlchemy models, database setup, and authentication helpers.
- `frontend/src/` contains the React/TypeScript interface and its CSS. Vite configuration and the Nginx production config are in `frontend/`.
- `docker-compose.yml` defines PostgreSQL, API, and frontend services. `Makefile` provides common container commands.
- The workbook `ANEXO 33 DEL 05 DE JUNIO DE 2025 V4.xls` is a source for machine inventory import. Preserve it.
- No test suite is currently defined.

## Build and Development

- `make up` creates `.env` from `.env.example` if needed, then builds and starts Docker services.
- `make down` stops the services; `make logs` follows backend logs. Avoid `make reset` unless deleting the database volume is intentional.
- For frontend development, run `cd frontend && npm install && npm run dev`. Vite proxies `/api` to `localhost:8000`.
- `cd frontend && npm run build` creates the production bundle. Local API docs: `http://localhost:8000/docs`.

## Code Style and Architecture

- Use four spaces for Python indentation and follow existing FastAPI dependency, Pydantic validation, and SQLAlchemy model patterns.
- Use TypeScript/React functional components and camelCase for variables and functions. Keep user-facing text in Spanish and reuse existing UI classes and components where practical.
- Keep API changes in `backend/app/main.py` and schema changes in `backend/app/models.py`. Update both API usage and UI when adding or changing a workflow.
- Treat interventions as append-only bitácora records and tickets as independently managed requests. Preserve audit history and avoid silently inventing or normalizing historical asset data.

## Validation

- There is no configured test or lint command. Before submitting frontend changes, run `npm run build` from `frontend/`.
- Check Python syntax with `python -m compileall -q backend/app`. For end-to-end checks, run `docker compose up -d --build` and inspect the relevant UI and API route.

## Commits and Pull Requests

- Git history is unavailable, so no repository-specific commit convention could be verified. Use concise imperative messages, such as `Add intervention filters`.
- PRs should describe user-visible behavior and schema/API changes, list validation performed, and include screenshots for interface changes. Never commit `.env`, credentials, or generated `frontend/dist/` output.

## Configuration and Data Safety

- Configure credentials in local `.env`; change the example passwords and JWT secret before use.
- Database schema is currently initialized with SQLAlchemy `create_all` at startup. Review existing-data impact before changing models; do not erase database volumes during routine development.
