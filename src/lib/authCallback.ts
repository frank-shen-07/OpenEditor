/** True when the URL contains tokens from a Supabase OAuth redirect. */
export function hasOAuthCallbackHash(): boolean {
  const hash = window.location.hash;
  return hash.includes("access_token=") || hash.includes("error=") || hash.includes("error_description=");
}

export function clearOAuthHashFromUrl() {
  if (!window.location.hash) return;
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
}
