# KontextKit Lite

**Nie wieder alles neu erklären.** KontextKit Lite gibt Claude Code, OpenAI Codex, Cursor und GitHub Copilot zwei Befehle:

- **`/handoff`**: Am Ende einer Session schreibt der Agent eine kurze Übergabe nach `.agent/handoff.md` mit Ziel, Stand, nächsten Schritten und dem, was **nicht** noch einmal probiert werden soll.
- **`/pickup`**: In der nächsten Session (auch in einem anderen Tool) liest der Agent die Übergabe und schlägt den nächsten Schritt vor.

**In English:** KontextKit Lite adds two commands to Claude Code, OpenAI Codex, Cursor and GitHub Copilot. `/handoff` writes a short session handoff to `.agent/handoff.md`: goal, current state, next steps and what not to try again. `/pickup` reads it in the next session, even in a different tool, and suggests the next step (in Codex: `$handoff` and `$pickup`). Free, MIT licensed, no dependencies, runs locally. The rest of this README is in German.

Kostenlos, MIT-Lizenz, ohne Abhängigkeiten, läuft komplett lokal.

> Du willst mehr? **KontextKit Core** synchronisiert eine Quelldatei in CLAUDE.md, AGENTS.md, Cursor-Rules und Copilot-Instructions. Dazu kommen strukturierte Übergaben, eine Session-Start-Checkliste und ein Leitfaden „Kontext behalten & Limits sparen“. **KontextKit Pro** ergänzt Checkpoints mit Rollback, Fix-Loop-Schutz, Weekly-Ship-Recap, Limit-Budget-Routine und Starter-Vorlagen. → **https://softbros.de/kontextkit**

## Installation

Voraussetzung: [Node.js](https://nodejs.org) 18 oder neuer.

```bash
git clone https://github.com/softbros-de/kontextkit-lite kontextkit-lite
node kontextkit-lite/install.mjs /pfad/zu/deinem/projekt
```

Nur bestimmte Tools:

```bash
node kontextkit-lite/install.mjs . --tools claude,cursor
```

| Option | Wirkung |
|---|---|
| `--tools claude,codex,cursor,copilot` | nur diese Tools (Standard: alle) |
| `--dry-run` | nur anzeigen, nichts schreiben |
| `--force` | eigene, gleichnamige Dateien ersetzen (Backup als `*.kk-bak`) |

Der Installer **löscht nichts** und überschreibt keine fremden Dateien. In bestehende `AGENTS.md`, `CLAUDE.md` und `.github/copilot-instructions.md` fügt er einen kurzen, markierten Block ein (`<!-- kontextkit:start -->` … `<!-- kontextkit:end -->`). Ein erneuter Aufruf aktualisiert nur diesen Block. Legt er eine **neue** CLAUDE.md an und gibt es eine AGENTS.md, importiert die CLAUDE.md diese mit `@AGENTS.md`. Claude Code liest AGENTS.md nämlich nicht mehr, sobald eine CLAUDE.md existiert.

**Ohne Installer:** Kopiere die Ordner aus `template/` in dein Projekt und füge den Inhalt von `session-block.md` in deine AGENTS.md bzw. CLAUDE.md ein.

## Was wohin kommt

| Tool | Dateien | Aufruf |
|---|---|---|
| Claude Code | `.claude/skills/handoff/`, `.claude/skills/pickup/`, Block in `CLAUDE.md` | `/handoff`, `/pickup` |
| OpenAI Codex | `.agents/skills/handoff/`, `.agents/skills/pickup/`, Block in `AGENTS.md` | `$handoff`, `$pickup` (oder über `/skills`) |
| Cursor | Session-Regel über `AGENTS.md` (liest Cursor selbst) bzw. `.cursor/rules/kontextkit-session.mdc`, wenn Codex nicht eingerichtet wird. Skills aus `.agents/skills/` bzw. `.claude/skills/` | `/handoff`, `/pickup` |
| GitHub Copilot (VS Code) | `.github/prompts/handoff.prompt.md`, `.github/prompts/pickup.prompt.md`, Block in `.github/copilot-instructions.md` | `/handoff`, `/pickup` |

Du kannst auch einfach „Mach einen Handoff“ oder „Wo waren wir?“ schreiben. Die Agenten erkennen die Skills an ihrer Beschreibung.

**Warum `/pickup` und nicht `/resume`?** Claude Code und Codex haben bereits einen eingebauten `/resume`-Befehl (frühere Unterhaltung öffnen). Ein Projekt-Skill gleichen Namens würde ihn in Claude Code ersetzen.

## So arbeitest du damit

1. Arbeite an **einer** Aufgabe pro Session.
2. Wird der Kontext lang, wechselst du das Tool oder ist Feierabend: **`/handoff`**.
3. Neue Session starten (`/clear` in Claude Code, `/new` in Codex, neuer Chat in Cursor/Copilot).
4. **`/pickup`**. Der Agent fasst in wenigen Zeilen zusammen, wo es weitergeht, und fragt, ob er loslegen soll.

`.agent/handoff.md` kannst du committen (Team, mehrere Rechner) oder in `.gitignore` aufnehmen (nur lokal).

## Typische Situationen

- **Claude Code vergisst nach `/clear` oder der Kompaktierung, was schon besprochen war.** Vorher `/handoff`, danach `/pickup`.
- **Das Limit ist leer und du wechselst von Claude Code zu Codex oder Cursor.** Die Übergabe liegt im Repo, das neue Tool liest sie mit `/pickup` (in Codex `$pickup`).
- **Feierabend mitten in einer Aufgabe.** Am nächsten Morgen sagt `/pickup`, wo es weitergeht und was schon gescheitert ist.

## Lite oder Core?

Lite reicht, wenn du vor allem Übergaben zwischen Sessions brauchst. KontextKit Core lohnt sich, wenn du mehrere Tools nutzt und ihre Regeldateien von Hand pflegst: Du schreibst eine Quelle (`.agent/context.md`), ein Befehl erzeugt daraus AGENTS.md, CLAUDE.md, Cursor-Rules und Copilot-Instructions. Vorhandene Dateien werden importiert und gesichert, und Core warnt, wenn eine Datei die Größenempfehlung des Herstellers überschreitet. Mehr unter [softbros.de/kontextkit](https://softbros.de/kontextkit).

## Kostenloser Spickzettel: Die 10 Kontext-Regeln

Eine Seite als PDF für Claude Code, Codex, Cursor und Copilot, zum Beispiel: Wissen gehört in Dateien statt in den Chat, eine Session pro Ziel, nach zwei Fehlversuchen stoppen. Du bekommst ihn per E-Mail über [softbros.de/kontextkit](https://softbros.de/kontextkit#kk-signup-title).

## Tests

```bash
node tests/run.mjs
```

## Lizenz & Kontakt

MIT-Lizenz, siehe [LICENSE](LICENSE). Ein Projekt der softbros UG (haftungsbeschränkt), [softbros.de](https://softbros.de).
Claude, Codex, Cursor und GitHub Copilot sind Marken ihrer jeweiligen Inhaber. KontextKit ist mit keinem dieser Anbieter verbunden.
