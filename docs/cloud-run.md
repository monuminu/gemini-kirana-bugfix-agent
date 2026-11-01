# Future Cloud Run deployment of the repair console

The current server binds to 127.0.0.1 and trusts a local browser session. It is not ready for public hosting as-is. The separately hosted kirana static app does not include this backend.

For a later cloud release:

1. Add authenticated user identity to every token, report, media, job and cancellation route. Bind repository permissions to that identity; keep same-origin cookies and CSRF enforcement.
2. Containerize the built console/API, add a health endpoint, and listen on the platform PORT at 0.0.0.0 only behind authenticated ingress.
3. Move SQLite/job scheduling to durable storage and an authenticated queue/worker. Persist provider creation state atomically; never rely on an HTTP response or in-memory loop to keep a repair alive.
4. Put Gemini and GitHub App credentials in a cloud secret manager. Use per-repository GitHub App installation tokens instead of the local gh fallback.
5. Store private evidence/artifacts with explicit retention and owner-scoped access. Keep raw recordings absent unless the product adds that capability deliberately.
6. Run independent verification in a separate secrets-free worker capable of container isolation. Do not assume Docker-in-Docker is available inside Cloud Run.
7. Replace loopback preview URLs with authenticated disposable preview hosting of the exact verified PR commit. Preserve the stock 13 kg browser assertion and cancellation behavior.
8. Validate scale/restarts, permissions, quotas, rate limits, stale commits, token/session resumption and audit events before enabling public access.

No cloud resources for this console were created by the local implementation.

Use the official [Cloud Run authentication guide](https://cloud.google.com/run/docs/authenticating/overview), [Secret Manager integration](https://cloud.google.com/run/docs/configuring/services/secrets), and [Cloud Tasks invocation](https://cloud.google.com/run/docs/triggering/using-tasks) when implementing these changes. Use workload identity and least-privilege service accounts. Run verification in a worker that supports the required container restrictions, with no credentials mounted into its candidate workspace.
