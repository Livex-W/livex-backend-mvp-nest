#!/bin/bash

BUILD_TARGET=prod ENV_FILE=.env NODE_ENV=production docker compose -f docker-compose.prod.yml up --build -d