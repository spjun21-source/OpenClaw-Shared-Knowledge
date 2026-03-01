import WebSocket from 'ws'; // WebSocket 모듈 import
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// LS증권 WebSocket API 설정 (market_monitor_architecture_design.md 참조)
const WS_ENDPOINT = 'wss://openapi.ls-sec.co.kr:9443/websocket';

// 실제 ACCESS_TOKEN은 환경 변수에서 가져옵니다.
const ACCESS_TOKEN = process.env.LS_SEC_ACCESS_TOKEN;

// 실시간 시세 캐시 (메모리 DB 역할)
const realtimeCache = {}; 

function log(message) {
    console.log(`[LS_WS_ADAPTER] ${new Date().toISOString()}: ${message}`);
}

async function connectWebSocket() {
    if (!ACCESS_TOKEN) {
        log('오류: LS_SEC_ACCESS_TOKEN 환경 변수가 설정되지 않았습니다. 연결할 수 없습니다.');
        return;
    }
    log('WebSocket 연결 시도...');
    const ws = new WebSocket(WS_ENDPOINT, {
        headers: {
            'token': ACCESS_TOKEN,
            // 추가적인 인증/헤더 필요 시 여기에 포함
        }
    });

    ws.onopen = () => {
        log('WebSocket 연결 성공.');
        // TODO: 연결 성공 후 실시간 시세 등록 (tr_type: 3) 메시지 전송 로직 구현
        // 전실장님 시나리오: 삼성전자, 코스피200 선물, 옵션 콜/풋
        // 예시: ws.send(JSON.stringify({ header: { tr_type: '3' }, body: { tr_cd: 'H0001', tr_key: '005930' } })); // 삼성전자 실시간 시세 요청
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        log(`메시지 수신: ${JSON.stringify(data)}`);

        // TODO: 수신된 실시간 시세 데이터 파싱 및 realtimeCache 업데이트 로직 구현
        // 예: if (data.body.rt_cd === '0' && data.body.msg_cd === 'H0001') {
        //         realtimeCache[data.body.ISUCD] = data.body.prpr; // 현재가 저장
        //     }
    };

    ws.onerror = (error) => {
        log(`WebSocket 오류: ${error.message}`);
        // TODO: 에러 처리 및 재연결 로직 구현
    };

    ws.onclose = (event) => {
        log(`WebSocket 연결 종료: 코드 ${event.code}, 이유: ${event.reason}`);
        // TODO: 연결이 비정상적으로 종료되었을 경우 재연결 로직 구현
    };

    return ws;
}

// 실시간 캐시에서 특정 종목/지수의 현재가 조회
function getRealtimePrice(symbol) {
    return realtimeCache[symbol];
}

// 모듈 내보내기 (향후 OpenClaw Tool에서 호출할 함수)
export { connectWebSocket, getRealtimePrice };

// ============================================================
// CLI Command Parser (for testing)
// ============================================================
const rawArgs = process.argv.slice(2);
const command = rawArgs[0];

switch (command) {
    case "connect":
        connectWebSocket();
        break;
    default:
        console.log("LS증권 WebSocket 어댑터 (테스트용)");
        console.log("Commands:");
        console.log("  connect    LS증권 WebSocket 연결을 시도합니다.");
        break;
}
