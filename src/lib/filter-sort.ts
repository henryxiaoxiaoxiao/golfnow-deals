import { TeeTime, FilterState, SortField, SortOrder } from "@/types";

export function applyFilters(teeTimes: TeeTime[], filters: FilterState): TeeTime[] {
  let result = teeTimes;
  if (filters.hotDealsOnly) result = result.filter((t) => t.isHotDeal);
  if (filters.maxPrice !== null) result = result.filter((t) => t.price <= filters.maxPrice!);
  if (filters.minRating !== null) result = result.filter((t) => t.rating >= filters.minRating!);
  if (filters.holes !== null) result = result.filter((t) => t.holes === filters.holes);
  if (filters.tier !== null) result = result.filter((t) => t.tier === filters.tier);
  return result;
}

export function applySort(
  teeTimes: TeeTime[],
  sortField: SortField,
  sortOrder: SortOrder
): TeeTime[] {
  const out = [...teeTimes];
  out.sort((a, b) => {
    let cmp = 0;
    switch (sortField) {
      case "price":
        cmp = a.price - b.price;
        break;
      case "distance":
        cmp = a.distanceMiles - b.distanceMiles;
        break;
      case "rating":
        cmp = a.rating - b.rating;
        break;
      case "time":
        cmp = new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime();
        break;
    }
    return sortOrder === "asc" ? cmp : -cmp;
  });
  return out;
}

export function filterAndSort(
  teeTimes: TeeTime[],
  filters: FilterState,
  sortField: SortField,
  sortOrder: SortOrder
): TeeTime[] {
  return applySort(applyFilters(teeTimes, filters), sortField, sortOrder);
}
