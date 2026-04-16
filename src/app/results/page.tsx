"use client";

import { useSearchParams } from "next/navigation";
import { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import Link from "next/link";
import TeeTimeCard from "@/components/TeeTimeCard";
import FilterBar from "@/components/FilterBar";
import { TeeTime, FilterState, SortField, SortOrder } from "@/types";

function ResultsContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  const zipCode = searchParams.get("zipCode") || "";
  const radius = parseInt(searchParams.get("radius") || "25");

  const [teeTimes, setTeeTimes] = useState<TeeTime[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  const [filters, setFilters] = useState<FilterState>({
    hotDealsOnly: false,
    maxPrice: null,
    minRating: null,
    timeRange: null,
    holes: null,
    tier: null,
  });
  const [sortField, setSortField] = useState<SortField>("price");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  // Fetch tee times
  useEffect(() => {
    if (!email || !zipCode) return;

    async function fetchTeeTimes() {
      setLoading(true);
      setError("");

      try {
        const res = await fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, zipCode, radiusMiles: radius }),
        });

        if (!res.ok) throw new Error("Search failed");

        const data = await res.json();
        setTeeTimes(data.teeTimes);
      } catch {
        setError("Failed to fetch tee times. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    fetchTeeTimes();
  }, [email, zipCode, radius]);

  // Fetch favorites
  useEffect(() => {
    if (!email) return;

    async function fetchFavorites() {
      try {
        const res = await fetch(`/api/favorites?email=${encodeURIComponent(email)}`);
        const data = await res.json();
        const favSet = new Set<string>(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data.favorites?.map((f: any) => f.course_id) || []
        );
        setFavorites(favSet);
      } catch {
        // Silent fail for favorites
      }
    }

    fetchFavorites();
  }, [email]);

  const handleToggleFavorite = useCallback(
    async (courseId: string, courseName: string) => {
      const isFav = favorites.has(courseId);

      // Optimistic update
      setFavorites((prev) => {
        const next = new Set(prev);
        if (isFav) {
          next.delete(courseId);
        } else {
          next.add(courseId);
        }
        return next;
      });

      try {
        if (isFav) {
          await fetch("/api/favorites", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, courseId }),
          });
        } else {
          await fetch("/api/favorites", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, courseId, courseName }),
          });
        }
      } catch {
        // Revert on failure
        setFavorites((prev) => {
          const next = new Set(prev);
          if (isFav) {
            next.add(courseId);
          } else {
            next.delete(courseId);
          }
          return next;
        });
      }
    },
    [email, favorites]
  );

  // Filter and sort tee times
  const filteredTeeTimes = useMemo(() => {
    let result = [...teeTimes];

    // Apply filters
    if (filters.hotDealsOnly) {
      result = result.filter((t) => t.isHotDeal);
    }
    if (filters.maxPrice !== null) {
      result = result.filter((t) => t.price <= filters.maxPrice!);
    }
    if (filters.minRating !== null) {
      result = result.filter((t) => t.rating >= filters.minRating!);
    }
    if (filters.holes !== null) {
      result = result.filter((t) => t.holes === filters.holes);
    }
    if (filters.tier !== null) {
      result = result.filter((t) => t.tier === filters.tier);
    }

    // Apply sort
    result.sort((a, b) => {
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
          cmp = a.displayTime.localeCompare(b.displayTime);
          break;
      }
      return sortOrder === "asc" ? cmp : -cmp;
    });

    return result;
  }, [teeTimes, filters, sortField, sortOrder]);

  if (!email || !zipCode) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <p className="text-gray-600 mb-4">Missing search parameters.</p>
        <Link
          href="/"
          className="text-green-600 hover:text-green-700 font-medium"
        >
          Go back to search
        </Link>
      </main>
    );
  }

  return (
    <main className="flex-1 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                Tee Times near {zipCode}
              </h1>
              <p className="text-sm text-gray-500">
                Within {radius} miles &middot; {email}
              </p>
            </div>
          </div>
          <Link
            href="/"
            className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            New Search
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <svg
              className="animate-spin h-10 w-10 text-green-600 mb-4"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <p className="text-gray-600">Searching for the best deals...</p>
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <p className="text-red-600 mb-4">{error}</p>
            <Link
              href="/"
              className="text-green-600 hover:text-green-700 font-medium"
            >
              Try again
            </Link>
          </div>
        ) : (
          <>
            <FilterBar
              filters={filters}
              onFiltersChange={setFilters}
              sortField={sortField}
              sortOrder={sortOrder}
              onSortChange={(field, order) => {
                setSortField(field);
                setSortOrder(order);
              }}
              totalResults={filteredTeeTimes.length}
            />

            {filteredTeeTimes.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-gray-600 mb-2">
                  No tee times match your filters.
                </p>
                <button
                  onClick={() =>
                    setFilters({
                      hotDealsOnly: false,
                      maxPrice: null,
                      minRating: null,
                      timeRange: null,
                      holes: null,
                      tier: null,
                    })
                  }
                  className="text-green-600 hover:text-green-700 font-medium cursor-pointer"
                >
                  Clear all filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredTeeTimes.map((teeTime) => (
                  <TeeTimeCard
                    key={teeTime.id}
                    teeTime={teeTime}
                    email={email}
                    isFavorite={favorites.has(teeTime.courseId)}
                    onToggleFavorite={handleToggleFavorite}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

export default function ResultsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-500">Loading...</p>
        </div>
      }
    >
      <ResultsContent />
    </Suspense>
  );
}
