"use client";

import { FilterState, SortField, SortOrder } from "@/types";

interface FilterBarProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  sortField: SortField;
  sortOrder: SortOrder;
  onSortChange: (field: SortField, order: SortOrder) => void;
  totalResults: number;
}

export default function FilterBar({
  filters,
  onFiltersChange,
  sortField,
  sortOrder,
  onSortChange,
  totalResults,
}: FilterBarProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
      <div className="flex flex-wrap items-center gap-4">
        {/* Results count */}
        <div className="text-sm text-gray-600 font-medium">
          {totalResults} tee time{totalResults !== 1 ? "s" : ""} found
        </div>

        <div className="h-6 w-px bg-gray-200 hidden sm:block" />

        {/* Hot Deals toggle */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={filters.hotDealsOnly}
            onChange={(e) =>
              onFiltersChange({ ...filters, hotDealsOnly: e.target.checked })
            }
            className="w-4 h-4 text-green-600 rounded accent-green-600"
          />
          <span className="text-sm text-gray-700">Hot Deals Only</span>
        </label>

        <div className="h-6 w-px bg-gray-200 hidden sm:block" />

        {/* Max price */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-700">Max Price:</label>
          <select
            value={filters.maxPrice ?? ""}
            onChange={(e) =>
              onFiltersChange({
                ...filters,
                maxPrice: e.target.value ? Number(e.target.value) : null,
              })
            }
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-700 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
          >
            <option value="">Any</option>
            <option value="25">$25</option>
            <option value="40">$40</option>
            <option value="60">$60</option>
            <option value="80">$80</option>
            <option value="100">$100</option>
            <option value="150">$150</option>
          </select>
        </div>

        <div className="h-6 w-px bg-gray-200 hidden sm:block" />

        {/* Holes filter */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-700">Holes:</label>
          <select
            value={filters.holes ?? ""}
            onChange={(e) =>
              onFiltersChange({
                ...filters,
                holes: e.target.value ? Number(e.target.value) : null,
              })
            }
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-700 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
          >
            <option value="">All</option>
            <option value="9">9 Holes</option>
            <option value="18">18 Holes</option>
          </select>
        </div>

        <div className="h-6 w-px bg-gray-200 hidden sm:block" />

        {/* Tier filter */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-700">Tier:</label>
          <div className="flex gap-1">
            {([null, "premium", "standard", "budget"] as const).map((t) => (
              <button
                key={t ?? "all"}
                type="button"
                onClick={() => onFiltersChange({ ...filters, tier: t })}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                  filters.tier === t
                    ? t === "premium"
                      ? "bg-amber-500 text-white border-amber-500"
                      : t === "standard"
                        ? "bg-blue-500 text-white border-blue-500"
                        : t === "budget"
                          ? "bg-green-500 text-white border-green-500"
                          : "bg-gray-700 text-white border-gray-700"
                    : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
                }`}
              >
                {t === null ? "All" : t === "premium" ? "Premium" : t === "standard" ? "Standard" : "Budget"}
              </button>
            ))}
          </div>
        </div>

        <div className="h-6 w-px bg-gray-200 hidden sm:block" />

        {/* Min rating */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-700">Min Rating:</label>
          <select
            value={filters.minRating ?? ""}
            onChange={(e) =>
              onFiltersChange({
                ...filters,
                minRating: e.target.value ? Number(e.target.value) : null,
              })
            }
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-700 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
          >
            <option value="">Any</option>
            <option value="3">3+</option>
            <option value="3.5">3.5+</option>
            <option value="4">4+</option>
            <option value="4.5">4.5+</option>
          </select>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Sort */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-700">Sort by:</label>
          <select
            value={`${sortField}-${sortOrder}`}
            onChange={(e) => {
              const [field, order] = e.target.value.split("-") as [
                SortField,
                SortOrder,
              ];
              onSortChange(field, order);
            }}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-700 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
          >
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
            <option value="distance-asc">Distance: Nearest</option>
            <option value="distance-desc">Distance: Farthest</option>
            <option value="rating-desc">Rating: Best First</option>
            <option value="rating-asc">Rating: Lowest First</option>
            <option value="time-asc">Time: Earliest</option>
            <option value="time-desc">Time: Latest</option>
          </select>
        </div>
      </div>
    </div>
  );
}
