# MEMORY.md - 코어봇의 장기 기억 (v1.3.0)

## [전략 시나리오 및 목표가(Anchor) 관리 지침] (2026년 3월 2일)

전실장님께서 '현재 시장 전략 보고해줘' 라고 요청하면, 다음 순서와 논리로 분석해서 보고해야 함.

### 1단계. 거시적 시나리오 분석
- 현재 시장을 지배하는 주요 이벤트(예: 이란 사태, US CPI)의 본질을 파악하고, 이것이 KOSPI와 삼성전자의 펀더멘털에 미칠 영향을 정의함.

### 2단계. 전략적 목표가(Fundamental Anchor) 점검
- 맥쿼리 31만 원 등 주요 기관의 목표가와 현재가의 괴리를 분석하여 '가치 투자' 관점의 비중 확대/축소 의견을 제시함.

### 3단계. 필드 드라이버(MobileBot) 작전 지시
- 실시간 티커 감시를 수행하는 **MobileBot**이 사용할 PZC(가격-구간-색) 구간을 설정하고, 어떤 상황에서 어떤 전술(LAPM 등)을 쓸지 지침을 수립함.
- *주의: 1분 단위의 실시간 감시와 매매 알림은 MobileBot의 영역임을 인지하고 중복 보고를 피함.*

---

## 코어봇 v1.3.0 업데이트 내용 (2026년 3월 14일)

- **`V1.3.0` 리팩토링 완료:** `SPK Mobile Bot`의 검증된 실시간 파이프라인과 `CoreBot` 연동 (`To Be 아키텍처`) 성공.
- **`Shared Data Layer` (`realtime_data_cache.db`) 통한 실시간 데이터 연동:** `SPK Mobile Bot`이 수집한 실시간 데이터를 `Shared Price Cache (HTTP)`를 통해 `CoreBot`이 직접 접근할 수 있도록 아키텍처 고도화.
- **`CoreBot`의 실시간 데이터 접근성 및 `portfolio_valuation` 툴의 데이터 활용 능력 대폭 강화.**
- **`C2M Command Bridge` 유지 및 강화:** `tactical_guidelines.json` 기반의 `CoreBot` 지시는 `Mobile Bot`이 10초마다 폴링하여 전술 실행.

---

## 코어봇 v1.2.1 업데이트 내용 (2026년 3월 5일)

- **`MobileBot`과의 `C2M Command Bridge` 활성화 (지휘 체계 고도화):**
    - 텔레그램 보안 정책으로 인한 봇 간 메시지 수신 제약을 해결하기 위해 **`파일 기반 지휘 체계`** 도입.
    - 코어봇이 전략 수립 시 `C:\Users\spjun\.gemini\antigravity\scratch\spk-mobile-bot\config\tactical_guidelines.json` 파일에 JSON 형식의 명령을 직접 작성하여 `MobileBot`에게 하달.
    - `MobileBot`은 10초마다 해당 명령 파일을 감시하며, 수신 즉시 실장님께 "✅ 전략 하달 수신 완료"라고 텔레그램으로 보고.
    - `write_to_file` 툴 사용 규칙: `target` 필드에 감시 가격(숫자), `code` 필드에 종목코드(6자리) 입력.

- **`Daily PZC Strategy & Biotech Liaison` 역할 강화:**
    - `일봉/주간 차트 분석표`를 통해 시장의 핵심 지지/저항(PZC)을 도출하고, 이를 바탕으로 `MobileBot`의 실시간 집행 가이드라인을 수립하는 `전략의 사령탑` 역할 명확화.
    - 바이오 헬스케어 기술 사업화 전문가인 전실장님을 위한 `Biotech Liaison`으로서 관련 산업 분석 및 정보 제공 역량 강화.

---

## 코어봇 v1.2.0 업데이트 내용 (2026년 3월 2일)

- **정체성 대전환 (Strategic Master):** 실시간 매매 감시 업무를 MobileBot에게 이관하고, 전략적 비즈니스 파트너 역할에 집중.
- **Dual-Bot 프로토콜 수립:** CoreBot(전략)과 MobileBot(전술)의 업무 경계 명확화.
- **PZC 및 LAPM 전략 프레임워크 설계:** 실장님의 엑셀 로직을 시스템화하여 MobileBot에게 전수.
- **GitOps 기반 시스템 안정화:** GitHub를 통한 identity 및 soul 파일의 엄격한 버전 관리.
