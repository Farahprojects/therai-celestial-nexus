# Edge Functions Usage Analysis - UPDATED 2025-10-20

## Currently Active Edge Functions (41 total)
After comprehensive cleanup, these functions remain:

### Authentication & User Management (7)
- ✅ `password_token` - Password reset token generation
- ✅ `resend-verification` - Resend email verification
- ✅ `create-user-and-verify` - User creation with verification
- ✅ `email-verification` - Email verification
- ✅ `verify-email-token` - Email token verification
- ✅ `verify-token` - General token verification
- ✅ `delete-account` - Account deletion

### AI & Reports (5)
- ✅ `generate-insights` - Generate AI insights from user data
- ✅ `get-report-data` - Fetch report data (used in ReportSlideOver)
- ✅ `report-orchestrator` - Orchestrates report generation, calls standard-report engines
- ✅ `standard-report-three` - Gemini-based report generation
- ✅ `standard-report-four` - Gemini-based report generation
- ✅ `initiate-auth-report` - **CRITICAL** Called by conversation-manager when creating conversations with report_data

### LLM & Chat (3)
- ✅ `llm-handler-gemini` - **PRIMARY** Gemini chat handler (100% Gemini stack)
- ✅ `chat-send` - Chat message handling
- ✅ `context-injector` - Inject context into conversations
- ✅ `conversation-manager` - Manage conversations (CRUD operations)

### Voice/Audio (3)
- ✅ `google-whisper` - **PRIMARY** Speech-to-text (Google STT)
- ✅ `google-text-to-speech` - **CRITICAL** Text-to-speech called by llm-handler-gemini for voice chat
- ✅ `openai-whisper` - Alternative STT option

### Payments & Subscriptions (6)
- ✅ `create-subscription-checkout` - **PRIMARY** Subscription checkout flow
- ✅ `check-subscription` - Check subscription status
- ✅ `customer-portal` - Stripe customer portal
- ✅ `cancel-subscription` - Cancel subscription
- ✅ `update-subscription` - Update subscription
- ✅ `stripe-webhook-handler` - **CRITICAL** Handles all Stripe webhooks

### Communication (3)
- ✅ `outbound-messenger` - Send messages (ComposeModal, ReplyModal)
- ✅ `contact-form-handler` - Contact form submissions
- ✅ `inboundMessenger` - Inbound message handling

### Location Services (2)
- ✅ `google-places-autocomplete` - Place search
- ✅ `google-place-details` - Place details

### Ephemeris & Astrology (2)
- ✅ `translator-edge` - Swiss ephemeris data translation **DO NOT DELETE**
- ✅ `swiss/` - Swiss ephemeris calculations **DO NOT DELETE**

### Utilities & Infrastructure (4)
- ✅ `keep-warm` - Keep functions warm (prevents cold starts)
- ✅ `verification-emailer` - Email verification sender
- ✅ `validate-promo-code` - Promo code validation
- ✅ `update-password` - Password update handler

### Payment Legacy (2) - REVIEW NEEDED
- ⚠️ `create-checkout` - May be duplicate of create-subscription-checkout
- ⚠️ `create-payment-intent` - One-time payment intents (may be unused)

---

## Recently Deleted Functions (30+)

### Deleted - OpenAI LLM Functions (5)
- ❌ `llm-handler-openai` - Replaced by llm-handler-gemini
- ❌ `standard-report` - OpenAI report engine
- ❌ `standard-report-one` - OpenAI report engine
- ❌ `standard-report-two` - OpenAI report engine
- ❌ `create-report` - Old report creation

### Deleted - Billing & Payment (14)
- ❌ `api-usage-handler`
- ❌ `billing-delete-card`
- ❌ `billing-setup-card`
- ❌ `create-subscription` (duplicate)
- ❌ `create-payment-session`
- ❌ `get-checkout-url`
- ❌ `get-payment-status`
- ❌ `process-credits`
- ❌ `process-paid-report`
- ❌ `process-topup-queue`
- ❌ `resume-stripe-checkout`
- ❌ `update-service-purchase-metadata`
- ❌ `sync-subscriptions-due-today`

### Deleted - Report Generation (3)
- ❌ `create-temp-report-data`
- ❌ `initiate-report-flow`
- ❌ `trigger-report-generation`

