# OpenClaw-Shared-Knowledge

The central configuration and skills repository for OpenClaw Core Bot. 
This repository contains safe, scrubbed configuration templates and shared skills that define the bot's identity, capabilities, and settings.

## Structure

* `openclaw.example.json`: A template configuration file scrubbed of sensitive API keys and tokens. Use this as a reference for your local `openclaw.json`.
* `skills/`: Contains all the custom skills implemented for OpenClaw, such as `market-monitor`, `naver-calendar`, etc.
* `AGENTS.md`, `TOOLS.md`, `openclaw.md`: Core system identity and prompt definitions.

## Setup Instructions

1. Clone this repository to your OpenClaw workspace:
   ```bash
   cd ~/.openclaw/workspace
   git clone https://github.com/spjun21-source/OpenClaw-Shared-Knowledge.git
   ```

2. Make sure your local `~/.openclaw/openclaw.json` contains your real API keys securely. Do not commit it! If you need to add environment variables, consider using a `.env` file depending on your local runner's support.

3. Symlink the `skills` directory for immediate updates:
   ```powershell
   # In PowerShell (Run as Administrator if needed, or use Junctions)
   Remove-Item -Recurse -Force ~/.openclaw/skills
   New-Item -ItemType Junction -Path ~/.openclaw/skills -Target ~/.openclaw/workspace/OpenClaw-Shared-Knowledge/skills
   ```

4. Restart your OpenClaw gateway and TUI to apply changes.
