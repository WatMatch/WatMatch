# WatMatch Backend

This is the backend for WatMatch.

The current implementation is the bare-bones SE 390 MP3 student flow. Only this one flow is available right now:

1. A student logs in.
2. The student creates a team.
3. The team creates one capstone proposal.
4. The proposal is submitted to an instructor from the same course for review.

Other WatMatch workflows are not implemented yet (WIP).

## Implemented Features

- FastAPI backend
- Supabase database connection
- API support for the current student team and proposal flow
- Early data model for:
  - users
  - courses
  - teams
  - team memberships
  - capstones

## Run the App

Install dependencies:

```bash
pip install -r requirements.txt
```

Create a `.env` file:

```env
SUPABASE_URL=your-supabase-url
SUPABASE_KEY=your-supabase-key
```

Start the backend:

```bash
python main.py
```

Or run with hot reload:

```bash
uvicorn main:app --reload
```

The API runs at:

```text
http://localhost:8000
```
