import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configuration Paths
const BRIDGE_PATH = path.resolve(__dirname, '..', '..', '..', 'config', 'kmc_commands.json');
const CONFIG_PATH = path.resolve(__dirname, '..', '..', '..', 'config', 'kmc_newsbot_config.json');

console.log(`[BOOT] Bridge: ${BRIDGE_PATH}`);
console.log(`[BOOT] Config: ${CONFIG_PATH}`);

// Load Config
let config;
try {
    config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    console.log(`[BOOT] Config loaded for Master: ${config.telegram.master_id}`);
} catch (e) {
    console.error(`[BOOT] Config error: ${e.message}`);
    process.exit(1);
}

const BOT_TOKEN = config.telegram.botToken;

async function sendTelegramMessage(chatId, text) {
    console.log(`[TELEGRAM] Sending to ${chatId}... (Length: ${text.length})`);
    if (!text) {
        console.error("[TELEGRAM] Error: Attempted to send empty text");
        return { ok: false, description: "Local Error: Empty Text" };
    }

    return new Promise((resolve) => {
        const payload = JSON.stringify({
            chat_id: chatId,
            text: text,
            parse_mode: 'Markdown'
        });

        const options = {
            hostname: 'api.telegram.org',
            port: 443,
            path: `/bot${BOT_TOKEN}/sendMessage`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve(parsed);
                } catch (e) {
                    resolve({ ok: false, description: `JSON Parse Error: ${data.substring(0, 50)}` });
                }
            });
        });

        req.on('error', (e) => resolve({ ok: false, description: `Request Error: ${e.message}` }));
        req.write(payload);
        req.end();
    });
}

async function pollBridge() {
    if (!fs.existsSync(BRIDGE_PATH)) {
        console.log(`[POLL] Bridge file missing: ${BRIDGE_PATH}`);
        return;
    }

    try {
        const raw = fs.readFileSync(BRIDGE_PATH, 'utf8');
        if (!raw) return;
        
        const bridge = JSON.parse(raw);
        const pending = bridge.commands.filter(c => c.status === 'PENDING');

        if (pending.length === 0) return;

        console.log(`[POLL] Found ${pending.length} pending commands`);

        for (const cmd of pending) {
            console.log(`[PROCESS] Command ID: ${cmd.id}, Type: ${cmd.type}`);
            
            if (cmd.type === 'SEND_QT') {
                const targetId = cmd.payload.target_id || config.telegram.master_id;
                const messageText = cmd.payload.content || cmd.payload.text || "";
                
                console.log(`[PROCESS] Target: ${targetId}, Content Snippet: ${messageText.substring(0, 30)}...`);
                
                const result = await sendTelegramMessage(targetId, messageText);
                
                if (result.ok) {
                    console.log(`[SUCCESS] Sent to ${targetId}`);
                    cmd.status = 'COMPLETED';
                    cmd.result = 'OK';
                } else {
                    console.error(`[FAILURE] Telegram error: ${result.description}`);
                    cmd.status = 'FAILED';
                    cmd.error = result.description;
                }
            } else {
                console.log(`[PROCESS] Unknown command type: ${cmd.type}`);
                cmd.status = 'SKIPPED';
            }
            
            bridge.last_processed_id = cmd.id;
        }

        fs.writeFileSync(BRIDGE_PATH, JSON.stringify(bridge, null, 2));
        console.log(`[POLL] Bridge updated.`);
    } catch (e) {
        console.error(`[ERROR] Bridge processing error: ${e.message}`);
    }
}

// Start polling
setInterval(pollBridge, 5000);
console.log("[KMC] KMCNewsbot Bridge Poller started (v1.1)");
pollBridge(); // Initial poll
