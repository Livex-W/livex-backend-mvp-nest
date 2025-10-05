#!/bin/bash

BUILD_TARGET=dev ENV_FILE=.env.development NODE_ENV=development docker compose --profile dev up --build -d