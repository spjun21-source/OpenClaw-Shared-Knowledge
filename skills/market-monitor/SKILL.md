---
name: market-monitor
description: 한국 증시 및 해외 선물 시황 모니터링. data.go.kr API로 국내 주식/선물/옵션 시세 조회, Yahoo Finance API로 해외선물(S&P500, Nasdaq, WTI, Gold 등) 실시간 조회.
---

# market-monitor (v2.0)

한국 증시 및 해외 선물 시황 모니터링 스킬.
- **국내 시세 (T+1)**: 금융위원회 공공데이터 API (data.go.kr) — T+1 영업일 오후 1시 이후 업데이트
- **해외 선물**: Yahoo Finance API — 실시간 (야간 시장 포함)
- **국내 실시간 (장중)**: LS증권 WebSocket → 메모리 캐시 HTTP 서버 (Port 18790)

> **⚠️ 장중 데이터 흐름**: `ls_websocket_adapter.js`가 `gateway.cmd`에 의해 백그라운드로 실행됩니다.
> 장중에는 `realtime_price`와 `portfolio_valuation`이 실시간 데이터를 제공합니다.
> 장 종료 후에는 `market_summary`와 `overseas_futures`를 우선 사용하세요.

## Tools

### [tool] market_summary
오늘(또는 최근 영업일) 시황 요약을 조회합니다. 등락률 상위/하위 종목, 거래량 상위 종목을 보여줍니다.

- `date` (string, optional): 조회일 YYYYMMDD (기본: 최근 영업일)
- `count` (number, optional): 표시할 종목 수 (기본: 10)

```bash
node scripts/market_data.js summary
node scripts/market_data.js summary --date 20260211 --count 5
```

### [tool] stock_price
특정 종목의 시세를 조회합니다. 종목코드 또는 종목명으로 검색 가능합니다.

- `query` (string): 종목코드 (예: 005930) 또는 종목명 키워드 (예: 삼성)
- `date` (string, optional): 조회일 YYYYMMDD

```bash
node scripts/market_data.js stock --query 005930
node scripts/market_data.js stock --query 삼성전자 --date 20260211
```

### [tool] futures_price
선물 시세를 조회합니다. KOSPI200 선물 등 주요 선물 상품의 시세를 확인할 수 있습니다.

- `date` (string, optional): 조회일 YYYYMMDD
- `query` (string, optional): 종목명 키워드 (예: KOSPI200, 코스피)

```bash
node scripts/market_data.js futures
node scripts/market_data.js futures --date 20260211 --query KOSPI
```

### [tool] options_price
옵션 시세를 조회합니다.

- `date` (string, optional): 조회일 YYYYMMDD
- `query` (string, optional): 종목명 키워드 (예: KOSPI200, 콜, 풋)

```bash
node scripts/market_data.js options
node scripts/market_data.js options --date 20260211 --query 콜
```

### [tool] overseas_futures
해외선물 실시간 시세를 조회합니다 (야간 시장 포함). S&P 500, Nasdaq, Dow, WTI, Gold, Silver, EUR/USD, 미국 국채 시세를 보여줍니다.

> 이 도구는 **실시간 데이터**를 제공합니다 (Yahoo Finance API). 야간 시장, 미국 장중 등 언제든 사용 가능.

```bash
node scripts/overseas_futures.js report
node scripts/overseas_futures.js send
```

### [tool] realtime_price
LS증권 WebSocket 백그라운드 프로세스의 HTTP 캐시 서버(Port 18790)에서 초단위 실시간 데이터를 즉시 조회합니다.

- `symbol` (string): **종목코드** (예: 005930, 101V6000) 또는 **한글명** (예: 삼성전자)

> **v2.0 변경사항**: 캐시 키가 한글명 → 종목코드로 정규화됨. 한글명 검색도 지원 (fallback).

```bash
node scripts/ls_websocket_adapter.js get 005930
node scripts/ls_websocket_adapter.js get 101V6000
node scripts/ls_websocket_adapter.js health
```

### [tool] portfolio_valuation
`portfolio_config.json`에 정의된 포트폴리오의 실시간 손익 및 호가를 평가하여 리포트합니다.
Primary: WS Adapter 캐시(18790) → Fallback: SPK Mobile Bot 캐시(18792)

> **v2.0 변경사항**: 포트폴리오 설정이 `portfolio_config.json`으로 외부화됨. 종목코드 기반 캐시 키 사용.

```bash
node scripts/portfolio_monitor.js
```

### [tool] mock_trade
AI가 판단한 시나리오에 따라 모의매매 계좌에 가상 주문을 체결하고 기록합니다.

- `type` (string): 자산 종류 (`stock` 또는 `option`)
- `action` (string): 매매 방향 (`buy` 또는 `sell`)
- `symbol` (string): 대상 종목코드
- `qty` (number): 주문 수량
- `price` (number): 주문 단가

```bash
node scripts/mock_trade_executor.js <type> <action> <symbol> <qty> <price>
```
