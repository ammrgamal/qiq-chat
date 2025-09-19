// Canonical Algolia product schema for QuickITQuote
export type AlgoliaProduct = {
  objectID: string;
  sku: string;
  mpn: string;
  name: string;
  brand: string;
  category: string;
  unit: string;
  availability: "Stock" | "on back order";
  availability_weight: number;
  price: number;
  list_price: number;
  cost: number;
  image: string;
  spec_sheet: string;
  link: string;
  ShortDescription: string;
  ExtendedDescription: string;
  custom_memo: string[];
  custom_text: string[];
  tags: string[];
  Discontinued: boolean;
  LastModified: string;
};

// Canonical settings arrays
export const SEARCHABLE_ATTRIBUTES = [
  "sku","mpn","name","brand","category","custom_memo","custom_text","tags"
];
export const ATTRIBUTES_FOR_FACETING = [
  "brand","category","unit","availability","discontinued","tags"
];
export const CUSTOM_RANKING = [
  "desc(availability_weight)","asc(price)","asc(name)"
];
export const ATTRIBUTES_TO_SNIPPET = [
  "ExtendedDescription:40","ShortDescription:20"
];
export const ATTRIBUTES_TO_HIGHLIGHT = [
  "sku","mpn","name","custom_memo","custom_text","tags"
];
export const ATTRIBUTES_TO_RETRIEVE = [
  "objectID","sku","mpn","name","brand","category","unit","availability","availability_weight","price","list_price","cost","image","spec_sheet","link","tags","ShortDescription","ExtendedDescription","custom_memo","custom_text"
];

// Helper: normalizeFileUrl
export function normalizeFileUrl(url: string): string {
  return url.replace(/\\/g, "/");
}
