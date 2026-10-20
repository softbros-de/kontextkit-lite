---
name: pickup
description: "Continue work from the last session by reading .agent/handoff.md. Use at the start of a new session or when the user says \"resume\", \"weiter\", \"weitermachen\", \"where were we\"."
metadata:
  generator: kontextkit
  tier: lite
  version: "1.0.0"
---

# Pickup

1. Read `.agent/handoff.md`. If it does not exist, say so in one line and ask the user for the goal of this session. Stop.
2. If this is a git repository, run `git status --short` and `git log --oneline -5` to see whether anything changed since the handoff. Do not explore further yet.
3. Reply in at most 6 lines, in the user's language:
   - Goal (1 line)
   - State (1-2 lines)
   - Changes since the handoff, if any
   - Proposed next step
   - Ask: "Shall I start with <next step>?"
4. Do not read other files or start working until the user confirms, unless the user already asked you to continue.
5. Never retry anything listed under "Don't retry" without new evidence.
