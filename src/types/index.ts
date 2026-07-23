export const STORE_NAMES = ["Trader Joe's", 'Sprouts', 'Kroger', 'Aldi'] as const;
export type StoreName = (typeof STORE_NAMES)[number];

/** The specific physical store a product listing came from — standardized
 * across all four store adapters (see krogerLiveScraper.ts,
 * traderJoesLiveScraper.ts, sproutsLiveScraper.ts, aldiLiveScraper.ts for how
 * each one obtains this). `latitude`/`longitude` are omitted when a store's
 * own API only provides an address — routes/trip.ts geocodes it before
 * route-planning in that case, rather than failing the stop outright. */
export interface StoreLocation {
  name: string;
  storeId?: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  latitude?: number;
  longitude?: number;
}

export interface ApiProduct {
  id: string;
  name: string;
  brand: string;
  price: number;
  originalPrice?: number;
  discountPercent?: number;
  image_url?: string;
  rating: number;
  reviewCount?: number;
  isLiveData?: boolean;   // true when price comes from the live store scraper
  size: string;
  upc?: string;
  certifications?: string[];
  pricePerUnit?: string;
  store: "Trader Joe's" | 'Sprouts' | 'Kroger' | 'Aldi';
  storeProductUrl?: string;
  location?: StoreLocation;
  inStock?: boolean;
  pickupAvailable?: boolean;
  deliveryAvailable?: boolean;
  inStoreAvailable?: boolean;
  category?: string;
  aisle?: string;
  /** Set by /api/search's relevance classifier: 'direct' when the query
   * names the product itself, 'related' when the query only appears as an
   * ingredient/flavor/component (see app/api/search/route.ts's classifyMatch). */
  matchType?: 'direct' | 'related';
}

export interface CartItem {
  product: ApiProduct;
  quantity: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  zipcode: string;
  searchHistory: string[];
  /** Optional, shopper-set weekly grocery budget — used only to subtly
   * surface budget standing in the Cart's Advisor slot. Absent for most
   * accounts. */
  weeklyBudget?: number;
}

export interface SearchRequest {
  query: string;
  zipcode: string;
}

export interface StoreStatus {
  store: ApiProduct['store'];
  status: 'pending' | 'loading' | 'success' | 'error';
  count?: number;
  error?: string;
}

/** Set on the response only when the query pipeline (see
 * services/queryCorrection.ts) found a typo/spelling correction worth
 * surfacing — omitted entirely for an already-correct or unrecognized
 * query, never present with a 'none' level. */
export interface QueryCorrectionInfo {
  original: string;
  corrected: string;
  confidence: number;
  level: 'moderate' | 'high';
}

export interface SearchResponse {
  products: ApiProduct[];
  storeStatuses: StoreStatus[];
  correction?: QueryCorrectionInfo;
}

// ── Route planning ────────────────────────────────────────────────────────

/** Where the trip starts — real GPS coordinates when available, otherwise
 * a ZIP code the backend geocodes to a center point. Never a fabricated
 * default location. */
export interface TripOrigin {
  latitude?: number;
  longitude?: number;
  zipcode?: string;
}

export interface TripRequest {
  origin: TripOrigin;
  /** One entry per physical store the cart needs to visit — the caller
   * (frontend) is expected to have already grouped cart items by
   * StoreLocation; the backend also defensively de-duplicates by address
   * in case it hasn't. */
  stops: StoreLocation[];
}

export interface TripStop {
  location: StoreLocation;
  /** Driving time/distance for the leg arriving at this stop — from the
   * origin for the first stop, from the previous stop otherwise. Always
   * computed by the routing engine, never estimated. */
  legDurationMinutes: number;
  legDistanceMiles: number;
  /** Minutes from trip start until arrival at this stop. */
  cumulativeEtaMinutes: number;
  /** The first driving instruction of this leg (e.g. "Turn left onto Main
   * St"), when the routing engine's step data includes a readable street
   * name — omitted rather than shown as a placeholder otherwise. */
  nextManeuver?: string;
}

export interface TripPlan {
  /** The resolved starting point — echoed back so the frontend always has
   * a concrete coordinate to render as the trip's start, whether it came
   * from real GPS or a geocoded ZIP-code fallback. */
  origin: { latitude: number; longitude: number };
  totalDurationMinutes: number;
  totalDistanceMiles: number;
  /** [longitude, latitude] pairs tracing the full driving route, in visit
   * order — GeoJSON LineString coordinate order, straight from the routing
   * engine (never a straight-line approximation between stops). */
  routeGeometry: { type: 'LineString'; coordinates: [number, number][] };
  /** In optimized visit order — never simply cart order. */
  stops: TripStop[];
  /** Stops the caller sent that could NOT be routed to — their store had no
   * usable coordinates and no geocoder result for its address either. Named
   * explicitly rather than silently dropped from `stops`, so the frontend
   * can tell the shopper exactly which store (and therefore which cart
   * items) couldn't be included, instead of the trip just quietly having
   * one fewer stop than the cart implied. */
  unresolvedStops?: StoreLocation[];
}

