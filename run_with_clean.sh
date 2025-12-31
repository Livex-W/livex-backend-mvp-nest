#!/bin/bash

docker compose --profile dev down --remove-orphans &&
docker volume rm livex-backend-mvp-nest_dbdata &&
./run_dev.sh