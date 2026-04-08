# TOOLS.md - Local Notes

Skills define _how_ tools work. This file is for _your_ specifics — the stuff that's unique to your setup.

## What Goes Here

Things like:

- Camera names and locations
- SSH hosts and aliases
- Preferred voices for TTS
- Speaker/room names
- Device nicknames
- Anything environment-specific

## Examples

```markdown
### Cameras

- living-room → Main area, 180° wide angle
- front-door → Entrance, motion-triggered

### SSH

- home-server → 192.168.1.100, user: admin

### TTS

- Preferred voice: "Nova" (warm, slightly British)
- Default speaker: Kitchen HomePod
```

## Why Separate?

Skills are shared. Your setup is yours. Keeping them apart means you can update skills without losing your notes, and share skills without leaking your infrastructure.

---

## gog — Google Workspace

Your Google account: **EveGenesisClaw@gmail.com**

Always pass `--account EveGenesisClaw@gmail.com` unless you set `GOG_ACCOUNT` in the environment.

Your primary calendar ID is your email address: `EveGenesisClaw@gmail.com`

**Gmail**

```bash
# Search inbox
gog gmail search 'newer_than:7d' --account EveGenesisClaw@gmail.com

# Search with specific query
gog gmail search 'from:someone@example.com subject:lunch' --account EveGenesisClaw@gmail.com

# Send email
gog gmail send --to recipient@example.com --subject "Subject" --body "Body" --account EveGenesisClaw@gmail.com
```

**Calendar**

```bash
# List upcoming events
gog calendar events EveGenesisClaw@gmail.com --from 2026-04-08T00:00:00Z --to 2026-04-15T23:59:59Z --account EveGenesisClaw@gmail.com

# Create event (basic)
gog calendar create EveGenesisClaw@gmail.com --summary "Event Title" --from 2026-04-09T12:30:00-05:00 --to 2026-04-09T13:30:00-05:00 --account EveGenesisClaw@gmail.com

# Create event with description and attendees
gog calendar create EveGenesisClaw@gmail.com --summary "Lunch with Jojo" --from 2026-04-09T12:30:00-05:00 --to 2026-04-09T13:30:00-05:00 --description "Lunch details here" --attendees "jojo@example.com,other@example.com" --account EveGenesisClaw@gmail.com

# Create event with location and Meet link
gog calendar create EveGenesisClaw@gmail.com --summary "Team Sync" --from <iso> --to <iso> --location "123 Main St" --with-meet --account EveGenesisClaw@gmail.com

# Update existing event (to add/change fields after creation)
gog calendar update EveGenesisClaw@gmail.com <eventId> --description "Updated details" --account EveGenesisClaw@gmail.com
```

**Key calendar flags:** `--description`, `--attendees` (comma-separated emails), `--location`, `--with-meet`, `--all-day`, `--reminder popup:30m`, `--event-color 1-11`

**Drive / Contacts / Sheets / Docs** — also available via gog. Check `/app/skills/gog/SKILL.md` for the full command reference.

---

Add whatever helps you do your job. This is your cheat sheet.
