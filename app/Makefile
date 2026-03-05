# app/Makefile — EZAgent Chat App Build System
#
# Canonical build targets. Use these instead of calling pnpm/tsc/electron-builder
# directly. A PreToolUse hook enforces this in Claude Code sessions.
#
# Usage:
#   make              — Show help
#   make package      — Build .app
#   make dmg          — Build DMG installer
#   make install      — Package + install to /Applications
#   make test         — Run unit tests
#   make test-e2e     — Run E2E tests

.DEFAULT_GOAL := help
.PHONY: build build-electron package dmg install test test-e2e clean deps help

# --- Paths ---
DIST_ELECTRON := dist-electron
OUT_DIR       := out
RELEASE_DIR   := release
APP_NAME      := EZAgent
APP_PATH      := $(RELEASE_DIR)/mac-arm64/$(APP_NAME).app
DMG_PATH      := $(RELEASE_DIR)/$(APP_NAME)-0.1.0-arm64.dmg
INSTALL_PATH  := /Applications/$(APP_NAME).app

# --- Targets ---

help: ## Show available targets
	@echo "EZAgent Chat App — Build Targets"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

deps: ## Install dependencies
	pnpm install

build: ## Build Next.js static export
	pnpm run build

build-electron: build ## Build Next.js + compile Electron TypeScript
	pnpm exec tsc -p electron/tsconfig.json

package: build-electron ## Package .app (no DMG)
	pnpm exec electron-builder --mac --dir

dmg: build-electron ## Build DMG installer
	pnpm exec electron-builder --mac dmg

install: package ## Package + install to /Applications
	rm -rf "$(INSTALL_PATH)"
	cp -R "$(APP_PATH)" "$(INSTALL_PATH)"
	@echo "✓ Installed to $(INSTALL_PATH)"

test: ## Run unit tests (Vitest)
	pnpm test

test-e2e: ## Run E2E tests (Playwright, requires installed app)
	pnpm test:e2e

lint: ## Run linter
	pnpm run lint

clean: ## Remove build artifacts
	rm -rf $(DIST_ELECTRON) $(OUT_DIR) $(RELEASE_DIR) .next
	@echo "✓ Cleaned"
