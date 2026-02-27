# OpenClaw Configuration (Masked Version)

이 문서는 OpenClaw의 `openclaw.json` 설정 파일 내용을 마크다운 형식으로 정리한 것입니다.
보안을 위해 `apiKey`, `botToken`, `token` 등 민감한 정보들은 `[MASKED]` 처리되었습니다.
실제 사용 시에는 해당 필드에 올바른 값을 직접 입력해야 합니다.

---

```json
{
  "meta": {
    "lastTouchedVersion": "2026.2.3-1",
    "lastTouchedAt": "2026-02-18T10:26:32.736Z"
  },
  "wizard": {
    "lastRunAt": "2026-02-18T10:26:32.720Z",
    "lastRunVersion": "2026.2.3-1",
    "lastRunCommand": "doctor",
    "lastRunMode": "local"
  },
  "auth": {
    "profiles": {
      "google:default": {
        "provider": "google",
        "mode": "api_key"
      }
    }
  },
  "agents": {
    "defaults": {
      "model": {
        "primary": "google/gemini-2.5-flash"
      },
      "workspace": "C:/Users/user/.openclaw/workspace",
      "maxConcurrent": 4,
      "subagents": {
        "maxConcurrent": 8
      }
    },
    "list": [
      {
        "id": "main",
        "workspace": "C:/Users/user/.openclaw/workspace"
      },
      {
        "id": "trading",
        "workspace": "D:/TradingLogs/agent",
        "model": {
          "primary": "google/gemini-2.5-flash"
        },
        "identity": {
          "name": "Trading Log Analyst"
        }
      }
    ]
  },
  "tools": {
    "web": {
      "search": {
        "enabled": true,
        "apiKey": "[MASKED]" 
      },
      "fetch": {
        "enabled": true
      }
    }
  },
  "messages": {
    "ackReactionScope": "group-mentions"
  },
  "commands": {
    "native": "auto",
    "nativeSkills": "auto",
    "restart": true
  },
  "channels": {
    "telegram": {
      "enabled": true,
      "dmPolicy": "allowlist",
      "botToken": "[MASKED]",
      "allowFrom": [
        "6532799784"
      ],
      "groupPolicy": "allowlist",
      "streamMode": "partial"
    }
  },
  "gateway": {
    "port": 18789,
    "mode": "local",
    "bind": "loopback",
    "auth": {
      "mode": "token",
      "token": "[MASKED]"
    },
    "tailscale": {
      "mode": "off",
      "resetOnExit": false
    }
  },
  "skills": {
    "install": {
      "nodeManager": "npm"
    },
    "entries": {
      "naver-calendar": {},
      "market-monitor": {},
      "goplaces": {
        "apiKey": "[MASKED]"
      },
      "local-places": {
        "apiKey": "[MASKED]"
      },
      "nano-banana-pro": {},
      "notion": {
        "apiKey": "[MASKED]"
      }
    }
  },
  "plugins": {
    "entries": {
      "telegram": {
        "enabled": true
      }
    }
  }
}
```