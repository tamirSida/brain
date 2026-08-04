# אלמוגים · המוח הארגוני — mock

A working prototype of the Organization Brain for Almogim: a Hebrew,
RTL, mobile-first dashboard over a company's connected systems, with a phone
remote that edits it by voice.

Next.js 16 (App Router) · Claude Sonnet 5 · Firestore · Tailwind v4.

---

## Running locally

```bash
npm install
cp .env.example .env.local     # then set ANTHROPIC_API_KEY
npm run dev                    # http://localhost:3000
```

Without `ANTHROPIC_API_KEY` the app still runs: onboarding falls back to a
fixed sample board so the UI is clickable, and the badge **נתוני הדגמה** says
so on screen. Everything that calls the model — chat, meeting prep, the phone
remote — returns a clear error instead.

### Testing the phone remote locally

The QR encodes `window.location.origin`, which on localhost is an address no
phone can reach. Set `NEXT_PUBLIC_TUNNEL_URL` to your tunnel and the QR falls
back to it:

```bash
ngrok http 3000
# put the https URL in .env.local as NEXT_PUBLIC_TUNNEL_URL, then restart dev
```

The tunnel is consulted **only** when the dashboard itself is open on
localhost. Deployed, the QR always uses the address you are looking at —
custom domain, `*.netlify.app`, or a deploy preview — so there is nothing to
switch when you go live, and leaving the variable set does no harm. The panel
prints the destination host under the code if you want to confirm it.

`next.config.ts` allows tunnel hosts as dev origins. Without that, Next blocks
cross-origin requests to `/_next/*` and the page renders with none of its
JavaScript — it looks correct and nothing works.

On an ngrok free tunnel the first visit from each device hits ngrok's
interstitial; tap **Visit Site** once. API calls already send
`ngrok-skip-browser-warning`, so only that first page load is affected.

---

## Deploying to Netlify

Connect the repository in the Netlify dashboard. The Next.js adapter is
provisioned automatically — `netlify.toml` only sets the Node version and
cache headers.

**Environment variables** (Site configuration → Environment variables):

| Variable | Required | Notes |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | yes | Server-only. Never prefix with `NEXT_PUBLIC_`. |
| `CLAUDE_MODEL` | no | Defaults to `claude-sonnet-5`. |
| `NEXT_PUBLIC_FIREBASE_*` | no | Defaults to the `ofek-brain` Firebase project. That is the infrastructure name, not branding — renaming it would point the app at a project that does not exist. |
| `NEXT_PUBLIC_TUNNEL_URL` | no | Ignored unless the dashboard is open on localhost, so it is safe either way. |

Firestore rules live in `firestore.rules` and deploy separately:

```bash
npx firebase deploy --only firestore:rules
```

### Authentication

Firebase Authentication, email/password, with **no service account**. Users are
created in the Firebase console; being a user there is the whole of the
authorisation model.

Sign-in happens in the browser with the public web config. The resulting ID
token is posted to `/api/auth/session`, which *verifies* it — against Google's
published signing keys, for this project, and for expiry — before setting an
httpOnly cookie. The proxy re-verifies that cookie on every request, so a
forged one is worthless. The Admin SDK is the usual way to check a token and it
needs a service-account key; it is not required, because Firebase signs ID
tokens with keys whose public halves Google publishes.

ID tokens expire after an hour. `AuthKeeper` mirrors the SDK's own refreshes
into the cookie, so a session doesn't drop to the login screen mid-demo.

**First-time project setup** — in the Firebase console:

1. Authentication → **Get started**
2. Sign-in method → **Email/Password** → Enable
3. Users → **Add user** — this is how everyone who should have access gets in

### Things to know before it goes public

- **Sign-in guards the app, not the database.** The Firestore rules are still
  open, and the project ID ships in the client bundle, so anyone going at
  Firestore directly is unaffected by the login. Tightening the rules would
  break the app as written, because the server writes sessions with the web
  SDK unauthenticated.
- **The phone remote is deliberately exempt from login.** It is reached by
  scanning a QR that only a signed-in dashboard can display, and the
  unguessable board ID is its credential — requiring a Firebase login on a
  handset mid-demo would defeat the handoff. The trade is real: a leaked board
  link works for anyone holding it.
- **The dashboard identity is still the onboarding email**, which is separate
  from the Firebase account. Signing in as one Firebase user and onboarding as
  a different email is possible and is not prevented.
- **All data is fictional.** The calendar, mailbox, connector inventory and
  every figure the model produces are demo content. The prompts explicitly
  instruct the model to answer from them rather than disclaim, so nothing on
  screen should be read as a real number.
- Route handlers run as Netlify serverless functions with a **60 second**
  synchronous limit that no plan can raise. Onboarding is the slowest path, at
  roughly 20 seconds.

---

## Layout of the code

```
app/
  onboarding/        name, role, and what matters to you
  dashboard/         the board, connector brain, agenda
  chat/              full conversation with history
  r/[boardId]/       phone remote — WhatsApp-shaped, voice first
  api/               onboard · brief · chat · prep · board/[id]{,/turn}
components/          cards, charts, brain graph, composer
lib/
  ai/                prompts and structured calls
  chat/              context windowing and summarisation
  store.ts           Firestore session store, memory fallback
  workspace.ts       the shared demo calendar and mailbox
config/
  connectors.json    connected systems — add one by dropping a logo here
  workspace.json     calendar, mail, and file contents
```

Design tokens are CSS custom properties in `app/globals.css`, swapped per
theme and mapped to Tailwind via `@theme inline`.
