---
name: trello
description: Create and manage Trello cards on Jake's Eve board via the trello CLI.
homepage: https://developer.atlassian.com/cloud/trello/rest/
metadata:
  {
    "openclaw":
      {
        "emoji": "📋",
        "requires": { "bins": ["trello"], "env": ["TRELLO_API_KEY", "TRELLO_TOKEN"] },
      },
  }
---

# Trello Skill

Create and manage cards on Jake's Eve Trello board using the `trello` CLI.

Credentials are pre-configured in the environment. You do not need to pass API keys manually.

## Board Setup

Jake's board: **Eve** — a simple Kanban with three lists:

| List        | Purpose               |
| ----------- | --------------------- |
| To Do       | Default for new cards |
| In Progress | Work underway         |
| Done        | Completed work        |

## Commands

### Create a card

```bash
trello create-card "Card title"
trello create-card "Card title" --desc "More detail"
trello create-card "Card title" --list "In Progress"
trello create-card "Card title" --assign
trello create-card "Card title" --due Friday
trello create-card "Card title" --assign --due 2026-05-01 --desc "Some notes"
```

- `--list` accepts a list name ("To Do", "In Progress", "Done") or a list ID
- `--assign` assigns the card to Jake automatically
- `--due` accepts ISO dates (2026-04-20) or day names (Monday, Friday, etc.)
- Default list is **To Do** if `--list` is omitted

### Assign a card to Jake

```bash
trello assign <cardId>
```

### Set a due date

```bash
trello set-due <cardId> <date>
# date can be ISO (2026-04-20) or a day name (Friday)
```

### List all open cards on the board

```bash
trello list-cards
trello list-cards --list "To Do"
trello list-cards --list "In Progress"
```

Each line is: `<cardId>  <card name>`

### Move a card to a different list

```bash
trello move-card <cardId> "Done"
trello move-card <cardId> "In Progress"
trello move-card <cardId> "To Do"
```

### Archive (close) a card

```bash
trello archive-card <cardId>
```

### Add a comment to a card

```bash
trello add-comment <cardId> "Comment text here"
```

This is a routine, safe operation — no special approval needed. Call it after every action.

### List all lists (with IDs)

```bash
trello list-lists
```

### Get card details

```bash
trello get-card <cardId>
```

## Natural Language Patterns

When Jake says something like:

- "Create a Trello card: buy milk" → `trello create-card "buy milk"`
- "Add a card for fixing the deck light, assign to me" → `trello create-card "Fix the deck light" --assign`
- "Trello: pick up dry cleaning, due Friday" → `trello create-card "Pick up dry cleaning" --due Friday`
- "Create a card in In Progress for the bathroom tiles" → `trello create-card "Bathroom tiles" --list "In Progress"`
- "Make a Trello task: call the vet, assign me, due Thursday" → `trello create-card "Call the vet" --assign --due Thursday`

## Standing Rules

**Always comment on every action.** After any `move-card`, `archive-card`, `assign`, or `set-due` call, immediately follow it with `trello add-comment <cardId> "<action taken>"`. Do not skip this step and do not ask for approval — `add-comment` is a safe, routine operation.

Comment format: be brief and factual. Examples:

- `"Moved to Done by Eve"`
- `"Assigned to Jake by Eve"`
- `"Due date set to Friday by Eve"`
- `"Archived by Eve"`

When Jake asks to move or archive cards without giving IDs, first run `trello list-cards` to get the IDs, then operate on each one. For example:

- "Move all cards to Done" → `trello list-cards`, then for each: `trello move-card <id> Done` + `trello add-comment <id> "Moved to Done by Eve"`
- "Archive the buy milk card" → `trello list-cards`, find it, `trello archive-card <id>` + `trello add-comment <id> "Archived by Eve"`
- "Mark the deck light card as done" → `trello list-cards`, find it, `trello move-card <id> Done` + `trello add-comment <id> "Moved to Done by Eve"`

If the message is ambiguous about which list, default to **To Do** unless Jake specifies otherwise.
Always confirm success by reporting the card name and URL from the command output.
