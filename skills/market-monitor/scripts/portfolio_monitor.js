import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ----------------------------------------------------------
// 포트폴리오 설정 외부 파일에서 로드
// ----------------------------------------------------------
const PORTFOLIO_CONFIG_PATH = path.join(__dirname, 'portfolio_config.json');
let portfolioConfig;
try {
    portfolioConfig = JSON.parse(fs.readFileSync(PORTFOLIO_CONFIG_PATH, 'utf8'));
} catch (e) {
    console.log(`[경고] portfolio_config.json 로드 실패: ${e.message}`);
    console.log('[경고] 기본값 사용');
    portfolioConfig = {
        samsung: { code: '005930', name: '삼성전자', shares: 9, avgPrice: 217750 },
        futures: { code: '101V6000', name: 'KOSPI200 선물 26년3월', contracts: 1, entryPrice: null },
        options: { targetPremium: 1.7, strategy: '위클리 콜/풋 옵션 진입 후보', topN: 2 },
    };
}

const SAMSUNG = portfolioConfig.samsung;
const FUTURES = portfolioConfig.futures;
const OPTIONS = portfolioConfig.options;

// ----------------------------------------------------------
// 캐시 서버에서 데이터 로드
// ----------------------------------------------------------
const PRIMARY_PORT = 18795;    // ls_websocket_adapter 캐시
const FALLBACK_PORT = 18791;   // SPK Mobile Bot 공유 캐시

function fetchCache(port) {
    return new Promise((resolve, reject) => {
        http.get(`http://localhost:${port}`, { timeout: 3000 }, (res) => {
            let data = "";
            res.on("data", (c) => data += c);
            res.on("end", () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error(`JSON 파싱 오류: ${e.message}`));
                }
            });
        }).on("error", reject);
    });
}

async function getCacheDB() {
    // 1. Primary: ls_websocket_adapter 캐시 서버 (Port 18790)
    try {
        const cache = await fetchCache(PRIMARY_PORT);
        if (Object.keys(cache).length > 0) return { source: 'ws_adapter', data: cache };
    } catch (e) {
        console.log(`[정보] Primary 캐시(${PRIMARY_PORT}) 연결 실패: ${e.message}`);
    }

    // 2. Fallback: SPK Mobile Bot 공유 캐시 (Port 18792)
    try {
        const cache = await fetchCache(FALLBACK_PORT);
        if (Object.keys(cache).length > 0) return { source: 'mobile_bot', data: cache };
    } catch (e) {
        console.log(`[정보] Fallback 캐시(${FALLBACK_PORT}) 연결 실패: ${e.message}`);
    }

    return null;
}

