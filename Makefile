COMPOSE := docker compose
DEV := -f docker-compose.dev.yml
STG := -f docker-compose.staging.yml

.PHONY: help env proxy-net dev dev-down staging staging-down

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

env: ## Create .env from .env.example if missing
	@test -f .env || cp .env.example .env

dev: env ## Rebuild image + start dev env (fresh seeded DB) on :8000
	$(COMPOSE) $(DEV) down -v
	$(COMPOSE) $(DEV) up --build -d

dev-down: ## Stop dev env + wipe its DB volume
	$(COMPOSE) $(DEV) down -v

proxy-net: ## Ensure the shared external "proxy" network exists
	@docker network inspect proxy >/dev/null 2>&1 || docker network create proxy

staging: env proxy-net ## Rebuild image + start staging env (persistent DB) on :8001
	$(COMPOSE) $(STG) up --build -d

staging-down: ## Stop staging env (keep DB volume)
	$(COMPOSE) $(STG) down
