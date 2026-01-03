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

## Observability Patterns

### Request context (AsyncLocalStorage)

- Use the module-scoped AsyncLocalStorage helpers in `lib/observability/context.ts` to carry per-request data in Vercel Fluid Compute.
- Always wrap route handlers with `runWithRequestContext({ request, service })` at the top of the handler (Node runtime only; do not use in Edge runtime or middleware—see [Runtime caveats](#runtime-caveats)).
- Request IDs are read from `x-request-id` or `x-vercel-id`; if missing, a `req_<timestamp>_<random>` ID is generated.
- Never store per-request data in global mutable state; rely on context accessors like `getRequestContext()`.

```ts
import { runWithRequestContext } from "@/lib/observability";

export function POST(request: Request) {
  return runWithRequestContext({ request, service: "example" }, async () => {
    // handler logic
  });
}
```

### Background work (after, setTimeout, fire-and-forget)

- Capture the current request context once, then re-enter it for deferred work using `bindRequestContext`.
- This keeps request IDs and log correlation intact for background tasks scheduled inside a request.

```ts
import { after } from "next/server";
import { bindRequestContext, runWithRequestContext } from "@/lib/observability";

export function POST(request: Request) {
  return runWithRequestContext({ request, service: "example" }, async () => {
    const runInBackground = bindRequestContext();
    after(() => runInBackground(() => doBackgroundWork()));
  });
}
```

### Logging, tracing, and metrics

- Use `createLogger`/`log` for structured logs; WhatsApp routes use `logWhatsAppEvent`. These enrich logs with context IDs and push errors to Sentry.
- Use OpenTelemetry spans via `@vercel/otel` and `@opentelemetry/api` for tracing. If you capture a trace context for deferred work, wrap it with `context.with(...)` inside a `bindRequestContext` callback.
- Record metrics via `lib/observability/metrics.ts` (latency, rate limits, usage) and keep them tied to request context where possible.

### Runtime caveats

- AsyncLocalStorage is Node.js only; avoid relying on it in Edge runtime or middleware. If middleware needs correlation, pass IDs explicitly.

## Milestones

- M1 Foundations: Implement WhatsApp webhook (validation, rate limits, retries), configure env for Twilio senders/templates, clarify message-type contract to the LLM, add basic health/observability.
- M2 Profiles & Preferences: expand User to store name/email/location/lifestyle/investment/privacy prefs; build capture flows (WhatsApp onboarding), consent logging, and identity linking.
- M3 Messaging Templates & Email: set up template store + approval status; add email provider + worker for weekly digests.
- M4 Events/RSVP/Payments: model events/dinners, invitations, RSVPs; generate one-click RSVP links/tokens; integrate Stripe Checkout/Payment Links and surface in WhatsApp/email; store payment status.
- M5 Social Graph & Intros: model connections, similarity signals, and attendance history; surface “friends attending” in event flows; design intro flow (email guaranteed, explore WhatsApp handoff with compliance) with admin approval queue.
- M6 Admin Dashboard: CRUD/search for users/events, pending intro approvals, comms blast launcher (templates + targeting + dry-run), engagement stats, social graph views, and manual WhatsApp override/sent-log viewer.

Agent should have:

- explicit human-in-the-loop checkpoints
- auditable decision logs
- reversible tool actions

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

## Complete Setup Guide

### Prerequisites

- Node.js 18+
- pnpm 10.26.0+ (`corepack enable && corepack prepare pnpm@10.26.0 --activate`)
- PostgreSQL 15+ database
- Redis instance (for rate limiting)
- Twilio account with WhatsApp enabled
- AI provider API keys (Anthropic and/or OpenAI)

### 1. Clone and Install Dependencies

```bash
git clone <repository-url>
cd svrnhost
pnpm install
```

### 2. Environment Configuration

Copy the example environment file and configure all required variables:

```bash
cp .env.example .env.local
```

Required environment variables:

| Variable | Description |
|----------|-------------|
| `AUTH_SECRET` | Random 32-byte secret for NextAuth. Generate with `openssl rand -base64 32` |
| `POSTGRES_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string for rate limiting |
| `TWILIO_ACCOUNT_SID` | Twilio account SID from console |
| `TWILIO_AUTH_TOKEN` | Twilio auth token for webhook signature validation |
| `TWILIO_WHATSAPP_WEBHOOK_URL` | Public URL for the WhatsApp webhook (e.g., `https://your-domain.com/api/whatsapp`) |

LLM provider configuration (required for AI responses):

- Set `AI_GATEWAY_API_KEY` (recommended on Vercel), or
- Set both `OPENAI_API_KEY` and `ANTHROPIC_API_KEY`.

Choose ONE sender method:

| Variable | Description |
|----------|-------------|
| `TWILIO_MESSAGING_SERVICE_SID` | **(Recommended)** Messaging Service SID for smart routing |
| `TWILIO_WHATSAPP_FROM` | Direct sender number in E.164; `whatsapp:` prefix optional |

Optional configuration:

| Variable | Description |
|----------|-------------|
| `AI_GATEWAY_API_KEY` | Vercel AI Gateway key (auto-configured on Vercel) |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob storage token |
| `TWILIO_CONVERSATIONS_AGENT_IDENTITY` | Agent identity for typing indicators |
| `TWILIO_WHATSAPP_BUTTONS_CONTENT_SID` | Content template SID for quick reply buttons |
| `SKIP_ENV_VALIDATION` | Set to `true` to bypass server env validation (tests only) |

### 3. Database Setup

Run database migrations to create the schema:

```bash
pnpm db:migrate
```

Useful database commands:

```bash
pnpm db:generate   # Generate new migration from schema changes
pnpm db:studio     # Open Drizzle Studio for database inspection
pnpm db:push       # Push schema directly (development only)
```

### 4. Twilio Configuration

1. **Create a Messaging Service** (recommended):
   - Go to [Twilio Console > Messaging > Services](https://console.twilio.com/us1/develop/sms/services)
   - Create a new service and add your WhatsApp sender
   - Copy the Messaging Service SID to `TWILIO_MESSAGING_SERVICE_SID`

2. **Configure the Webhook**:
   - In Twilio Console, navigate to your WhatsApp sender
   - Set the webhook URL to match `TWILIO_WHATSAPP_WEBHOOK_URL` exactly (including trailing slashes)
   - Select HTTP POST method

3. **For Typing Indicators** (optional):
   - Create a Conversations Service
   - Add an agent identity as a participant in conversations
   - Set `TWILIO_CONVERSATIONS_AGENT_IDENTITY`

4. **For Button Templates** (optional):
   - Create a Content Template in [Content Template Builder](https://console.twilio.com/us1/develop/sms/content-template-builder)
   - Quick reply templates work in-session without approval
   - Set `TWILIO_WHATSAPP_BUTTONS_CONTENT_SID`

### 5. User Provisioning

The WhatsApp webhook **rejects messages from unregistered phone numbers**. Users must be added to the database before they can interact:

```sql
INSERT INTO users (id, email, phone)
VALUES (gen_random_uuid(), 'user@example.com', '+15551234567');
```

Phone numbers should be in E.164 format without the `whatsapp:` prefix.

### 6. Running the Application

```bash
# Development (with hot reload)
pnpm dev

# Production build
pnpm build
pnpm start
```

### 7. Exposing for Webhook Testing

For local development with Twilio webhooks, use a tunnel:

```bash
# Using ngrok
ngrok http 3000

# Update TWILIO_WHATSAPP_WEBHOOK_URL in .env.local
# Update webhook URL in Twilio Console
```

### Deployment to Vercel

1. Connect your repository to Vercel
2. Configure environment variables in Vercel dashboard
3. The build script automatically runs migrations: `pnpm build`
4. Ensure your domain is configured in `TWILIO_WHATSAPP_WEBHOOK_URL`

## Manual Test Checklist

Use this checklist to verify WhatsApp webhook functionality after deployment or configuration changes.

### Prerequisites for Testing

- [ ] Twilio Sandbox enabled for WhatsApp testing, OR production WhatsApp sender approved
- [ ] Test user's phone number added to the `users` table
- [ ] Webhook URL accessible from Twilio (verify with `curl -X POST <url>`)
- [ ] Environment variables confirmed set in deployment

### Webhook Security Tests

| Test | Steps | Expected Result |
|------|-------|-----------------|
| **Signature validation** | Send POST to `/api/whatsapp` without `X-Twilio-Signature` header | 403 Forbidden; log: `whatsapp.inbound.signature_missing` |
| **Invalid signature** | Send POST with invalid signature header | 403 Forbidden; log: `whatsapp.inbound.signature_invalid` |
| **Missing payload** | Send empty POST body | 400 Missing payload |
| **Invalid payload** | Send malformed form data (missing required fields) | 400 Invalid payload |
| **Missing env vars** | Temporarily unset `TWILIO_AUTH_TOKEN` | 500 Server misconfigured |

### Happy Path Tests

| Test | Steps | Expected Result |
|------|-------|-----------------|
| **Text message** | Send "Hello" from registered WhatsApp number | Receives AI response; logs: `whatsapp.inbound.received` → `whatsapp.processing.queued` → `whatsapp.outbound.sent` |
| **Image/media** | Send an image with caption | Message saved with attachment metadata; AI responds |
| **Typing indicator** | Send message (with Conversations configured) | Typing indicator appears before response |
| **Duplicate handling** | Resend same MessageSid | 200 OK with empty TwiML; log: `whatsapp.inbound.duplicate_skipped` |

### Error Handling Tests

| Test | Steps | Expected Result |
|------|-------|-----------------|
| **Unknown user** | Send from unregistered phone number | Message logged with `processing_error` status; `User not found` error |
| **AI timeout** | (Simulate slow LLM or disconnect) | Fallback response sent; log: `whatsapp.llm.failed` with `failureType: timeout` |
| **Send failure** | (Simulate Twilio API error) | Error logged; message marked as `failed` in DB |

### Database Verification

After each successful test, verify:

- [ ] `WebhookLog` entry created with correct `status` (`processed`, `processing_error`, etc.)
- [ ] `Message_v2` entries for both inbound and outbound messages
- [ ] Inbound message has `source: "twilio:whatsapp"` and `direction: "inbound"`
- [ ] Outbound message has `sendStatus` in metadata (`queued`, `sent`, or `failed`)
- [ ] `Chat` record exists linking messages to user

### Log Verification

Confirm structured logs contain correlation fields:

```
whatsapp.inbound.received    messageSid=SM... waId=15551234567
whatsapp.processing.queued   messageSid=SM... waId=15551234567
whatsapp.outbound.sent       messageSid=SM... waId=15551234567 chatId=...
```

### Rate Limiting Test

| Test | Steps | Expected Result |
|------|-------|-----------------|
| **Burst messages** | Send 10+ messages in rapid succession | Messages processed without 429 errors; rate limiter queues excess |
| **Rate limit exceeded** | (Exhaust rate limit tokens) | Log: `whatsapp.outbound.rate_limit_failed`; message retried or failed |

### Credential Rotation Verification

After rotating Twilio credentials:

1. [ ] Update `TWILIO_AUTH_TOKEN` in secrets
2. [ ] Redeploy application
3. [ ] Send test message
4. [ ] Verify log: `whatsapp.inbound.signature_validated`
5. [ ] Verify outbound message sends successfully

### Observability Verification

- [ ] OpenTelemetry spans created for `process-whatsapp`, `llm.generate_whatsapp_response`, `twilio.messages.create`
- [ ] Span attributes include `whatsapp.message_sid`, `whatsapp.wa_id`, `whatsapp.chat_id`
- [ ] Errors recorded with `span.recordException()` and proper status codes
