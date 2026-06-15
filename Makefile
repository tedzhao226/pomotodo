COMPOSE := docker compose
DEV := -f docker-compose.dev.yml
STG := -f docker-compose.staging.yml

.PHONY: help env dev dev-down dev-logs staging staging-down staging-logs test test-api test-web

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

env: ## Create .env from .env.example if missing
	@test -f .env || cp .env.example .env

dev: env ## Build + start the dev env (seeded mock data) on :8000
	$(COMPOSE) $(DEV) up --build -d

dev-down: ## Stop the dev env (keeps its data volume)
	$(COMPOSE) $(DEV) down

dev-logs: ## Tail dev env logs
	$(COMPOSE) $(DEV) logs -f

staging: env ## Build + start the staging env (clean DB) on :8001
	$(COMPOSE) $(STG) up --build -d

staging-down: ## Stop the staging env (keeps its data volume)
	$(COMPOSE) $(STG) down

staging-logs: ## Tail staging env logs
	$(COMPOSE) $(STG) logs -f

test: test-api test-web ## Run all tests

test-api: ## Run backend tests (pytest)
	uv run pytest -q

test-web: ## Run frontend tests (vitest)
	npm test
