import { initialSync } from "./initialSync";
import { incrementalSync } from "./incrementalSync";

async function main() {
  const cmd = process.argv[2];
  if (cmd === "sync") {
    const url = process.argv[3];
    const max = Number(process.argv[4]) || undefined;
    if (!url) throw new Error("URL required");
    const added = await initialSync(url, max);
    console.log(`Initial sync complete: ${added} ads added.`);
  } else if (cmd === "incremental") {
    const pageId = process.argv[3];
    if (!pageId) throw new Error("pageId required");
    const added = await incrementalSync(pageId);
    console.log(`Incremental sync complete: ${added} ads added/updated.`);
  } else {
    console.log(
      "Usage:\nnode dist/index.js sync <url> [max]\nnode dist/index.js incremental <pageId>"
    );
  }
}

main();
