export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
};

export function appBaseUrl() {
  return (process.env.APP_BASE_URL || (ENV.isProduction ? "" : "http://localhost:3000")).replace(/\/$/, "");
}

export function validateProductionEnvironment() {
  if (!ENV.isProduction) return;
  const secret = process.env.JWT_SECRET || "";
  if (secret.length < 32 || /local|dev|placeholder|change[-_ ]?me|secret/i.test(secret)) {
    throw new Error("JWT_SECRET must be a strong, production-only secret of at least 32 characters.");
  }
  if (!appBaseUrl().startsWith("https://")) throw new Error("APP_BASE_URL must be an HTTPS production URL.");
}
