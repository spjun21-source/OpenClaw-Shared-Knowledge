import WebSocket from 'ws';
import https from 'node:https';
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LS_CONFIG = JSON.parse(readFileSync(join(__dirname, "ls_config.json"), "utf8"));

const IS_MOCK = LS_CONFIG.mode === "mock";
const CONFIG_ACCOUNTS = IS_MOCK ? LS_CONFIG.mock_accounts : LS_CONFIG.accounts;

const LOG_PREFIX_F = IS_MOCK ? "[MOCK_FUTURES]" : "[FUTURES]";
const LOG_PREFIX_S = IS_MOCK ? "[MOCK_STOCK]" : "[STOCK]";

// LS증권 WebSocket API 설정
const WS_ENDPOINT = IS_MOCK ? LS_CONFIG.endpoints.wsUrlMock : LS_CONFIG.endpoints.wsUrl;
const TOKEN_ENDPOINT = LS_CONFIG.endpoints.tokenUrl;

const APP_KEY = (IS_MOCK ? null : process.env.LS_SEC_ACCESS_TOKEN) || CONFIG_ACCOUNTS.futures.appkey;
const APP_SECRET = CONFIG_ACCOUNTS.futures.appsecret;

const STOCK_APP_KEY = CONFIG_ACCOUNTS.stock.appkey;
const STOCK_APP_SECRET = CONFIG_ACCOUNTS.stock.appsecret;

// 구독 대상 (ls_config.json에서 로드)
const SUBS = LS_CONFIG.subscriptions || {};
const RECONNECT_CFG = LS_CONFIG.reconnect || { maxRetries: 5, baseDelayMs: 3000 };

// 실시간 시세 캐시 (메모리 DB 역할)
// 키: 종목코드 (예: "005930", "101V6000")
// 값: { price, bid, ask, name, type, time, ... }
const realtimeCache = {};
let OAUTH_TOKEN = null;
let STOCK_OAUTH_TOKEN = null;

// ----------------------------------------------------------
// SQLite 실시간 데이터 캐시 초기화
// ----------------------------------------------------------
const DB_PATH = join(__dirname, "..", "data", "realtime_data_cache.db");
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// 테이블 생성 (초기 1회)
db.exec(`
    CREATE TABLE IF NOT EXISTS ticks (
        code TEXT PRIMARY KEY,
        price TEXT,
        bid TEXT,
        ask TEXT,
        volume TEXT,
        change TEXT,
        type TEXT,
        name TEXT,
        updated_at TEXT
    )
`);

const saveTickStmt = db.prepare(`
    INSERT INTO ticks (code, price, bid, ask, volume, change, type, name, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(code) DO UPDATE SET
        price = excluded.price,
        bid = excluded.bid,
        ask = excluded.ask,
        volume = excluded.volume,
        change = excluded.change,
        type = excluded.type,
        name = excluded.name,
        updated_at = excluded.updated_at
`);

// 상태 추적
const startedAt = new Date().toISOString();
let lastTickAt = null;
let totalTicks = 0;

// ----------------------------------------------------------
// 종목코드 → 한글명 매핑 (빠른 조회용)
// ----------------------------------------------------------
const CODE_NAME_MAP = {
    '005930': '삼성전자',
    '000660': 'SK하이닉스',
    '035420': 'NAVER',
    '005380': '현대자동차',
    '101V6000': 'KOSPI200 선물 26년3월',
    '101W6000': 'KOSPI200 선물 26년6월',
};

function log(message) {
    console.log(`[LS_WS_ADAPTER] ${new Date().toISOString()}: ${message}`);
}

