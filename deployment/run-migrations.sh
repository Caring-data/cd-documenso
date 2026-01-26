#!/bin/sh

set -e

printf "🔄 Starting data migrations...\n\n"

# Change to scripts directory
cd /app/scripts

printf "📋 Step 1: Migrating templates...\n"
npx tsx migrations/migrate-templates.ts

if [ $? -ne 0 ]; then
    printf "❌ Template migration failed\n"
    exit 1
fi

printf "\n✅ Templates migration completed\n\n"

printf "📄 Step 2: Migrating documents...\n"
npx tsx migrations/migrate-documents.ts

if [ $? -ne 0 ]; then
    printf "❌ Documents migration failed\n"
    exit 1
fi

printf "\n✅ Documents migration completed\n\n"

printf "🎉 All migrations completed successfully!\n"
