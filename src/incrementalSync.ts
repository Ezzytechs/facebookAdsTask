import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";
import { extractAdsFromGraphQL, AdData } from "./utils";

// Load ads from disk
function loadLocalAds(pageId: string): Map<string, AdData> {
  const dir = path.join("ads_db", pageId);
  const map = new Map<string, AdData>();

  if (!fs.existsSync(dir)) return map;
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith(".json") || file === "sync_meta.json") continue;
    try {
      const content = fs.readFileSync(path.join(dir, file), "utf-8");
      const ad: AdData = JSON.parse(content);
      map.set(ad.id, ad);
    } catch {}
  }

  return map;
}

// Save or update a single ad
function saveAdToDisk(ad: AdData) {
  const dir = path.join("ads_db", ad.page_id);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${ad.id}.json`);
  fs.writeFileSync(file, JSON.stringify(ad, null, 2));
}

// Save sync metadata
function saveSyncMeta(pageId: string, meta: Record<string, any>) {
  const dir = path.join("ads_db", pageId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "sync_meta.json"),
    JSON.stringify(meta, null, 2)
  );
}

/**
 * Incremental sync for one page_id.
 */
export async function incrementalSync(
  pageId: string
): Promise<number | undefined> {
  const localAds = loadLocalAds(pageId);

  const url = `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=ALL&media_type=all&search_type=page&view_all_page_id=${pageId}`;

  let updated = 0;
  let added = 0;

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox"],
  });

  const page = await browser.newPage();
  await page.setDefaultNavigationTimeout(60000);

  const seenAdIds = new Set<string>();

  // Intercept and extract ads
  page.on("response", async (response) => {
    try {
      if (!response.url().includes("/api/graphql")) return;

      let body: string;
      try {
        body = await response.text();
      } catch {
        return;
      }

      let json: any;
      try {
        json = JSON.parse(body);
      } catch {
        return;
      }

      const ads = extractAdsFromGraphQL(json, pageId);

      for (const ad of ads) {
        if (seenAdIds.has(ad.id)) continue;
        seenAdIds.add(ad.id);

        if (localAds.has(ad.id)) {
          const old = localAds.get(ad.id)!;
          let changed = false;

          for (const key of [
            "is_active",
            "end_date",
            "ad_snapshot",
            "collation_count",
          ]) {
            if (old[key] !== ad[key]) changed = true;
          }

          if (changed) {
            saveAdToDisk(ad);
            updated++;
          }
        } else {
          saveAdToDisk(ad);
          added++;
        }
      }
    } catch (err) {
      console.error("[incremental responseHandler] Error:", err);
    }
  });

  try {
    await page.goto(url, { waitUntil: "networkidle2" });

    for (let i = 0; i < 100; i++) {
      await page.keyboard.press("PageDown");
      await new Promise((r) => setTimeout(r, 500));
    }
  } catch (err) {
    console.error("[incrementalSync] Navigation/Scroll error:", err);
  } finally {
    await browser.close();
  }

  saveSyncMeta(pageId, {
    last_synced: new Date().toISOString(),
    updated,
    added,
  });

  console.log(
    `[incrementalSync] page_id=${pageId}: ${added} new ads, ${updated} updated ads`
  );
  return updated;
}
