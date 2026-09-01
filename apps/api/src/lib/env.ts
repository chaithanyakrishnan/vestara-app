import "dotenv/config";

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required("DATABASE_URL"),
  jwtAccessSecret: required("JWT_ACCESS_SECRET"),
  jwtRefreshSecret: required("JWT_REFRESH_SECRET"),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  uploadDir: process.env.UPLOAD_DIR ?? "./uploads",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || null,
  // Unset in dev: esign.service then runs the send in SIMULATED mode instead
  // of calling DocuSign. See that file for the contract.
  docusignAccountId: process.env.DOCUSIGN_ACCOUNT_ID || null,
  docusignIntegrationKey: process.env.DOCUSIGN_INTEGRATION_KEY || null,
};
