# Higgsfield Spending Guardrails

**Owner hard rule. Applies to every human, agent, and automated job that can
call Higgsfield media generation. Do not remove or bypass.**

- **Monthly budget: 200 credits total.**
- **Never run high-resolution video models (>25 credits) autonomously.**
- **Always output the estimated credit cost and wait for explicit confirmation
  before calling any Higgsfield generation tool.**

## How to apply

Treat every Higgsfield generation like a spend action:

1. **Estimate** the credit cost of the request.
2. **State** the estimate to the human.
3. **Wait** for an explicit "yes".
4. Only then call the generation endpoint.

Cheap, non-video generations under the 25-credit autonomous ceiling may run
without a round-trip, but the running monthly total must still respect the
200-credit cap.

Enforcement lives in code: see `assertWithinGuardrails()` in
[`src/lib/higgsfield.ts`](../src/lib/higgsfield.ts), which throws unless a
video / over-ceiling request is explicitly `confirmed`.

> Note: confirm whether the current Higgsfield plan exposes an API at all —
> the basic plan may be UI-only. If so, upgrade or route AI image/video
> through an alternative before building this integration.
