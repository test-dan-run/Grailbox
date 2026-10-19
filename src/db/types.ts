/** Domain types from the handoff's data model. */

export type ItemStatus = 'OWNED' | 'WISHLIST' | 'IN_TRANSIT';
export type Priority = 'GRAIL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type Condition = 'NWT' | 'LOOSE_MINT' | 'BOXED' | 'DISPLAY_ONLY';
export type Origin = 'OFFICIAL' | 'FAN';
export type JournalEntryType = 'MILESTONE' | 'BATCH_ADD' | 'NOTE';
/** Where a scanner reference photo came from: an item photo, or a frame of a scan angles video. */
export type ReferenceSource = 'photo' | 'video';

export const ITEM_STATUSES: ItemStatus[] = ['OWNED', 'WISHLIST', 'IN_TRANSIT'];
export const PRIORITIES: Priority[] = ['GRAIL', 'HIGH', 'MEDIUM', 'LOW'];
export const CONDITIONS: Condition[] = ['NWT', 'LOOSE_MINT', 'BOXED', 'DISPLAY_ONLY'];
export const ORIGINS: Origin[] = ['OFFICIAL', 'FAN'];
export const JOURNAL_ENTRY_TYPES: JournalEntryType[] = ['MILESTONE', 'BATCH_ADD', 'NOTE'];

export interface Collection {
  id: string;
  name: string;
  categories: string[];
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ItemSpecs {
  release_year?: number;
  manufacturer?: string;
  size?: string;
  barcode?: string;
}

export interface CollectibleItem {
  id: string;
  collection_id: string;
  title: string;
  line?: string;
  line_url?: string;
  category?: string;
  status: ItemStatus;
  origin: Origin;
  quantity: number;
  variant_tags: string[];
  priority?: Priority;
  /** Minor units. */
  estimated_price?: number;
  /** Minor units. */
  purchase_price?: number;
  currency: string;
  acquisition_date?: string;
  acquisition_source?: string;
  condition?: Condition;
  storage_location?: string;
  specs: ItemSpecs;
  /** Photo paths relative to the app's document directory; first = cover. */
  photos: string[];
  created_at: string;
  updated_at: string;
}

export interface JournalEntry {
  id: string;
  collection_id: string;
  date: string;
  title: string;
  notes?: string;
  entry_type: JournalEntryType;
  is_grail?: boolean;
  item_ids: string[];
  photos: string[];
  created_at: string;
}

export type ItemInput = Omit<CollectibleItem, 'id' | 'created_at' | 'updated_at'>;
export type JournalEntryInput = Omit<JournalEntry, 'id' | 'created_at'>;

export interface StatusCounts {
  owned: number;
  wishlist: number;
  in_transit: number;
}

export interface CollectionSummary extends Collection, StatusCounts {
  /** Up to 4 most recent owned items, for the dashboard's photo row. */
  previews: { item_id: string; photo?: string }[];
  /** Title of the most recently acquired owned item. */
  latest_title?: string;
}

export interface ItemSearchResult extends CollectibleItem {
  collection_name: string;
}
