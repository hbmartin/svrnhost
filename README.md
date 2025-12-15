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

### Acceptance for M1

- Webhook rejects invalid signatures and logs the attempt.
- Inbound → outbound happy path works with sandbox, including media and typing indicator.
- Failures are logged with actionable detail and do not drop processing silently.
- Rate/timeout/retry limits are in place and documented.
- Runbook and env config doc are written; tests cover the critical paths.

## Decisions

### Trade-off 1: WhatsApp Groups: Use Conversations

- Conversations: built-in participant management, typing events, and consistent webhooks; workable for “pseudo-groups,” but WhatsApp group automation is limited (no true group admin actions). Good if you want a single API surface and can accept manual/semi-automated group coordination. Overhead: provision Conversations service, identities, and policy decisions.
- Messaging-only: simple for 1:1; for groups you’d resort to manual human-created groups + invite links and send individual updates.
- Conclusion: use Conversations, especially where you need typing/consistent IDs.

### Trade-off 2: Session vs Templates: Require template management feature with Twilio API integration

- Strict templates outside 24h: compliant and predictable; requires template approval and catalog upkeep; outbound may be blocked when templates missing.
- Lenient (try free-form): faster iteration, but messages can fail and risk quality score. Compliance risk if abused.
- Conclusion: enforce “session gate”: if >24h since last user message, only send a known template or fall back to email/SMS. Maintain a small, approved template set (digest, RSVP reminder, payment follow-up, intro ping). Log and surface when a send is skipped for missing template.

### Trade-off 3: Stripe: Payment Links

- Payment Links: zero backend state to create; fast to launch; fewer webhook needs. Limited UI/control, harder to couple to per-user pricing/metadata beyond basic params.
- Checkout Sessions: more control (line items, metadata, success/cancel URLs per user/event), better for future upgrades (subscriptions, tax), requires webhook handling and order state mapping.
- Conclusion: start with Payment Links for subscription flows to ship fast; include per-invite metadata in link params and map back via success redirect token. Record all steps in Database.

### Trade-off 4: Job Infra – Cron vs Queue

- Cron (scheduled tasks): simple for low-volume digests/reminders; limited for retries/backoff and fan-out.
- Queue/worker (Bull/PG-backed, or hosted): better for retries, rate limiting, and decoupling webhook processing from outbound sends; more moving parts.
- Conclusion: stand up a lightweight cron for outbound sends and Stripe/email webhooks to keep the WhatsApp webhook thin. Use absurd.js when queue is required.

### Trade-off 5: Privacy/Data Scope

- Minimalist: store only necessary PII (phone, email, name, coarse location), shorter retention, strong opt-in/out per channel; easier compliance, fewer
  breach concerns.
- Rich graph/lifecycle: more data (detailed prefs, attendance history, similarity signals) improves personalization and social features but increases
  compliance burden and DSAR work.
- Conclusion: start with explicit consent logs per channel (WhatsApp, email); encrypt sensitive fields at rest; define retention windows for logs. Make PII deletion from database easy. Document DSAR/export/delete process early.
