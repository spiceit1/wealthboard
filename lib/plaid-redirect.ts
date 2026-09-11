// Only trusted deployment configuration may determine the OAuth destination.
// Never accept a redirect from the request body or forwarded Host headers.
export function getPlaidRedirectUri(config: { URL?: string; APP_URL?: string } = { URL: process.env.URL, APP_URL: process.env.APP_URL }) {
  for (const candidate of [config.URL, config.APP_URL]) {
    if (!candidate) continue;
    try {
      const url = new URL(candidate);
      if (url.protocol !== 'https:' || url.username || url.password) continue;
      return new URL('/connections', url.origin).toString();
    } catch { /* Try the next trusted configuration value. */ }
  }
  throw new Error('Configure the deployed HTTPS site URL before connecting a bank.');
}