// ----------------------------------------------------------
// OAuth2 토큰 발급
// ----------------------------------------------------------
async function getOAuthToken(appKey, appSecret) {
    return new Promise((resolve, reject) => {
        const body = `grant_type=client_credentials&appkey=${appKey}&appsecretkey=${appSecret}&scope=oob`;
        const url = new URL(TOKEN_ENDPOINT);
        const opts = {
            hostname: url.hostname, port: url.port || 8080,
            path: url.pathname, method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded", "Content-Length": Buffer.byteLength(body) },
            timeout: 10000,
        };
        const req = https.request(opts, (res) => {
            let data = "";
            res.on("data", (c) => (data += c));
            res.on("end", () => {
                try {
                    const json = JSON.parse(data);
                    if (json.access_token) resolve(json.access_token);
                    else reject(new Error(`Token error: ${data}`));
                } catch (e) {
                    reject(new Error(`Token parse error: ${e.message} / raw: ${data}`));
                }
            });
        });
        req.on("error", reject);
        req.write(body);
        req.end();
    });
}

// ----------------------------------------------------------
// WebSocket 연결 (자동 재연결 포함)
// ----------------------------------------------------------
function createReconnectingWS(label, token, trCodes, targetKeys, onMessage) {
    let retryCount = 0;
    let ws = null;

    function connect() {
        ws = new WebSocket(WS_ENDPOINT);

        ws.onopen = () => {
            retryCount = 0; // 연결 성공 시 카운터 리셋
            log(`${label} WebSocket 연결 성공.`);

            // 각 TR코드 × 각 종목코드 조합으로 구독 요청
            for (const trCd of trCodes) {
                for (const trKey of targetKeys) {
                    const msg = {
                        header: { token, tr_type: '3' },
                        body: { tr_cd: trCd, tr_key: trKey }
                    };
                    ws.send(JSON.stringify(msg));
                    log(`${label} 구독 요청: ${trCd} / ${trKey}`);
                }
            }
        };

        ws.onmessage = (event) => {
            try {
                onMessage(event);
            } catch (e) {
                log(`${label} 메시지 처리 오류: ${e.message}`);
            }
        };

        ws.onerror = (error) => {
            log(`${label} WebSocket 오류: ${error.message}`);
        };

        ws.onclose = (event) => {
            log(`${label} WebSocket 연결 종료 (코드: ${event.code}). 재연결 시도...`);
            scheduleReconnect();
        };
    }

    function scheduleReconnect() {
        if (retryCount >= RECONNECT_CFG.maxRetries) {
            log(`${label} 최대 재연결 횟수(${RECONNECT_CFG.maxRetries}) 초과. 60초 후 다시 시도.`);
            retryCount = 0; // 리셋 후 재시도 루프
            setTimeout(connect, 60000);
            return;
        }
        const delay = RECONNECT_CFG.baseDelayMs * Math.pow(2, retryCount);
        retryCount++;
        log(`${label} ${delay}ms 후 재연결 (시도 ${retryCount}/${RECONNECT_CFG.maxRetries})`);
        setTimeout(connect, delay);
    }

    connect();
    return { getWs: () => ws };
}

// ----------------------------------------------------------
// 캐시 업데이트 함수
// ----------------------------------------------------------
function updateCache(code, data) {
    if (!realtimeCache[code]) realtimeCache[code] = {};
    Object.assign(realtimeCache[code], data);
    const now = new Date().toISOString();
    realtimeCache[code].time = now;
    realtimeCache[code].code = code;
    if (CODE_NAME_MAP[code]) realtimeCache[code].name = CODE_NAME_MAP[code];
    
    // SQLite Persistence
    try {
        saveTickStmt.run(
            code,
            String(realtimeCache[code].price || ""),
            String(realtimeCache[code].bid || ""),
            String(realtimeCache[code].ask || ""),
            String(realtimeCache[code].volume || ""),
            String(realtimeCache[code].change || ""),
            String(realtimeCache[code].type || ""),
            String(realtimeCache[code].name || ""),
            now
        );
    } catch (e) {
        log(`[SQLite] 저장 오류: ${e.message}`);
    }

    lastTickAt = realtimeCache[code].time;
    totalTicks++;
}

