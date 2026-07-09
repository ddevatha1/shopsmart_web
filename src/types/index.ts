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
  inStock?: boolean;
  pickupAvailable?: boolean;
  deliveryAvailable?: boolean;
  inStoreAvailable?: boolean;
  category?: string;
  aisle?: string;
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

export interface SearchResponse {
  products: ApiProduct[];
  storeStatuses: StoreStatus[];
}
