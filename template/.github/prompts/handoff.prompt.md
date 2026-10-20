---
description: "Save a short session handoff to .agent/handoff.md so the next session or another coding agent can continue without re-explaining."
agent: agent
---

# Handoff

Write a handoff so the next session can continue in any tool (Claude Code, Codex, Cursor, Copilot) without the user re-explaining anything.

1. Create or overwrite `.agent/handoff.md` (create the `.agent/` folder if needed) with exactly this structure. Write in the user's language. Maximum 40 lines.

   ```markdown
   # Handoff: YYYY-MM-DD HH:MM

   ## Goal
   One sentence: the outcome we are working towards.

   ## State
   - Done: …
   - In progress: …
   - Broken / failing: …

   ## Next steps
   1. The very next concrete action (file + what to do)
   2. …

   ## Don't retry
   - Approach: why it failed
   ```

2. Only facts from this session. No guesses, no marketing. Name concrete files, functions, commands and error messages.
3. If the user added notes to the command, include them.
4. Reply in at most 3 lines: confirm the file was saved, state the first next step, and suggest starting a fresh session (`/clear`, `/new` or a new chat) and then running the pickup command (`/pickup`, in Codex `$pickup`) because a fresh context is cheaper than a long one.

<!-- kontextkit:lite 1.0.0 -->