// ----------------------------------------------------------
// 메인 연결 함수
// ----------------------------------------------------------
async function connectWebSocket() {
    if (!APP_KEY || !STOCK_APP_KEY) {
        log('오류: 접근 가능한 선물/주식 앱키가 없습니다.');
        return;
    }
    log('OAuth2 토큰 발급 시도...');

    try {
        OAUTH_TOKEN = await getOAuthToken(APP_KEY, APP_SECRET);
        STOCK_OAUTH_TOKEN = await getOAuthToken(STOCK_APP_KEY, STOCK_APP_SECRET);
        log('OAuth2 발급 성공! 선물 및 주식 토큰 획득.');
    } catch (e) {
        log(`토큰 발급 실패: ${e.message}`);
        return;
    }

    // ----------------------------------------------------------
    // HTTP 캐시 공유 서버 (Port 18790)
    // ----------------------------------------------------------
    const CACHE_PORT = 18790;
    const httpServer = http.createServer((req, res) => {
        const url = new URL(req.url, `http://localhost:${CACHE_PORT}`);

        // Health check endpoint
        if (url.pathname === '/health') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                status: 'ok',
                cacheSize: Object.keys(realtimeCache).length,
                cachedSymbols: Object.keys(realtimeCache),
                lastTickAt,
                totalTicks,
                startedAt,
                uptime: Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000) + 's',
            }));
            return;
        }

        // GET /get?symbol=005930 — 특정 종목 조회
        if (url.pathname === '/get') {
            const symbol = url.searchParams.get('symbol');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            if (symbol && realtimeCache[symbol]) {
                res.end(JSON.stringify(realtimeCache[symbol]));
            } else if (symbol) {
                // 한글명으로 검색 fallback
                const found = Object.values(realtimeCache).find(v => v.name === symbol);
                res.end(JSON.stringify(found || { error: `'${symbol}' not found`, available: Object.keys(realtimeCache) }));
            } else {
                res.end(JSON.stringify({ error: 'symbol parameter required' }));
            }
            return;
        }

        // 기본: 전체 캐시 반환
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(realtimeCache));
    });

    httpServer.listen(CACHE_PORT, () => {
        log(`실시간 캐시 HTTP 서버 시작 (Port: ${CACHE_PORT})`);
        log(`  GET /         → 전체 캐시`);
        log(`  GET /health   → 상태 확인`);
        log(`  GET /get?symbol=005930 → 특정 종목`);
    });

    // ----------------------------------------------------------
    // 1. Futures WebSocket (선물호가)
    // ----------------------------------------------------------
    const futuresSubs = SUBS.futures || { tr_codes: ['FH0'], targets: ['101V6000'] };

    createReconnectingWS(LOG_PREFIX_F, OAUTH_TOKEN, futuresSubs.tr_codes, futuresSubs.targets, (event) => {
        const message = event.data.toString('utf8');
        const data = JSON.parse(message);
        const trCd = data.header?.tr_cd;

        // 구독 확인 응답 무시
        if (data.header?.rsp_cd === '00000') {
            log(`${LOG_PREFIX_F} 구독 응답: ${data.header?.rsp_msg || 'OK'} (${trCd})`);
            return;
        }

        if (data.body) {
            // LS증권 실시간 API: shcode(종목코드), hname(한글명) 등
            const code = data.body.shcode || data.body.futcode || data.header?.tr_key || '';
            if (!code) return;

            updateCache(code, {
                price: data.body.price || data.body.close || data.body.curpr || 'N/A',
                bid: data.body.bidho1 || data.body.bidho || 'N/A',
                ask: data.body.offerho1 || data.body.offerho || 'N/A',
                volume: data.body.cvolume || data.body.volume || '0',
                change: data.body.change || data.body.diff || '0',
                type: 'Futures',
            });
        }
    });

    // ----------------------------------------------------------
    // 2. Stock WebSocket (주식 체결가)
    // ----------------------------------------------------------
    const stockSubs = SUBS.stocks || { tr_codes: ['K3_'], targets: ['005930', '000660'] };

    createReconnectingWS(LOG_PREFIX_S, STOCK_OAUTH_TOKEN, stockSubs.tr_codes, stockSubs.targets, (event) => {
        const message = event.data.toString('utf8');
        const data = JSON.parse(message);
        const trCd = data.header?.tr_cd;

        if (data.header?.rsp_cd === '00000') {
            log(`${LOG_PREFIX_S} 구독 응답: ${data.header?.rsp_msg || 'OK'} (${trCd})`);
            return;
        }

        if (data.body) {
            const code = data.body.shcode || data.header?.tr_key || '';
            if (!code) return;

            updateCache(code, {
                price: data.body.price || data.body.cheprice || 'N/A',
                change: data.body.change || data.body.diff || '0',
                volume: data.body.cvolume || data.body.volume || '0',
                open: data.body.open || 'N/A',
                high: data.body.high || 'N/A',
                low: data.body.low || 'N/A',
                type: 'Stock',
            });
        }
    });
}

