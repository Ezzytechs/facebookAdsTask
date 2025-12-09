# Meta Ads Library Scraper

A Node.js scraper for the Facebook Ads Library.  
Scrapes ads by page and stores them locally for initial and incremental synchronization. Includes unit tests to validate scraping and extracted data structure.

---

## Features

- **Initial sync:** Scrape all ads for a given page and save to disk, grouped by `page_id`.
- **Incremental sync:** Keep your local data up-to-date without refetching everything.
- **Unit tests:** Quickly spot changes to Facebook's API structure.
- **Robust error handling:** Prevents crashes from missing fields or unexpected JSON shapes.
- **Efficient disk structure:** Ads are stored in per-page directories as JSON files.

---

## Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/Ezzytechs/facebookAdsTask.git
cd <repository_folder>
npm install
npx tsc
```
## Usage

Initial sync:
from your cli run:
```
node dist/index.js sync <"facebook ads library url"> [addsNumber to fetch]
```
e.g
```bash
node dist/index.js sync "https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&search_type=page&view_all_page_id=282592881929497" 100

```

Incremental sync for a page:
from your cli run
```
node dist/index.js incremental <"page_id">
```
e.g
```
node dist/index.js incremental 282592881929497

```

## Dev/test

To run all tests:

```

npm test

```

