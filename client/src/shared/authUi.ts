export const authRoutes = {
  login: "/login",
  signup: "/signup",
  verifyEmail: "/verify-email",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",
} as const;

export const authTitles = {
  login: "Welcome back",
  signup: "Join the briefing",
  forgot: "Recover access",
  reset: "Choose a new password",
  verify: "Verify your email",
} as const;

export type ReaderAuthMode = keyof typeof authTitles;