### Deleted - Audio/Voice (2)
- ❌ `google-speech-to-text` (replaced by google-whisper)
- ❌ `openai-whisper` (keeping google-whisper as primary)

### Deleted - Authentication (1)
- ❌ `signup_token`

### Deleted - Utilities (7)
- ❌ `cleanup-orphaned-images`
- ❌ `email-check`
- ❌ `error-handler-diagnostic`
- ❌ `threads-manager`
- ❌ `generate-summary`
- ❌ `create-insight-id`
- ❌ `log-user-error`

---

## Environment Variables Required

### Core Services
- `SUPABASE_URL` (required for all)
- `SUPABASE_SERVICE_ROLE_KEY` (required for all)

### Google/Gemini APIs (Primary Stack)
- `GOOGLE-STT` - Speech-to-text (google-whisper)
- `GOOGLE-TTS` - Text-to-speech (google-text-to-speech)
- `GOOGLE_LLM_1` - Gemini chat (llm-handler-gemini)
- `GOOGLE_API_KEY` - Gemini insights (generate-insights)
- `GOOGLE-API-ONE` - Gemini reports (standard-report-three)
- `GOOGLE-API-TWO` - Gemini reports (standard-report-four)
- `GEMINI_MODEL` - Optional, defaults to "gemini-2.5-flash"

### Configuration (Optional)
- `MAX_API_RETRIES` (default: 3)
- `INITIAL_RETRY_DELAY_MS` (default: 1000)
- `RETRY_BACKOFF_FACTOR` (default: 2)
- `API_TIMEOUT_MS` (default: 30000)
- `MAX_DB_RETRIES` (default: 2)

### Stripe (Payment Processing)
- `STRIPE_SECRET_KEY`
- `STRIPE_PUBLISHABLE_KEY` (frontend only)

---

## Critical Backend Connections

These functions are called by other edge functions, not directly from frontend:

1. **initiate-auth-report**
   - Called by: `conversation-manager`
   - Purpose: Creates conversations with report data

2. **google-text-to-speech**
   - Called by: `llm-handler-gemini`
   - Purpose: Voice chat TTS responses

3. **report-orchestrator**
   - Called by: Report generation flow
   - Purpose: Coordinates report engines

4. **standard-report-three & standard-report-four**
   - Called by: `report-orchestrator`
   - Purpose: Generate AI reports using Gemini

5. **translator-edge & swiss/**
   - Called by: Astrology calculation flow
   - Purpose: Swiss ephemeris calculations

---

## Stripe Payment Flow (Current Architecture)

```
Frontend                      Edge Function                      Stripe                    Webhook
──────────────────────────────────────────────────────────────────────────────────────────────────────
useSubscription.ts        →   create-subscription-checkout   →   Creates session      →   stripe-webhook-handler
BillingPanel.tsx          →                                      Redirects user           - Updates profiles
EmbeddedCheckout.tsx      →                                                               - Updates subscriptions

SubscriptionSuccess.tsx   →   check-subscription             →   Verifies status

BillingPanel.tsx          →   customer-portal                →   Opens portal         →   stripe-webhook-handler
                                                                 Manages billing          - Syncs changes

CancelModal.tsx           →   cancel-subscription            →   Cancels sub          →   stripe-webhook-handler
                                                                                           - Updates status
```

---

## Next Steps for Cleanup

### Functions to Review:
1. ⚠️ **create-checkout** - Check if duplicate of create-subscription-checkout
2. ⚠️ **create-payment-intent** - Verify if one-time payments are used
3. ⚠️ **openai-whisper** - Check if still used or can be removed (google-whisper is primary)
4. ⚠️ **inboundMessenger** - Verify actual usage
5. ⚠️ **verification-emailer** - Check if email-verification covers this
6. ⚠️ **validate-promo-code** - Confirm promo codes are still supported
7. ⚠️ **keep-warm** - Review if still needed or update function list

---

## Summary Statistics

- **Total Active Functions**: 41
- **Total Deleted**: 31+
- **Primary AI Stack**: 100% Google/Gemini (OpenAI fully removed)
- **Primary STT**: google-whisper (Google Cloud Speech-to-Text)
- **Primary TTS**: google-text-to-speech (Google Cloud Text-to-Speech)
- **Lines of Code Removed**: ~5,100+
- **Cleanup Progress**: ~43% reduction in edge functions
