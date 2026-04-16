export interface TeeTime {
  id: string;
  courseName: string;
  courseId: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  latitude: number;
  longitude: number;
  dateTime: string; // ISO string
  displayTime: string;
  displayDate: string;
  players: number;
  holes: number; // 9 or 18
  originalPrice: number;
  price: number;
  isHotDeal: boolean;
  discount: number; // percentage off
  rating: number; // course rating 1-5
  reviewCount: number;
  imageUrl: string;
  bookingUrl: string;
  distanceMiles: number;
}

export interface SearchParams {
  email: string;
  zipCode: string;
  radiusMiles: number;
  date?: string;
  minTime?: string;
  maxTime?: string;
  maxPrice?: number;
  hotDealsOnly?: boolean;
  players?: number;
  holes?: number;
}

export interface UserPreference {
  id: string;
  email: string;
  zipCode: string;
  radiusMiles: number;
  createdAt: string;
}

export interface FavoriteCourse {
  id: string;
  email: string;
  courseId: string;
  courseName: string;
  starRating: number; // user's personal rating
  createdAt: string;
}

export type SortField = "price" | "distance" | "rating" | "time";
export type SortOrder = "asc" | "desc";

export interface FilterState {
  hotDealsOnly: boolean;
  maxPrice: number | null;
  minRating: number | null;
  timeRange: [string, string] | null; // ["06:00", "18:00"]
  holes: number | null; // 9 or 18 or null for both
}
