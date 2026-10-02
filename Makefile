up:    ; test -f .env || cp .env.example .env; docker compose up -d --build
down:  ; docker compose down
logs:  ; docker compose logs -f backend
reset: ; docker compose down -v
backup:
	@mkdir -p backups
	@backup_file="backups/gestion-tecnica-$$(date +%Y%m%d-%H%M%S).sql"; docker compose exec -T db sh -c 'pg_dump -U "$$POSTGRES_USER" "$$POSTGRES_DB"' > "$$backup_file" && echo "Respaldo creado: $$backup_file"
