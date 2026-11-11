# WatMatch client

The Next.js client uses Clerk for sign-in. The FastAPI backend maps a verified
Clerk identity to an existing active WatMatch account. The database determines
that account's role and workspace. An email address entered in a form is no
longer sufficient to sign in.

## Local setup

Use the reviewed lockfile. The VM uses Node.js 22.22.1 and npm 9.2.0; the Clerk
SDK and Sharp require Node.js 20.9 or newer.

```sh
cd src/client
npm ci --include=dev --include=optional
```

Supply these settings through your private `.env.local` or service environment.
Do not commit credentials.

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Public key for the selected Clerk instance. Required during the build. |
| `CLERK_SECRET_KEY` | Server-only key for the same instance. Required by Next.js middleware at runtime. |
| `NEXT_PUBLIC_API_URL` | API base, ending in `/api/v1`. Use `/api/v1` behind the same-origin reverse proxy. For separate local services, use `http://127.0.0.1:8000/api/v1`. Set during the build. |
| `NEXT_PUBLIC_PREVIEW_READ_ONLY` | Set to `true` during a private preview build to show the changes-disabled notice. Backend enforcement is separate and required. |

Do not place Supabase credentials or the former application JWT signing keys
in the frontend environment. `/login` is the configured sign-in route. Its
Clerk flow uses hash routing. The backend's permitted-origin list must match
the browser origin exactly, including its scheme and port.

Start the backend first, then run:

```sh
npm run dev -- --hostname 127.0.0.1
```

Open `http://127.0.0.1:3000`. For the prepared private VM reverse proxy, use
`http://127.0.0.1:8080` through the approved SSH tunnel instead. Stop a local
foreground development server with Ctrl-C.

## Authentication behavior

- Clerk obtains and renews short-lived session tokens. Each API call obtains its
  token through Clerk. WatMatch does not persist access tokens, refresh tokens,
  or account records in browser storage. Old demo values are removed on startup.
- Tokens can be sent only to the configured API origin and path. API redirects
  are rejected. Use the backend's canonical paths, including trailing slashes.
- Failed authentication never automatically replays an API request. This avoids
  repeating writes after a 401 response.
- The workspace and its navigation mount only after `/api/v1/auth/me` succeeds.
  An unlisted or inactive account sees an access message with retry/sign-out
  controls. An unavailable backend produces a separate service message.
- Account changes discard account details and the SWR response cache. Sign-out
  calls Clerk rather than only deleting browser state.
- Missing Clerk configuration displays a sign-in-unavailable message. There is
  no demo authentication fallback.

Clerk sign-in does not itself grant WatMatch access. Do not create accounts or
send verification messages merely to test a deployment. Use approved accounts
and isolated workflow data. Clerk development instances are for private testing;
production identity and domain setup require separate validation.

## Checks

```sh
npm run lint
./node_modules/.bin/tsc --noEmit --incremental false
npm test
NEXT_TELEMETRY_DISABLED=1 NEXT_PUBLIC_API_URL=/api/v1 npm run build
npm audit
npm audit --omit=dev
```

The API-client tests exercise URL handling, token isolation, account changes,
and request replay behavior with synthetic tokens. They do not prove a real
Clerk sign-in, database access, or role-specific browser workflows.

Next.js and `eslint-config-next` use matching versions. The scoped
`next.postcss` override selects a patched PostCSS 8 release because Next.js
15.5.28 still declares PostCSS 8.4.31. Keep this override until its upstream
dependency is patched. The obsolete shadcn CLI packages were removed; existing
UI components remain in `src/components/ui`.

See [workspace membership and role selection](../backend/db/README.md) for the required incremental migrations, test fixture and role checks.
