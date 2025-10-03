#!/bin/bash

BUILD_TARGET=prod ENV_FILE=.env.production NODE_ENV=production docker compose -f docker-compose.prod.yml up --build -d