// ----------------------------------------------------------
// 포트폴리오 리포트 생성
// ----------------------------------------------------------
async function generateReport() {
    const result = await getCacheDB();

    if (!result) {
        console.log(`[오류] 모든 캐시 서버 통신 실패.`);
        console.log(`  - ls_websocket_adapter (Port ${PRIMARY_PORT}): 실행 중인지 확인`);
        console.log(`  - SPK Mobile Bot 캐시 (Port ${FALLBACK_PORT}): Phase 2 구축 후 사용 가능`);
        return;
    }

    const cacheDB = result.data;
    console.log(`[데이터 출처: ${result.source === 'ws_adapter' ? 'LS WebSocket Adapter' : 'SPK Mobile Bot'}]`);
    console.log("");

    // 1. 삼성전자
    // 캐시 키: 종목코드 (예: "005930") — v2.0 정규화
    const samsung = cacheDB[SAMSUNG.code]          // 코드 기반 조회 (v2.0)
                  || cacheDB[SAMSUNG.name]          // 한글명 기반 fallback (v1.x 호환)
                  || null;
    let samsungText = "- 데이터 없음";
    if (samsung && samsung.price && samsung.price !== "N/A") {
        const currentPrice = parseFloat(String(samsung.price).replace(/,/g, ''));
        if (currentPrice > 0) {
            const profitLoss = (currentPrice - SAMSUNG.avgPrice) * SAMSUNG.shares;
            samsungText = `${currentPrice.toLocaleString()}원 (평균단가: ${SAMSUNG.avgPrice.toLocaleString()}원, 손익: ${profitLoss > 0 ? '+' : ''}${profitLoss.toLocaleString()}원)`;
        }
    }

    // 2. KOSPI 200 선물
    let futuresText = "- 데이터 없음 (휴장 또는 수신 대기 중)";
    const futuresData = cacheDB[FUTURES.code]       // 코드 기반 (v2.0)
                     || Object.entries(cacheDB).find(([k, v]) => v.type === "Futures")?.[1]  // 타입 기반 fallback
                     || null;
    let futuresKey = FUTURES.code;
    if (!cacheDB[FUTURES.code]) {
        const found = Object.entries(cacheDB).find(([k, v]) => v.type === "Futures");
        if (found) futuresKey = found[0];
    }

    if (futuresData) {
        const name = futuresData.name || futuresKey;
        futuresText = `[${name}] 매수1호가: ${futuresData.bid || 'N/A'}, 매도1호가: ${futuresData.ask || 'N/A'}, 현재가: ${futuresData.price || 'N/A'}`;
    }

    // 3. 위클리 옵션 (프리미엄 기준 필터)
    const optionEntries = Object.entries(cacheDB).filter(([k, v]) => v.type === "Option");
    const calls = [];
    const puts = [];

    for (const [key, opt] of optionEntries) {
        const askStr = String(opt.ask || '0').replace(/,/g, '');
        const askVal = parseFloat(askStr);
        if (askVal <= 0) continue;

        const diff = Math.abs(askVal - OPTIONS.targetPremium);
        const name = opt.name || key;
        const entry = { key, name, price: askVal, diff };

        if (name.includes("콜") || name.includes(" C ") || key.includes("C")) calls.push(entry);
        if (name.includes("풋") || name.includes(" P ") || key.includes("P")) puts.push(entry);
    }

    calls.sort((a, b) => a.diff - b.diff);
    puts.sort((a, b) => a.diff - b.diff);

    const topCalls = calls.slice(0, OPTIONS.topN);
    const topPuts = puts.slice(0, OPTIONS.topN);

    let optionsText = "";
    if (topCalls.length === 0 && topPuts.length === 0) {
        optionsText = "- 데이터 없음 (휴장 또는 옵션 데이터 수신 대기 중)\n";
    } else {
        optionsText += "  [콜 옵션]\n";
        topCalls.forEach(c => optionsText += `   - ${c.name} (프리미엄 1호가: ${c.price})\n`);
        optionsText += "  [풋 옵션]\n";
        topPuts.forEach(p => optionsText += `   - ${p.name} (프리미엄 1호가: ${p.price})\n`);
    }

    // 리포트 출력
    console.log("=========================================");
    console.log("📊 [실시간 포트폴리오 분석 리포트]");
    console.log("=========================================");
    console.log(`1. ${SAMSUNG.name} (${SAMSUNG.shares}주 보유)`);
    console.log(`   현재가 및 손익: ${samsungText}`);
    console.log("");
    console.log(`2. ${FUTURES.name} (${FUTURES.contracts}계약)`);
    console.log(`   실시간 시세: ${futuresText}`);
    console.log("");
    console.log(`3. KOSPI 200 위클리 옵션 (목표 프리미엄: ${OPTIONS.targetPremium} 부근 진입 후보)`);
    console.log(optionsText);
    console.log("=========================================");

    // 모의매매 포트폴리오 상태 (있으면 출력)
    try {
        const mockPath = path.join(__dirname, 'mock_portfolio.json');
        if (fs.existsSync(mockPath)) {
            const mockDB = JSON.parse(fs.readFileSync(mockPath, 'utf8'));
            console.log("💰 [모의매매 가상 포트폴리오]");
            console.log(`   - 현금 잔고: ${mockDB.cash_balance.toLocaleString()} 원`);
            const mockOptions = Object.keys(mockDB.options || {});
            if (mockOptions.length > 0) {
                console.log(`   - 보유 옵션:`);
                mockOptions.forEach(opt => {
                    const p = mockDB.options[opt];
                    console.log(`     * ${opt} (${p.position.toUpperCase()} ${p.qty}개, 진입가: ${p.entry_price})`);
                });
            }
            console.log("=========================================");
        }
    } catch (e) {
        // 모의매매 없으면 무시
    }
}

generateReport();
