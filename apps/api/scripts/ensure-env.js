// Auto-creates apps/api/.env from .env.example if it doesn't exist yet, so
// a missing/forgotten `cp .env.example .env` step can't silently cause
// Prisma commands to fail with a confusing "DATABASE_URL not found" error.
// Runs automatically after `npm install` (see postinstall below) and again
// defensively before any prisma:* script.
const fs = require("fs");
const path = require("path");

const envPath = path.join(__dirname, "..", ".env");
const examplePath = path.join(__dirname, "..", ".env.example");

if (!fs.existsSync(envPath)) {
  fs.copyFileSync(examplePath, envPath);
  console.log("[vestara-api] Created apps/api/.env from .env.example (SQLite, no server needed).");
} else {
  console.log("[vestara-api] apps/api/.env already exists — leaving it as-is.");
}
