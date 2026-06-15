COMPOSE := docker compose
DEV := -f docker-compose.dev.yml
STG := -f docker-compose.staging.yml

.PHONY: help env dev staging

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

env: ## Create .env from .env.example if missing
	@test -f .env || cp .env.example .env

dev: env ## Build + start the dev env (seeded mock data) on :8000
	$(COMPOSE) $(DEV) up --build -d

staging: env ## Build + start the staging env (clean DB) on :8001
	$(COMPOSE) $(STG) up --build -d
