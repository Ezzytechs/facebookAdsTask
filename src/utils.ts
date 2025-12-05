export interface AdData {
  id: string; 
  page_id: string; 
  [key: string]: any;
}

// Extracts ads from Meta Ads Library GraphQL response.
export function extractAdsFromGraphQL(
  json: any,
  filterPageId?: string
): AdData[] {
  const results: AdData[] = [];

  try {
    const edges = json?.data?.ad_library_main?.search_results_connection?.edges;
    if (!Array.isArray(edges)) return results;

    for (const edge of edges) {
      const collated = edge?.node?.collated_results;
      if (!Array.isArray(collated)) continue;

      for (const item of collated) {
        const adId = item?.ad_archive_id;
        const pageId = item?.page_id || item?.snapshot?.page_id;

        if (!adId || !pageId) continue;

        if (filterPageId && pageId !== filterPageId) continue;

        results.push({
          id: adId,
          page_id: pageId,
          ...item,
        });
      }
    }
  } catch (err) {
    console.error("[extractAdsFromGraphQL] Invalid JSON structure:", err);
    return [];
  }

  return results;
}
