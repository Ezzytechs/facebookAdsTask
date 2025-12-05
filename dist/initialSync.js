"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initialSync = initialSync;
const puppeteer_1 = __importDefault(require("puppeteer"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const utils_1 = require("./utils");
function saveAdToDisk(ad) {
    try {
        const dir = path_1.default.join("ads_db", ad.page_id);
        fs_1.default.mkdirSync(dir, { recursive: true });
        const file = path_1.default.join(dir, `${ad.id}.json`);
        fs_1.default.writeFileSync(file, JSON.stringify(ad, null, 2));
    }
    catch (err) {
        console.error(`[saveAd] Failed writing ${ad.id}:`, err);
    }
}
async function initialSync(url, max) {
    const seenAds = new Set();
    let total = 0;
    let stoppedEarly = false; // <--- NEW FLAG
    const browser = await puppeteer_1.default.launch({
        headless: true,
        args: ["--no-sandbox"],
    });
    const page = await browser.newPage();
    await page.setDefaultNavigationTimeout(60000);
    console.log("[initialSync] Listening for GraphQL...");
    const onResponse = async (response) => {
        if (stoppedEarly)
            return; // <--- ignore callbacks after closing
        try {
            if (!response.url().includes("/api/graphql"))
                return;
            let body;
            try {
                body = await response.text();
            }
            catch {
                return;
            }
            let json;
            try {
                json = JSON.parse(body);
            }
            catch {
                return;
            }
            const ads = (0, utils_1.extractAdsFromGraphQL)(json);
            for (const ad of ads) {
                if (seenAds.has(ad.id))
                    continue;
                seenAds.add(ad.id);
                saveAdToDisk(ad);
                total++;
                process.stdout.write(`\r[+] Saved ${total} ads...`);
                if (max && total >= max) {
                    console.log("\n[max reached] Stopping early.");
                    stoppedEarly = true;
                    // Remove listener BEFORE closing browser to stop pending async events
                    page.off("response", onResponse);
                    await browser.close();
                    return;
                }
            }
        }
        catch (err) {
            if (!stoppedEarly)
                console.error("[initialSync handler] Error:", err);
        }
    };
    page.on("response", onResponse);
    try {
        console.log("[initialSync] Navigating...");
        await page.goto(url, { waitUntil: "networkidle2" });
    }
    catch (err) {
        console.error("[initialSync] Navigation failed:", err);
    }
    console.log("[initialSync] Scrolling...");
    for (let i = 0; i < 200; i++) {
        if (stoppedEarly)
            break; // <--- Critical
        if (page.isClosed())
            break; // <--- Extra safety
        await page.keyboard.press("PageDown");
        await new Promise((res) => setTimeout(res, 500 + Math.random() * 300));
    }
    // If not stopped early, close normally
    if (!stoppedEarly && !page.isClosed()) {
        await browser.close();
    }
    console.log(`\nDone. Total ads saved: ${total}`);
    return total;
}
