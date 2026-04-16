"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import Link from "next/link";
import TeeTimeCard from "@/components/TeeTimeCard";
import FilterBar from "@/components/FilterBar";
import { TeeTime, FilterState, SortField, SortOrder } from "@/types";

const RADIUS_OPTIONS = [10, 15, 25, 50, 75, 100];

function ResultsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const email = searchParams.get("email") || "";
  const zipCode = searchParams.get("zipCode") || "";
  const radius = parseInt(searchParams.get("radius") || "25");

  const [editZip, setEditZip] = useState(zipCode);
  const [editRadius, setEditRadius] = useState(radius);
  const [editDate, setEditDate] = useState(searchParams.get("date") || "");

  function handleUpdateSearch() {
    if (!editZip || !/^\d{5}$/.test(editZip)) return;
    const params = new URLSearchParams({ email, zipCode: editZip, radius: editRadius.toString() });
    if (editDate) params.set("date", editDate);
    router.push(`/results?${params.toString()}`);
  }

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
      {/* Header with inline search controls */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4 mb-3">
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
            <h1 className="text-xl font-bold text-gray-900">
              Tee Times near {zipCode}
            </h1>
            <span className="text-sm text-gray-500">{email}</span>
          </div>
          <div className="flex flex-wrap items-end gap-4">
            {/* Zip code */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Zip Code</label>
              <input
                type="text"
                value={editZip}
                onChange={(e) => setEditZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
                onKeyDown={(e) => e.key === "Enter" && handleUpdateSearch()}
                className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none text-gray-900"
                maxLength={5}
              />
            </div>
            {/* Radius */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Radius</label>
              <div className="flex gap-1">
                {RADIUS_OPTIONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setEditRadius(r)}
                    className={`px-2.5 py-2 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                      editRadius === r
                        ? "bg-green-600 text-white border-green-600"
                        : "bg-white text-gray-600 border-gray-300 hover:border-green-400"
                    }`}
                  >
                    {r}mi
                  </button>
                ))}
              </div>
            </div>
            {/* Date */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Date</label>
              <input
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none text-gray-900"
              />
            </div>
            {/* Update button */}
            <button
              type="button"
              onClick={handleUpdateSearch}
              className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer"
            >
              Update Search
            </button>
          </div>
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
