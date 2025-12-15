## Existing Work:

- Existing stack is Next.js App Router with AI SDK; WhatsApp webhook already wired via Twilio in app/api/whatsapp/\*, persisting chats/messages via
  Drizzle User/Chat/Message_v2/WebhookLog.
- WhatsApp flow already normalizes numbers, finds users by phone, calls LLM, and sends replies (with optional buttons/location/media); typing indicator
  uses Twilio Conversations.
- DB currently has minimal User (email required, phone optional) and no event/social/payment tables; admin UI is not present.

## Architecture Choices

- Identity: choose phone-as-primary for WhatsApp, map to user records, and capture email later; decide how to handle users that message first vs invited users; add consent + privacy prefs.
- Data: extend Postgres with normalized tables for profiles, events, RSVPs, payments, socials; prefer immutable message/webhook logs already in place; keep PII minimization and retention.
- Async work: introduce a job runner (cron/queue) for digests, template sends, event reminders, Stripe webhook handling; keep WhatsApp webhook fast and defer heavy work.
- Messaging rails: use Twilio templates for outbound outside 24h window; keep “session” replies via LLM; centralize template registry and opt-in tracking for both WhatsApp and email.
- Group/intro strategy: pick between Twilio Conversations (limited group automation) vs manual coordinator + invite links; document limits and fallback paths.

## Milestones

- M1 Foundations: tighten WhatsApp webhook (validation, rate limits, retries), configure env for Twilio senders/templates, clarify message-type contract
  to the LLM, add basic health/observability.
- M2 Profiles & Preferences: expand User to store name/email/location/lifestyle/investment/privacy prefs; build capture flows (WhatsApp onboarding + web
  form), consent logging, and identity linking.
- M3 Messaging Templates & Email: set up template store + approval status; add email provider + worker for weekly digests; build content generation
  pipeline (LLM) and scheduling.
- M4 Events/RSVP/Payments: model events/dinners, invitations, RSVPs; generate one-click RSVP links/tokens; integrate Stripe Checkout/Payment Links and
  surface in WhatsApp/email; store payment status.
- M5 Social Graph & Intros: model connections, similarity signals, and attendance history; surface “friends attending” in event flows; design intro flow
  (email guaranteed, explore WhatsApp handoff with compliance) with admin approval queue.
- M6 Admin Dashboard: CRUD/search for users/events, pending intro approvals, comms blast launcher (templates + targeting + dry-run), engagement stats,
  social graph views, and manual WhatsApp override/sent-log viewer.

## Dependencies

- Profiles precede templates/digests and power personalization, targeting, and social graph.
- Events/RSVP data is the backbone for payments, social attendance history, and “friends attending.”
- Templates + opt-ins are prerequisites for proactive WhatsApp/email digests and reminders.
- Social graph usefulness depends on captured profiles plus event/intro histories.
- Admin dashboard depends on all upstream data models and logging being consistent.

## Trade-offs to settle early

- Decide tolerance for Twilio Conversations vs plain Messaging for groups (automation limits vs simplicity).
- Choose how strict to be on WhatsApp template usage vs falling back to email/SMS outside session windows.
- Stripe: Payment Links (fast, fewer webhooks) vs Checkout Sessions (more control, more plumbing); where to store payment intents.
- Job infra: hosted cron vs in-app queue (Bull/MQ/Temporal) based on volume and reliability needs.
- Privacy: scope of data retention, encryption at rest for PII, and per-channel opt-outs.

## Questions

- Which email provider to use: Resend
- Required geographies/compliance: CCPA
- For groups/intros, is manual moderator acceptable, or is an automated bot in the group mandatory: ideally automated

## Next Steps for M1 Foundations

- Env/Config Readiness: Inventory required Twilio pieces (Account SID/Auth Token, WhatsApp sender or Messaging Service SID, Conversations agent identity for typing, optional buttons Content SID). Ensure we can provision/verify sender, messaging service, and pre-approved templates.
- Webhook Hardening: Enforce Twilio signature validation and reject early; add a clear 401/403 path and logging for failures. Confirm incoming schema validation covers media fields; capture a pending log before processing and idempotently update status. Decide behavior when user not found (reject vs create provisional user) and document.
- Session/Template Guardrails: Add a gate that checks if the 24h session is open; if closed, require a template send path (or skip send with a clear log/status).
- Outbound Sending Reliability: Define retry/backoff policy for Twilio send failures and when to give up; decide whether to queue outbound sends (job queue or in-process retry). Set per-number rate limits to respect Twilio MPS and avoid bursts.
- LLM Call Safety: Set strict timeouts, max retries, and schema validation; add fallbacks for invalid/empty AI responses (e.g., canned apology + escalation log); ensure buttons are ignored gracefully when Content SID missing (already logged) and confirm desired behavior.
- Observability/Runbooks: Standardize structured logs for inbound/outbound/typing/send errors with correlation IDs (MessageSid, WaId, chatId); add tracing spans/tags for Twilio calls and LLM calls; define log-based alerts for elevated send failures or processing errors. Draft a short runbook: how to rotate creds, re-drive failed sends, and verify webhook health.
- Testing Plan: Add unit tests for signature validation, number normalization, session gating, and send payload shaping (buttons/location/media). Document a manual test checklist (Twilio sandbox) for text, media, and typing indicator.

Acceptance for M1

- Webhook rejects invalid signatures and logs the attempt.
- Inbound → outbound happy path works with sandbox, including media and typing indicator.
- Failures are logged with actionable detail and do not drop processing silently.
- Rate/timeout/retry limits are in place and documented.
- Runbook and env config doc are written; tests cover the critical paths.
