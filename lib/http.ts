/**
 * Client-side fetch for this app's own API.
 *
 * The only thing it adds is `ngrok-skip-browser-warning`. When the demo is
 * served through an ngrok free tunnel, ngrok answers browser requests with an
 * HTML interstitial instead of the real response — which turns every API call
 * into a JSON parse error on the phone. The header opts out of it; ngrok
 * ignores the header everywhere else, so this is safe in all environments.
 *
 * The interstitial on the *initial page load* cannot be avoided this way: that
 * request is made by the browser before any of our code runs, so the visitor
 * taps through it once per device.
 */
export function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  return fetch(input, {
    ...init,
    headers: { ...init.headers, "ngrok-skip-browser-warning": "1" },
  });
}
