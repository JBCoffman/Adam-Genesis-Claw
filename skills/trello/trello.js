#!/usr/bin/env node
/**
 * trello - CLI for Eve's Trello integration
 *
 * Reads credentials from environment:
 *   TRELLO_API_KEY   - Trello API key
 *   TRELLO_TOKEN     - Trello user token
 *   TRELLO_BOARD_ID  - Target board (optional, defaults to Eve board)
 *   TRELLO_LIST_ID   - Default list for new cards (optional, defaults to To Do)
 *
 * Commands:
 *   create-card <title> [--desc <text>] [--list <name|id>] [--assign] [--due <date>]
 *   assign <cardId>
 *   set-due <cardId> <date>
 *   list-lists
 *   get-card <cardId>
 */

const API_KEY = process.env.TRELLO_API_KEY;
const TOKEN = process.env.TRELLO_TOKEN;
const BOARD_ID = process.env.TRELLO_BOARD_ID || "69dc3b64f75d0da7764082a9";
const DEFAULT_LIST_ID = process.env.TRELLO_LIST_ID || "69dc3dc70b3ad81814230115";
const JAKE_MEMBER_ID = process.env.TRELLO_MEMBER_ID || "652b2607bed36c61d4d2399b";

const BASE = "https://api.trello.com/1";

function authParams() {
  return `key=${API_KEY}&token=${TOKEN}`;
}

