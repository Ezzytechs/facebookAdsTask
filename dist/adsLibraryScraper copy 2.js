"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initialSync = initialSync;
const puppeteer_1 = __importDefault(require("puppeteer"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
async function initialSync(url, max) {
    const adsByPage = {};
    const browser = await puppeteer_1.default.launch({ headless: false }); // Switched to non-headless for debugging
    const page = await browser.newPage();
    let allAds = [];
    // LOG and PARSE GraphQL XHRs instead of page content!
    page.on("response", async (response) => {
        const req = response.request();
        const url = req.url();
        if (url.includes("/api/graphql")) {
            try {
                const text = await response.text(); // Sometimes it's already consumed, but usually works
                // DEBUG: Log the response to learn the real structure
                console.log("====GRAPHQL RESPONSE====");
                console.log(text.slice(0, 1000)); // Limiting output. Open up to see more.
                // Try to decode as JSON
                let json;
                try {
                    json = JSON.parse(text);
                }
                catch {
                    return;
                }
                // Update this path to wherever you find ads in the JSON!
                // This is a guess; you need to check the console output!
                let newAds = [];
                if (json.data?.ad_library_main) {
                    newAds = [...newAds, json.data.ad_library_main];
                    // console.log({ newAds[0].data.ad_library_main.search_results_connections.edges[0].collated_results[0]. });
                }
                else if (json.data?.ads) {
                    newAds = json.data.ads;
                } // ... add more paths after inspecting log output
                // Store grouped by page_id
                for (const ad of newAds) {
                    if (max && allAds.length >= max)
                        break;
                    allAds.push(ad);
                    const page_id = ad.page_id || "unknown";
                    if (!adsByPage[page_id])
                        adsByPage[page_id] = [];
                    adsByPage[page_id].push(ad);
                }
            }
            catch {
                /* ignore on parse fail */
            }
        }
    });
    await page.goto(url, { waitUntil: "networkidle2" });
    // Scroll: force XHRs
    for (let i = 0; i < 30; i++) {
        await page.evaluate(() => window.scrollBy(0, window.innerHeight));
        await new Promise((res) => setTimeout(res, 1200));
        if (max && allAds.length >= max)
            break;
    }
    // Write all ads grouped by page_id
    fs_1.default.mkdirSync("ads_db", { recursive: true });
    Object.entries(adsByPage).forEach(([page_id, ads]) => {
        fs_1.default.mkdirSync(path_1.default.join("ads_db", page_id), { recursive: true });
        fs_1.default.writeFileSync(path_1.default.join("ads_db", page_id, "ads.json"), JSON.stringify(ads, null, 2));
    });
    console.log(`Fetched and saved ${allAds.length} ads total`);
    await browser.close();
}
