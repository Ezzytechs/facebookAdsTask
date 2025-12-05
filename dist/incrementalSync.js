"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.incrementalSync = incrementalSync;
const puppeteer_1 = __importDefault(require("puppeteer"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const utils_1 = require("./utils");
// Load ads from disk
function loadLocalAds(pageId) {
    const dir = path_1.default.join("ads_db", pageId);
    const map = new Map();
    if (!fs_1.default.existsSync(dir))
        return map;
    for (const file of fs_1.default.readdirSync(dir)) {
        if (!file.endsWith(".json") || file === "sync_meta.json")
            continue;
        try {
            const content = fs_1.default.readFileSync(path_1.default.join(dir, file), "utf-8");
            const ad = JSON.parse(content);
            map.set(ad.id, ad);
        }
        catch { }
    }
    return map;
}
// Save or update a single ad
function saveAdToDisk(ad) {
    const dir = path_1.default.join("ads_db", ad.page_id);
    fs_1.default.mkdirSync(dir, { recursive: true });
    const file = path_1.default.join(dir, `${ad.id}.json`);
    fs_1.default.writeFileSync(file, JSON.stringify(ad, null, 2));
}
// Save sync metadata
function saveSyncMeta(pageId, meta) {
    const dir = path_1.default.join("ads_db", pageId);
    fs_1.default.mkdirSync(dir, { recursive: true });
    fs_1.default.writeFileSync(path_1.default.join(dir, "sync_meta.json"), JSON.stringify(meta, null, 2));
}
/**
 * Incremental sync for one page_id.
 */
async function incrementalSync(pageId) {
    const localAds = loadLocalAds(pageId);
    const url = `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=ALL&media_type=all&search_type=page&view_all_page_id=${pageId}`;
    let updated = 0;
    let added = 0;
    const browser = await puppeteer_1.default.launch({
        headless: true,
        args: ["--no-sandbox"],
    });
    const page = await browser.newPage();
    await page.setDefaultNavigationTimeout(60000);
    const seenAdIds = new Set();
    // Intercept and extract ads
    page.on("response", async (response) => {
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
            const ads = (0, utils_1.extractAdsFromGraphQL)(json, pageId);
            for (const ad of ads) {
                if (seenAdIds.has(ad.id))
                    continue;
                seenAdIds.add(ad.id);
                if (localAds.has(ad.id)) {
                    const old = localAds.get(ad.id);
                    let changed = false;
                    for (const key of [
                        "is_active",
                        "end_date",
                        "ad_snapshot",
                        "collation_count",
                    ]) {
                        if (old[key] !== ad[key])
                            changed = true;
                    }
                    if (changed) {
                        saveAdToDisk(ad);
                        updated++;
                    }
                }
                else {
                    saveAdToDisk(ad);
                    added++;
                }
            }
        }
        catch (err) {
            console.error("[incremental responseHandler] Error:", err);
        }
    });
    try {
        await page.goto(url, { waitUntil: "networkidle2" });
        for (let i = 0; i < 100; i++) {
            await page.keyboard.press("PageDown");
            await new Promise((r) => setTimeout(r, 500));
        }
    }
    catch (err) {
        console.error("[incrementalSync] Navigation/Scroll error:", err);
    }
    finally {
        await browser.close();
    }
    saveSyncMeta(pageId, {
        last_synced: new Date().toISOString(),
        updated,
        added,
    });
    console.log(`[incrementalSync] page_id=${pageId}: ${added} new ads, ${updated} updated ads`);
    return updated;
}