// 실시간 캐시에서 특정 종목/지수의 현재가 조회
function getRealtimePrice(symbol) {
    return realtimeCache[symbol];
}

export { connectWebSocket, getRealtimePrice };

// ============================================================
// CLI Command Parser (for OpenClaw Tools)
// ============================================================
const rawArgs = process.argv.slice(2);
const command = rawArgs[0];

switch (command) {
    case "connect":
        connectWebSocket();
        break;

    case "get": {
        const symbolToGet = rawArgs[1];
        if (!symbolToGet) {
            console.log("사용법: get <종목코드 또는 한글명>");
            console.log("예: get 005930  /  get 삼성전자  /  get 101V6000");
            process.exit(1);
        }

        const GET_PORT = 18790;
        // 먼저 종목코드로 시도, 없으면 이름으로 검색
        http.get(`http://localhost:${GET_PORT}/get?symbol=${encodeURIComponent(symbolToGet)}`, (res) => {
            let chunkData = "";
            res.on("data", (c) => chunkData += c);
            res.on("end", () => {
                try {
                    const result = JSON.parse(chunkData);
                    if (result.error) {
                        console.log(`[LS_WS_ADAPTER] ${result.error}`);
                        if (result.available) console.log(`캐시 목록: ${result.available.join(', ')}`);
                    } else {
                        console.log(`[LS_WS_ADAPTER] ${symbolToGet} 실시간 정보:`);
                        console.log(JSON.stringify(result, null, 2));
                    }
                } catch (e) {
                    console.log(`[LS_WS_ADAPTER] 캐시 데이터 파싱 오류: ${e.message}`);
                }
            });
        }).on("error", (e) => {
            console.log(`[LS_WS_ADAPTER] 캐시 서버 통신 오류 (마스터 프로세스 실행 중인지 확인): ${e.message}`);
        });
        break;
    }

    case "health": {
        const HEALTH_PORT = 18790;
        http.get(`http://localhost:${HEALTH_PORT}/health`, (res) => {
            let data = "";
            res.on("data", (c) => data += c);
            res.on("end", () => {
                try {
                    console.log(JSON.stringify(JSON.parse(data), null, 2));
                } catch (e) {
                    console.log(data);
                }
            });
        }).on("error", (e) => {
            console.log(`[LS_WS_ADAPTER] 서버 응답 없음: ${e.message}`);
        });
        break;
    }

    default:
        console.log("LS증권 WebSocket 어댑터 v2.0");
        console.log("Commands:");
        console.log("  connect         WebSocket 연결 및 실시간 구독 시작");
        console.log("  get <종목코드>   캐시 데이터 조회 (예: get 005930)");
        console.log("  health          서버 상태 확인");
        break;
}
