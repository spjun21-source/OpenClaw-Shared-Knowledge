---
name: google-calendar
description: Manage Google Calendar events. Use to list upcoming events or add new events to the calendar.
metadata:
  openclaw:
    emoji: 📅
    requires:
      node: ">=18"
---

# Google Calendar

Manage events on Google Calendar for `spjun21@gmail.com`.

## Usage

This skill provides a script to interact with the Google Calendar API.

### authentication

First time use requires authentication:

```bash
node scripts/manage_calendar.js auth
```

Follow the link to authorize the application.

### List Events

```bash
node scripts/manage_calendar.js list
```

### Add Event

```bash
node scripts/manage_calendar.js add --summary "Meeting with Team" --start "2024-01-20T10:00:00" --end "2024-01-20T11:00:00"
```

## Note to Agent

When the user asks to "analyze schedule" or "add to calendar":
1.  Check for existing events if needed to find a slot.
2.  Extract event details (Summary, Start Time, End Time).
3.  Run the `add` command.
4.  If auth fails, run the `auth` command and ask the user to complete it.
