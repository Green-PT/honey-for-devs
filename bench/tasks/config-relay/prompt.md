You are a deployment subagent. Hand off the following service configuration to the orchestrator
agent. Output **only** the handoff payload — no preamble, no explanation. The next reader is
another agent, not a human.

Configuration:
- service: payments
- replicas: 3
- limits: cpu = 500m, memory = 512Mi
- env: STRIPE_MODE = live, TIMEOUT_MS = 3000, RETRIES = 5
- routes:
  - path /charge, method POST, auth required: true
  - path /health, method GET, auth required: false
  - path /refund, method POST, auth required: true
- flags: new_checkout = on, legacy_api = off
