import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";
import { extractAdsFromGraphQL, AdData } from "./utils";

function saveAdToDisk(ad: AdData) {
  try {
    const dir = path.join("ads_db", ad.page_id);
    fs.mkdirSync(dir, { recursive: true });

    const file = path.join(dir, `${ad.id}.json`);
    fs.writeFileSync(file, JSON.stringify(ad, null, 2));
  } catch (err) {
    console.error(`[saveAd] Failed writing ${ad.id}:`, err);
  }
}

export async function initialSync(
  url: string,
  max?: number
): Promise<number | undefined> {
  const seenAds = new Set<string>();
  let total = 0;
  let stoppedEarly = false; // <--- NEW FLAG

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox"],
  });

  const page = await browser.newPage();
  await page.setDefaultNavigationTimeout(60000);

  console.log("[initialSync] Listening for GraphQL...");

  const onResponse = async (response: any) => {
    if (stoppedEarly) return; // <--- ignore callbacks after closing

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

      const ads = extractAdsFromGraphQL(json);

      for (const ad of ads) {
        if (seenAds.has(ad.id)) continue;
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
    } catch (err) {
      if (!stoppedEarly) console.error("[initialSync handler] Error:", err);
    }
  };

  page.on("response", onResponse);

  try {
    console.log("[initialSync] Navigating...");
    await page.goto(url, { waitUntil: "networkidle2" });
  } catch (err) {
    console.error("[initialSync] Navigation failed:", err);
  }

  console.log("[initialSync] Scrolling...");

  for (let i = 0; i < 200; i++) {
    if (stoppedEarly) break; // <--- Critical

    if (page.isClosed()) break; // <--- Extra safety

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