async function api(method, path, body = null) {
  const url = `${BASE}${path}${path.includes("?") ? "&" : "?"}${authParams()}`;
  const opts = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Trello API error ${res.status}: ${text}`);
  }
  return res.json();
}

async function resolveList(nameOrId) {
  if (!nameOrId) return DEFAULT_LIST_ID;
  // If it looks like an ID (24 hex chars), use it directly
  if (/^[a-f0-9]{24}$/i.test(nameOrId)) return nameOrId;
  // Otherwise resolve by name
  const lists = await api("GET", `/boards/${BOARD_ID}/lists`);
  const match = lists.find((l) => l.name.toLowerCase() === nameOrId.toLowerCase());
  if (!match) {
    const names = lists.map((l) => l.name).join(", ");
    throw new Error(`List "${nameOrId}" not found. Available: ${names}`);
  }
  return match.id;
}

function parseDate(input) {
  if (!input) return null;
  // Try direct parse first
  const d = new Date(input);
  if (!isNaN(d)) return d.toISOString();
  // Named days
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const lower = input.toLowerCase();
  const idx = days.indexOf(lower);
  if (idx !== -1) {
    const now = new Date();
    const diff = (idx - now.getDay() + 7) % 7 || 7;
    const target = new Date(now);
    target.setDate(now.getDate() + diff);
    target.setHours(17, 0, 0, 0); // 5 PM on that day
    return target.toISOString();
  }
  throw new Error(
    `Could not parse date: "${input}". Use ISO format (2026-04-20) or a day name (Friday).`,
  );
}

// --- Command handlers ---

async function cmdCreateCard(args) {
  // Parse: title [--desc <text>] [--list <name|id>] [--assign] [--due <date>]
  let title = null;
  let desc = null;
  let listName = null;
  let assign = false;
  let due = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--desc") {
      desc = args[++i];
    } else if (args[i] === "--list") {
      listName = args[++i];
    } else if (args[i] === "--assign") {
      assign = true;
    } else if (args[i] === "--due") {
      due = args[++i];
    } else if (!title) {
      title = args[i];
    }
  }

  if (!title)
    throw new Error(
      "Usage: trello create-card <title> [--desc <text>] [--list <name|id>] [--assign] [--due <date>]",
    );

  const listId = await resolveList(listName);
  const body = { name: title, idList: listId };
  if (desc) body.desc = desc;
  if (assign) body.idMembers = [JAKE_MEMBER_ID];
  if (due) body.due = parseDate(due);

  const card = await api("POST", "/cards", body);
  console.log(`Created: ${card.name}`);
  console.log(`URL: ${card.shortUrl}`);
  console.log(`ID: ${card.id}`);
  if (assign) console.log(`Assigned to Jake`);
  if (due) console.log(`Due: ${new Date(card.due).toDateString()}`);
}

async function cmdAssign(args) {
  const [cardId] = args;
  if (!cardId) throw new Error("Usage: trello assign <cardId>");
  const card = await api("POST", `/cards/${cardId}/idMembers`, { value: JAKE_MEMBER_ID });
  console.log(`Assigned Jake to card: ${cardId}`);
}

async function cmdSetDue(args) {
  const [cardId, dateStr] = args;
  if (!cardId || !dateStr) throw new Error("Usage: trello set-due <cardId> <date>");
  const due = parseDate(dateStr);
  await api("PUT", `/cards/${cardId}`, { due });
  console.log(`Due date set: ${new Date(due).toDateString()}`);
}

async function cmdListLists() {
  const lists = await api("GET", `/boards/${BOARD_ID}/lists`);
  lists.forEach((l) => console.log(`${l.name}: ${l.id}`));
}

async function cmdGetCard(args) {
  const [cardId] = args;
  if (!cardId) throw new Error("Usage: trello get-card <cardId>");
  const card = await api("GET", `/cards/${cardId}`);
  console.log(`Name: ${card.name}`);
  console.log(`URL: ${card.shortUrl}`);
  console.log(`List: ${card.idList}`);
  if (card.due) console.log(`Due: ${new Date(card.due).toDateString()}`);
  if (card.idMembers?.length) console.log(`Members: ${card.idMembers.join(", ")}`);
}

async function cmdListCards(args) {
  // list-cards [--list <name|id>]  — defaults to all open cards on the board
  let listName = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--list") {
      listName = args[++i];
    }
  }

  if (listName) {
    const listId = await resolveList(listName);
    const cards = await api("GET", `/lists/${listId}/cards`);
    cards.forEach((c) => console.log(`${c.id}  ${c.name}`));
  } else {
    const cards = await api("GET", `/boards/${BOARD_ID}/cards/open`);
    cards.forEach((c) => console.log(`${c.id}  ${c.name}`));
  }
}

async function cmdMoveCard(args) {
  // move-card <cardId> <listName|listId>
  const [cardId, listName] = args;
  if (!cardId || !listName) throw new Error("Usage: trello move-card <cardId> <listName|listId>");
  const listId = await resolveList(listName);
  await api("PUT", `/cards/${cardId}`, { idList: listId });
  console.log(`Moved card ${cardId} to list: ${listName}`);
}

async function cmdArchiveCard(args) {
  const [cardId] = args;
  if (!cardId) throw new Error("Usage: trello archive-card <cardId>");
  await api("PUT", `/cards/${cardId}`, { closed: true });
  console.log(`Archived card: ${cardId}`);
}

async function cmdAddComment(args) {
  // add-comment <cardId> <text>
  const [cardId, ...rest] = args;
  if (!cardId || rest.length === 0) throw new Error("Usage: trello add-comment <cardId> <text>");
  const text = rest.join(" ");
  await api("POST", `/cards/${cardId}/actions/comments`, { text });
  console.log(`Comment added to card: ${cardId}`);
}

// --- Main ---

async function main() {
  if (!API_KEY || !TOKEN) {
    console.error("Error: TRELLO_API_KEY and TRELLO_TOKEN must be set in environment");
    process.exit(1);
  }

  const [cmd, ...args] = process.argv.slice(2);

  const commands = {
    "create-card": cmdCreateCard,
    assign: cmdAssign,
    "set-due": cmdSetDue,
    "list-lists": cmdListLists,
    "list-cards": cmdListCards,
    "get-card": cmdGetCard,
    "move-card": cmdMoveCard,
    "archive-card": cmdArchiveCard,
    "add-comment": cmdAddComment,
  };

  if (!cmd || !commands[cmd]) {
    console.error(`Usage: trello <command> [args]`);
    console.error(`Commands: ${Object.keys(commands).join(", ")}`);
    process.exit(1);
  }

  try {
    await commands[cmd](args);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

main();
