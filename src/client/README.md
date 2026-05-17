# WatMatch Client

This is the frontend for WatMatch.

The current implementation is the bare-bones SE 390 MP3 student flow. Only this one flow is available right now:

1. A student logs in.
2. The student creates a team.
3. The team creates one capstone proposal.
4. The proposal is submitted to an instructor from the same course for review.

Other WatMatch workflows are not implemented yet (WIP).

## Implemented Features

- Student login flow
- Team creation flow
- Capstone proposal creation flow
- Proposal submission to an instructor for review
- Frontend pages and forms for the current student flow

## Run the App

Install dependencies:

```bash
npm install
```

Create a `.env.local` file:

```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000/api/v1
```

Start the frontend:

```bash
npm run dev
```

Open the app at:

```text
http://localhost:3000
```

The backend should also be running at:

```text
http://localhost:8000
```