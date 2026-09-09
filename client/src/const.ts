import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Start login through the backend. Keeping OAuth configuration and state
// creation server-side avoids requiring VITE_APP_ID / VITE_OAUTH_PORTAL_URL
// in every Vercel build environment and keeps the OAuth nonce out of JS.
export const startLogin = () => {
  window.location.assign("/api/oauth/login");
};
