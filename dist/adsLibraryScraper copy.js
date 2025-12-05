"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initialSync = initialSync;
const puppeteer_1 = __importDefault(require("puppeteer"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
/**
 * Extract ads from Meta's GraphQL payload.
 * Handles real Ads Library JSON structure safely.
 */
function extractAdsFromGraphQL(json) {
    const results = [];
    try {
        const edges = json?.data?.ad_library_main?.search_results_connection?.edges;
        if (!Array.isArray(edges))
            return results;
        for (const edge of edges) {
            const collated = edge?.node?.collated_results;
            if (!Array.isArray(collated))
                continue;
            for (const item of collated) {
                const adId = item?.ad_archive_id;
                const pageId = item?.page_id || item?.snapshot?.page_id || "unknown";
                if (!adId || !pageId)
                    continue;
                results.push({
                    id: adId,
                    page_id: pageId,
                    ...item,
                });
            }
        }
    }
    catch (err) {
        console.error("[extractAds] Unexpected JSON structure:", err);
    }
    return results;
}
/**
 * Save each ad as: ads_db/<page_id>/<ad_id>.json
 */
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
/**
 * Main Sync Function
 */
async function initialSync(url, max) {
    const seenAds = new Set();
    let total = 0;
    const browser = await puppeteer_1.default.launch({
        headless: false,
        args: ["--no-sandbox"],
    });
    const page = await browser.newPage();
    await page.setDefaultNavigationTimeout(60000); // 60s timeout
    await page.setDefaultTimeout(60000);
    console.log("[sync] Listening for GraphQL responses...");
    page.on("response", async (response) => {
        try {
            const requestUrl = response.url();
            if (!requestUrl.includes("/api/graphql"))
                return;
            let text;
            try {
                text = await response.text();
            }
            catch {
                return; // sometimes body is consumed
            }
            let json;
            try {
                json = JSON.parse(text);
            }
            catch {
                return; // not JSON
            }
            const ads = extractAdsFromGraphQL(json);
            for (const ad of ads) {
                if (seenAds.has(ad.id))
                    continue;
                seenAds.add(ad.id);
                saveAdToDisk(ad);
                total++;
                process.stdout.write(`\r[+] Saved ${total} ads...`);
                if (max && total >= max) {
                    console.log("\n[max reached] Stopping early.");
                    await browser.close();
                    return;
                }
            }
        }
        catch (err) {
            console.error("[responseHandler] Error:", err);
        }
    });
    // Navigate safely with retries
    try {
        console.log("[sync] Navigating...");
        await page.goto(url, { waitUntil: "networkidle2" });
    }
    catch (err) {
        console.error("[sync] Navigation failed:", err);
    }
    console.log("[sync] Scrolling to load GraphQL responses...");
    // Stronger scroll loop
    for (let i = 0; i < 200; i++) {
        await page.keyboard.press("PageDown");
        await new Promise((res) => setTimeout(res, 500 + Math.random() * 300));
        if (max && total >= max)
            break;
    }
    await browser.close();
    console.log(`\nDone. Total ads saved: ${total}`);
}
