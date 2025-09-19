import type { SearchIndex } from 'algoliasearch';
import {
  SEARCHABLE_ATTRIBUTES,
  ATTRIBUTES_FOR_FACETING,
  CUSTOM_RANKING,
  ATTRIBUTES_TO_SNIPPET,
  ATTRIBUTES_TO_HIGHLIGHT,
  ATTRIBUTES_TO_RETRIEVE
} from './indexSchema';

export const ALGOLIA_SETTINGS = {
  searchableAttributes: SEARCHABLE_ATTRIBUTES,
  attributesForFaceting: ATTRIBUTES_FOR_FACETING,
  customRanking: CUSTOM_RANKING,
  attributesToSnippet: ATTRIBUTES_TO_SNIPPET,
  attributesToHighlight: ATTRIBUTES_TO_HIGHLIGHT,
  attributesToRetrieve: ATTRIBUTES_TO_RETRIEVE,
  removeWordsIfNoResults: 'allOptional',
  ignorePlurals: true,
  typoTolerance: 'min',
  decompoundQuery: true
};

export async function applyIndexSettings(index: SearchIndex) {
  await index.setSettings(ALGOLIA_SETTINGS);
}
