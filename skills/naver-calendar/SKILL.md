---
name: naver-calendar
description: Manage Naver Calendar events via CalDAV. Use to list upcoming events or add new events to the `spjun21@naver.com` calendar.
---

# naver-calendar

Manage Naver Calendar events using CalDAV.

## Setup

This skill requires `caldav` Python library.

## Tools

### [tool] list_events
List upcoming events from the Naver Calendar. Returns a list of events with their start time and summary.

- **Returns**: A list of events strings.

```bash
node scripts/manage_naver.js list
```

### [tool] add_event
Add a new event to the Naver Calendar.

- `summary` (string): The title or summary of the event.
- `start` (string): The start time of the event in ISO 8601 format (e.g., "2026-02-10T14:00:00").
- `end` (string, optional): The end time of the event in ISO 8601 format. If not provided, defaults to 1 hour after start or same as start.

```bash
node scripts/manage_naver.js add --summary "{{summary}}" --start "{{start}}" --end "{{end}}"
```
