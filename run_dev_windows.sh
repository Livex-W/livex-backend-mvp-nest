#!/usr/bin/env bash

# run_dev_windows.sh
# ------------------------------------------------------------
# Helper script to start the Livex backend in development mode on Windows.
# It uses Docker Compose (the newer "docker compose" CLI) and forces the
# "dev" profile so that the mailpit service is started automatically.
# The Docker Compose file already defines an anonymous volume:
#   - /app/node_modules
# This ensures the container uses Linux‑compiled node_modules, avoiding the
# "Exec format error" that occurs when Windows binaries are mounted.
# ------------------------------------------------------------

set -e

# Move to the directory where this script resides (project root)
cd "$(dirname "${BASH_SOURCE[0]}")"

# Export variables expected by docker‑compose.yml
export BUILD_TARGET=dev
export ENV_FILE=.env.development
export NODE_ENV=development

# Start the stack with the dev profile and rebuild images so that the
# node_modules volume is created with the correct binaries.
# "docker compose" works well on Windows (PowerShell, Git‑Bash, etc.).

docker compose --profile dev up --build