/** One physical store's worth of a shopper's cart — the frontend-only
 * grouping step between "cart" and "trip request." Not sent to the backend
 * as-is; `items` stays on-device for rendering the pick-up checklist, only
 * `location` is sent as a stop. */
export interface StoreGroup {
  location: StoreLocation;
  items: CartItem[];
}

// ── Smart Shopping Planner ──────────────────────────────────────────────

/** One line of a shopper's parsed grocery list, resolved client-side
 * (instantly, no network call — see plannerAmbiguityService.ts) before
 * ever being sent to /api/planner. `subtypeId` is `undefined` when the
 * item isn't ambiguous at all (no taxonomy entry, or only one subtype),
 * `null` when the shopper explicitly chose "No Preference" (the optimizer
 * is free to pick whichever subtype produces the best overall plan), and a
 * real id when a specific subtype was chosen or remembered. */
export interface PlannerListItem {
  id: string;
  rawText: string;
  taxonomyEntryId?: string;
  subtypeId?: string | null;
}

export interface AmbiguityOption {
  subtypeId: string;
  label: string;
}

/** One clarifying question to show the shopper — grouped so every
 * ambiguous item in a list is presented at once, not one prompt at a time. */
export interface AmbiguityPrompt {
  taxonomyEntryId: string;
  itemLabel: string;
  listItemIds: string[];
  options: AmbiguityOption[];
  /** Pre-selected value, if a remembered preference or a safe taxonomy
   * default exists — still fully overridable by the shopper. */
  rememberedDefault?: string;
}

/** Relative weights the optimizer balances when scoring the "Balanced"
 * candidate — cost/time/distance/fewerStops only. `freshness`/`reliability`
 * are deliberately not modeled: no real per-store data source exists for
 * either anywhere in this app, and fabricating plausible-looking numbers
 * for a "trustworthy" feature would be worse than not offering them. */
export interface PlanWeights {
  cost: number;
  time: number;
  distance: number;
  fewerStops: number;
}

export interface PlanLineItem {
  listItemId: string;
  rawText: string;
  product: ApiProduct | null;
  notFound: boolean;
  /** Only set when notFound — the closest real match found for this item
   * (a broader, subtype-unfiltered search), offered as a substitution
   * rather than leaving the shopper with nothing. */
  alternativeSuggestion?: ApiProduct;
}

export interface PlanStoreAssignment {
  store: ApiProduct['store'];
  location: StoreLocation;
  items: PlanLineItem[];
  subtotal: number;
}

export type PlanCandidateId = 'balanced' | 'cheapest' | 'fastest' | 'fewest-stops';

export interface PlanCandidate {
  id: PlanCandidateId;
  label: string;
  storeAssignments: PlanStoreAssignment[];
  totalCost: number;
  /** Drive-distance-based approximation, clearly labeled as an estimate
   * wherever shown (see shoppingPlanOptimizer.ts's GAS_COST_PER_MILE). */
  estimatedGasCost: number;
  /** This plan's totalCost vs. the best achievable single-store total for
   * the same list — 0 when a single store was already optimal. */
  estimatedSavings: number;
  totalDriveMinutes: number;
  totalDriveMiles: number;
  storeCount: number;
  itemsFound: number;
  itemsTotal: number;
  /** Reused as-is from tripPlanner.planTrip — feeds RouteMap directly with
   * zero translation, and is what /route recomputes (from the cart this
   * candidate populates) once the shopper taps "Start Shopping." */
  tripPlan: TripPlan;
}

export interface ShoppingPlanRequest {
  items: PlannerListItem[];
  zipcode: string;
}

export interface ShoppingPlanResponse {
  /** Always all 4 ids, in this order: balanced, cheapest, fastest,
   * fewest-stops — the caller never needs to know which subsets were
   * actually distinct. */
  candidates: PlanCandidate[];
  recommendedId: PlanCandidateId;
  /** List items that couldn't be found at any of the 4 stores at all —
   * the same across every candidate (coverage is optimized first, so a
   * candidate never omits an item some other candidate would have
   * found), which is why this lives here once rather than per-candidate. */
  unresolvedItems: PlanLineItem[];
}
