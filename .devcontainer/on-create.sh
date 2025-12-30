#!/usr/bin/env bash

# Install dependencies
pnpm install

# Copy the env file
cp .env.example .env

# Run the dev setup
pnpm run dx
