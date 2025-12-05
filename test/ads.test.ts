import { extractAdsFromGraphQL } from "../src/utils";

describe("extractAdsFromGraphQL", () => {
  let mockGraphQLResponse: any;

  beforeAll(() => {
    // Minimal mock data resembling real GraphQL output
    mockGraphQLResponse = {
      data: {
        ad_library_main: {
          search_results_connection: {
            edges: [
              {
                node: {
                  collated_results: [
                    {
                      ad_archive_id: "654540407595939",
                      page_id: "282592881929497",
                      start_date: 1763193600,
                      end_date: 1764921600,
                      snapshot: {
                        page_name: "Huel",
                        caption: "Huel.com",
                      },
                      publisher_platform: ["FACEBOOK", "INSTAGRAM"],
                    },
                  ],
                },
              },
            ],
          },
        },
      },
    };
  });

  // ------------------------------
  // 1. BASIC STRUCTURE TEST
  // ------------------------------
  it("returns an array of ads", () => {
    const ads = extractAdsFromGraphQL(mockGraphQLResponse);
    expect(Array.isArray(ads)).toBe(true);
    expect(ads.length).toBeGreaterThan(0);
  });

  // ------------------------------
  // 2. CORRECT SHAPE OF OUTPUT
  // ------------------------------
  it("extracts ads with correct structure", () => {
    const ads = extractAdsFromGraphQL(mockGraphQLResponse);
    const ad = ads[0];

    expect(ad).toHaveProperty("id");
    expect(typeof ad.id).toBe("string");

    expect(ad).toHaveProperty("page_id");
    expect(typeof ad.page_id).toBe("string");
  });

  // ------------------------------
  // 3. IMPORTANT FIELDS ARE CAPTURED
  // ------------------------------
  it("captures important fields if present", () => {
    const ads = extractAdsFromGraphQL(mockGraphQLResponse);
    const ad = ads[0];

    const importantFields = [
      "ad_archive_id",
      "page_id",
      "start_date",
      "end_date",
      "snapshot",
      "publisher_platform",
    ];

    for (const field of importantFields) {
      expect(ad).toHaveProperty(field);
    }
  });

  // ------------------------------
  // 4. PAGE ID FILTERING WORKS
  // ------------------------------
  it("filters ads by page_id when filterPageId is provided", () => {
    const ads = extractAdsFromGraphQL(mockGraphQLResponse, "282592881929497");
    for (const ad of ads) {
      expect(ad.page_id).toBe("282592881929497");
    }
  });

  // ------------------------------
  // 5. SAFE WITH WRONG JSON SHAPE
  // ------------------------------
  it("returns empty array for invalid JSON structure", () => {
    const ads = extractAdsFromGraphQL({ invalid: true });
    expect(ads).toEqual([]);
  });

  // ------------------------------
  // 6. HANDLES MISSING collated_results SAFELY
  // ------------------------------
  it("does not throw when collated_results is missing", () => {
    const mock = {
      data: {
        ad_library_main: {
          search_results_connection: {
            edges: [{ node: {} }],
          },
        },
      },
    };

    expect(() => extractAdsFromGraphQL(mock)).not.toThrow();
    expect(extractAdsFromGraphQL(mock)).toEqual([]);
  });
});
