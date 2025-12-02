## Shared Conversations – Product Ideas

### Real-time collaboration
- **AI mediator**: live “reads the room,” flags misunderstandings, suggests reframes, proposes next steps.
- **Whisper to AI**: private side-notes per participant; AI returns suggested phrasing/questions; never posts without explicit send.
- **Live snapshots**: on-demand one‑liner: “Where are we? What’s the decision?” pinned to header.

### Structure and outcomes
- **Agenda + checkpoints**: lightweight agenda; AI tracks progress and nudges when off-topic.
- **Decisions + action items**: auto-extract with owners/dates; require confirmation before posting.
- **Alignment score**: agreement/unresolved/confidence index shown over time.
- **Issue/decision timeline**: compact list of key moments; jump-to in thread.

### Personalization (multi-user aware)
- **Personalized summaries**: each participant gets a tailored recap; plus a shared canonical summary.
- **Tone/translation assist**: real-time tone softening and language translation per user.
- **Role-aware guidance**: tips differ for owner/member/observer (e.g., “propose decision,” “surface risk”).

### Safety and fairness
- **Guardrails**: flag bias/toxicity/unequal airtime; suggest balanced prompts.
- **Consent-aware**: if a whisper includes sensitive info, remind about consent before sharing.

### Knowledge capture
- **Insight cards**: extract reusable insights (facts, constraints, preferences); index by conversation and user.
- **Knowledge links**: suggest linking current discussion to past decisions/threads.

### Lightweight analytics
- **Sentiment/engagement timeline**: energy spikes, confusion or stall points.
- **Participation map**: simple visual of who contributed and when (no shaming, just balance).

### Roles and permissions (simple, powerful)
- **Roles**: owner, member, observer, AI_moderator.
- **Suggestion lane**: AI posts to a “suggestions” lane; owner approves to publish into main thread.

### Post-conversation automation
- **Decision log**: immutable list of decisions; export/share.
- **Follow-ups**: one click to send tasks to Email/Slack/Calendar.
- **Re-entry brief**: “What changed since you left?” sidebar for late joiners.

### Minimal data model additions
- **conversations_participants.role**: extend enum to include 'observer', 'moderator'.
- **messages.meta**: { type: 'suggestion' | 'decision' | 'action_item' | 'whisper' }.
- **New tables**:
  - conversation_agenda(id, conversation_id, items[])
  - conversation_actions(id, conversation_id, title, owner_user_id, due_at, status)
  - conversation_decisions(id, conversation_id, title, rationale, decided_at)
  - conversation_insights(id, conversation_id, content, source_message_id)
- **Optional**: conversation_summaries(snapshot_at, for_user_id|null, content)

### Edge functions (small set)
- **summarize_conversation**: canonical + per-user summaries.
- **extract_outcomes**: scan latest window for decisions/actions; post as suggestions.
- **agenda_assistant**: nudge to next item; mark progress.

### MVP slice (fast win)
- Add messages.meta.type and a “suggestions” lane.
- AI posts suggestions (actions/decisions) → owner approves → moved to main thread.
- Personalized + canonical summary on demand.
- Alignment index (resolved vs unresolved items) as a header badge.


