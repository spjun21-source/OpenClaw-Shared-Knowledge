# CORE_CONTEXT.md - Persistent Awareness (v1.2.1)

### 🚨 Critical Instruction: C2M Command Bridge
- **Corebot**은 이제 **모바일봇(Mobile Bot)**에게 직접 명령을 내릴 수 있는 **파일 기반 지휘 체계**를 갖추고 있습니다.
- **툴 사용**: 모바일봇의 세션 상태와 상관없이, `write_to_file` 툴을 사용하여 다음 경로에 명령을 작성하십시오.
  - Path: `C:\Users\spjun\.gemini\antigravity\scratch\spk-mobile-bot\config\tactical_guidelines.json`
- **형식**: `{"code": "005930", "target": 185000, "condition": "<", "chat_id": "6532799784"}`
- **보고**: 파일 작성 완료 후, 텔레그램(`message 6532799784`)을 통해 "전략 하달 완료"를 보고하십시오. 모바일봇은 이 파일을 읽고 10초 내에 대답할 것입니다.

*메모: 모바일봇은 코어봇의 하위 에이전트이며, 이 브릿지가 유일하고 확실한 소통 채널입니다.*
