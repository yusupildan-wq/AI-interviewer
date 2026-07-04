# AI Development Loop

AI Interviewer should improve through measured iteration, not vibes. Every change that touches interviewer behavior, scoring, prompting, voice flow, or session state should follow this loop.

## Loop

1. Capture the failure.
   - Write down the exact bad behavior: repeated phrase, slow reply, wrong score, awkward question, missed interruption, or broken session state.
   - Prefer turning the failure into a deterministic eval before changing the behavior.

2. Make the smallest useful change.
   - Keep prompt changes scoped.
   - Prefer pure helper functions around risky behavior so they can be tested without calling a paid model.
   - Do not hide regressions with broader fallbacks unless the fallback itself is evaluated.

3. Run the gate.
   - `npm run eval:ai`
   - `npm run verify`

4. Fix or revert immediately.
   - If an eval, typecheck, lint, format check, or build fails, fix it before moving on.
   - If the behavior gets worse and the cause is not obvious, revert the risky change and keep the passing version.

5. Commit only passing work.
   - Commits should represent a working checkpoint.
   - Environment files and secrets must stay out of commits.

## Current AI Evals

The first eval suites live in `backend/src/evals/`.

They currently protect conversation mode against:

- repeated canned fallback phrases
- question-only replies
- silent model output
- casual conversation being scored
- conversation-mode prompt rules leaking into coding mode
- slow conversation fallback budgets drifting above live-call speed

They also protect final scoring against shallow sessions looking average:

- tiny one-turn answers cannot land near 50/100
- short, shallow answers stay severely capped unless there is real evidence

Run it with:

```bash
npm run eval:ai
```

## Full Verification Gate

Run the full gate with:

```bash
npm run verify
```

This runs AI evals, TypeScript, ESLint, Prettier check, and production builds.

## Next Eval Targets

- Interview-mode latency fallbacks should stay specific to the candidate's latest message.
- Ending an interview must freeze the timer and stop listening.
- Conversation mode must not ask more than one question-only turn in a row.
- Barge-in echo filtering should reject Alex's own speech without losing the candidate's next turn.
