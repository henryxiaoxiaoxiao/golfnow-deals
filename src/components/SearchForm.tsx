"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const RADIUS_OPTIONS = [10, 15, 25, 50, 75, 100];

export default function SearchForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [radiusMiles, setRadiusMiles] = useState(25);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!email || !zipCode) {
      setError("Please fill in all required fields.");
      return;
    }

    if (!/^\d{5}$/.test(zipCode)) {
      setError("Please enter a valid 5-digit zip code.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);

    // Store search params and navigate to results
    const params = new URLSearchParams({
      email,
      zipCode,
      radius: radiusMiles.toString(),
    });

    router.push(`/results?${params.toString()}`);
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md space-y-5">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Email */}
      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Email Address
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-colors text-gray-900 placeholder-gray-400"
          required
        />
        <p className="mt-1 text-xs text-gray-500">
          We will send booking links to this email
        </p>
      </div>

      {/* Zip Code */}
      <div>
        <label
          htmlFor="zipCode"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Zip Code
        </label>
        <input
          id="zipCode"
          type="text"
          value={zipCode}
          onChange={(e) => setZipCode(e.target.value.replace(/\D/g, "").slice(0, 5))}
          placeholder="94105"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-colors text-gray-900 placeholder-gray-400"
          required
          maxLength={5}
        />
      </div>

      {/* Search Radius */}
      <div>
        <label
          htmlFor="radius"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Search Radius
        </label>
        <div className="grid grid-cols-3 gap-2">
          {RADIUS_OPTIONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRadiusMiles(r)}
              className={`py-2 px-3 rounded-lg text-sm font-medium border transition-colors cursor-pointer ${
                radiusMiles === r
                  ? "bg-green-600 text-white border-green-600"
                  : "bg-white text-gray-700 border-gray-300 hover:border-green-400"
              }`}
            >
              {r} mi
            </button>
          ))}
        </div>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors text-lg cursor-pointer"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg
              className="animate-spin h-5 w-5"
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
            Searching...
          </span>
        ) : (
          "Find Cheap Tee Times"
        )}
      </button>
    </form>
  );
}
