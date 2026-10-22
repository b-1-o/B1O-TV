# B1O TV Assistant Worker

A small HTTPS backend for general AI questions. The TV app calls this Worker; the model binding and access token remain on the server.

## Deploy

From the repository root, install dependencies and authenticate Wrangler:

    npm install
    npx wrangler login
    npx wrangler deploy --config worker/wrangler.toml

Set an access token that is at least 24 characters long. Generate a random value locally; never commit it:

    openssl rand -hex 32
    npx wrangler secret put ASSISTANT_TOKEN --config worker/wrangler.toml

The first command prints a token. Paste that value when prompted by the second command. Keep it private.

After deployment, the endpoint is:

    https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev/api/assistant

Enter that HTTPS URL in B1O TV Settings → AI backend endpoint, and paste the same ASSISTANT_TOKEN into the local device-token field. The token is stored in the TV app's local settings, not in the repository.

## API contract

POST /api/assistant

Headers:
- Authorization: Bearer YOUR_DEVICE_TOKEN
- Content-Type: application/json

Body:
    {
      "message": "Why is the sky dark at night?",
      "history": [
        { "role": "user", "content": "Earlier question" },
        { "role": "assistant", "content": "Earlier answer" }
      ]
    }

Successful response:
    { "reply": "..." }

The Worker accepts a maximum 2,000-character user message and the last 10 valid history messages. It does not execute tools or TV commands. Timers, notes and launching apps are handled by the TV app itself.

## Safety and limits

- Keep ASSISTANT_TOKEN as a Cloudflare Worker secret. It is not an AI-provider key.
- Do not put model API keys into frontend code, public environment variables, or Git.
- The token is a device access credential; anyone who extracts it from the TV's local storage can use the endpoint. Rotate it with Wrangler if needed.
- Configure Cloudflare rate limiting / usage alerts before sharing the endpoint outside your home.
- The model can be unavailable, slow, or wrong. The TV app has a request timeout and shows errors without blocking navigation.
- This endpoint does not persist chat history. Local notes are stored by the TV app on the device.
