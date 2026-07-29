# אופק · המוח הארגוני — mock

A working prototype of the Organization Brain for Ofek Holdings: a Hebrew,
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
| `DEMO_PASSWORD` | **yes, on any public URL** | The shared demo password. Unset means no gate at all. |
| `CLAUDE_MODEL` | no | Defaults to `claude-sonnet-5`. |
| `NEXT_PUBLIC_FIREBASE_*` | no | Defaults to the `ofek-brain` project, baked into `lib/store.ts`. |
| `NEXT_PUBLIC_TUNNEL_URL` | **no — leave unset** | Local-only escape hatch. In production the QR uses the real origin. |

Firestore rules live in `firestore.rules` and deploy separately:

```bash
npx firebase deploy --only firestore:rules
```

### The demo gate

`DEMO_PASSWORD` puts one shared password in front of everything. It is site
access, not identity: passing it grants no session, and onboarding still asks
who you are. Nothing is stored per visitor — the cookie is the whole record.

The QR carries the token, so scanning it from the dashboard admits the phone
without anyone typing a password in front of the room. The token is stripped
from the URL immediately and moved into a cookie, so it does not linger in
browser history or in a screenshot of the address bar.

Leaving `DEMO_PASSWORD` unset disables the gate. That keeps local development
frictionless and means a missing variable fails open rather than locking
everyone out mid-demo — so **set it deliberately on anything public.**

### Things to know before it goes public

- **The gate is the only authentication.** Behind it there are no accounts: an
  email address is the session key, and the Firestore rules are open on the
  three collections the app uses. Anyone who reaches the database directly —
  the rules are public, and the project ID is in the client bundle — can read
  and write every session over the REST API. The gate stops strangers reaching
  the *site*; it does not protect the data.
- **The phone remote is unauthenticated by design.** Possession of the
  seven-character board ID is the credential; the only way to obtain one is to
  scan the QR on screen. Treat a board as public to anyone who has seen it.
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
