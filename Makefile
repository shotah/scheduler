# Scheduler Project Makefile
.PHONY: help install start test test-unit test-e2e test-all clean dev setup

# Default target
help:
	@echo "Scheduler - P2P Task Management"
	@echo ""
	@echo "Available commands:"
	@echo "  make install     Install dependencies"
	@echo "  make setup       Full project setup (install + playwright)"
	@echo "  make start       Start development servers"
	@echo "  make dev         Start development servers (alias)"
	@echo "  make test        Run unit tests"
	@echo "  make test-unit   Run unit tests only"
	@echo "  make test-e2e    Run E2E tests (automated)"
	@echo "  make test-all    Run all tests"
	@echo "  make clean       Kill all node processes"
	@echo "  make build       Build for production"
	@echo ""

# Installation and setup
install:
	npm install

setup: install
	npx playwright install
	@echo "✅ Setup complete! Run 'make start' to begin development."

# Development
start:
	npm start

dev: start

# Testing
test: test-unit

test-unit:
	npm test

test-e2e:
	@echo "🚀 Running automated E2E tests..."
	npm run test:e2e

test-e2e-ts:
	@echo "🚀 Running E2E tests with TypeScript runner..."
	npm run test:e2e:ts

test-all:
	npm run test:all

# Production
build:
	npm run build

# Cleanup
clean:
ifeq ($(OS),Windows_NT)
	@echo "🧹 Cleaning up Windows processes..."
	-taskkill /F /IM node.exe 2>nul || echo "No node processes to kill"
else
	@echo "🧹 Cleaning up Unix processes..."
	-pkill -f "vite|wrangler" || echo "No processes to kill"
endif

# Network info (Windows specific)
network:
ifeq ($(OS),Windows_NT)
	npm run network:info
	npm run network:urls
else
	@echo "Network info is Windows-specific. Use 'ifconfig' or 'ip addr' on Unix systems."
endif

# Upgrade dependencies
upgrade:
	npm run upgrade

upgrade-check:
	npm run upgrade:check
