# TOOLS.md — Command Reference

## gog — Google Workspace

Account: **EveGenesisClaw@gmail.com**  
Always pass `--account EveGenesisClaw@gmail.com` (or set `GOG_ACCOUNT`).  
Your calendar ID: `EveGenesisClaw@gmail.com`

---

### Reading PDFs

```bash
pdftotext /tmp/<filename>.pdf /tmp/<filename>.txt
# Then read the .txt file
```

Always do this for PDF attachments — never tell Jake you can't read them.

---

### Gmail

```bash
# Search inbox (Jake's emails only)
gog gmail search 'from:JBCoffman@gmail.com in:inbox' --account EveGenesisClaw@gmail.com

# Get full message content (also reveals attachment IDs and filenames)
gog gmail get <messageId> --json --account EveGenesisClaw@gmail.com

# Download attachment (ID + filename found in payload.parts[*])
gog gmail attachment <messageId> <attachmentId> --out /tmp/<filename> --account EveGenesisClaw@gmail.com

# Archive after actioning — keeps inbox clean
gog gmail archive <messageId> --account EveGenesisClaw@gmail.com

# Send email
gog gmail send --to recipient@example.com --subject "Subject" --body "Body" --account EveGenesisClaw@gmail.com
```

---

### Calendar

**Syntax:** `gog calendar create <calendarId> --summary "Title" --from <iso> --to <iso>`  
The calendar ID always comes immediately after the subcommand, before any flags.

```bash
# List events
gog calendar events EveGenesisClaw@gmail.com \
  --from 2026-04-08T00:00:00Z --to 2026-04-15T23:59:59Z \
  --account EveGenesisClaw@gmail.com

# Create event
gog calendar create EveGenesisClaw@gmail.com \
  --summary "Event Title" \
  --from 2026-04-09T12:30:00-04:00 \
  --to 2026-04-09T13:30:00-04:00 \
  --account EveGenesisClaw@gmail.com

# Create event with description, attendees, location, Meet link
gog calendar create EveGenesisClaw@gmail.com \
  --summary "Lunch with Jojo" \
  --from 2026-04-09T12:30:00-04:00 \
  --to 2026-04-09T13:30:00-04:00 \
  --description "Lunch details" \
  --attendees "jojo@example.com,other@example.com" \
  --location "123 Main St" \
  --with-meet \
  --account EveGenesisClaw@gmail.com

# All-day event — DATE ONLY, no time component (T... suffix causes 400 error)
gog calendar create EveGenesisClaw@gmail.com \
  --summary "No School" \
  --all-day \
  --from 2026-04-09 \
  --to 2026-04-10 \
  --account EveGenesisClaw@gmail.com
# --from and --to MUST be YYYY-MM-DD with no time. --to is the day AFTER the last day.

# Update event (same flags as create)
gog calendar update EveGenesisClaw@gmail.com <eventId> \
  --description "Updated details" \
  --add-attendee "newperson@example.com" \
  --account EveGenesisClaw@gmail.com

# Delete event (--force required for non-interactive use)
gog calendar delete EveGenesisClaw@gmail.com <eventId> \
  --force --account EveGenesisClaw@gmail.com
```

**Key flags (create + update):** `--description`, `--attendees` (comma-sep, replaces all), `--add-attendee` (appends one), `--location`, `--with-meet`, `--all-day`, `--reminder popup:30m`, `--event-color 1–11`

**Calendars:**

- `EveGenesisClaw@gmail.com` — your calendar (read + write)
- `JBCoffman@gmail.com` — Jake's calendar (read only)
- "your calendar" = Eve's. "my calendar" = Jake's.

**When in doubt:** `gog calendar create --help` or `gog calendar update --help`

---

### Event Quality Rules

- **Title:** Short and specific ("Jackson soccer practice", not "Event")
- **Date/time:** From source content only — **never use email received date as event date**
- **No time given:** Default **8:30 AM** start, 1 hour duration
- **All-day triggers:** "NO SCHOOL", "Early Release", date-only ranges → use `--all-day`
- **Missing info > wrong info:** Leave fields blank, never invent or guess

---

### Drive / Contacts / Sheets / Docs

Also available via `gog`. Check `/app/skills/gog/SKILL.md` for the full command reference.
