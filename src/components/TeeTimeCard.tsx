"use client";

import { useState } from "react";
import { TeeTime } from "@/types";

interface TeeTimeCardProps {
  teeTime: TeeTime;
  email: string;
  isFavorite: boolean;
  onToggleFavorite: (courseId: string, courseName: string) => void;
}

export default function TeeTimeCard({
  teeTime,
  email,
  isFavorite,
  onToggleFavorite,
}: TeeTimeCardProps) {
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailMessage, setEmailMessage] = useState("");

  async function handleSendEmail() {
    setSendingEmail(true);
    setEmailMessage("");

    try {
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, teeTime }),
      });

      const data = await res.json();
      setEmailSent(data.success);
      setEmailMessage(data.message);
    } catch {
      setEmailMessage("Failed to send email. Please try again.");
    } finally {
      setSendingEmail(false);
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
      {/* Image header with hot deal badge */}
      <div className="relative h-44 bg-gray-200">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={teeTime.imageUrl}
          alt={teeTime.courseName}
          className="w-full h-full object-cover"
        />
        {teeTime.isHotDeal && (
          <span className="absolute top-3 left-3 bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-full">
            HOT DEAL
          </span>
        )}
        {teeTime.discount > 0 && (
          <span className="absolute top-3 right-3 bg-green-600 text-white text-xs font-bold px-3 py-1 rounded-full">
            {teeTime.discount}% OFF
          </span>
        )}
        {/* Favorite button */}
        <button
          onClick={() => onToggleFavorite(teeTime.courseId, teeTime.courseName)}
          className="absolute bottom-3 right-3 bg-white/90 hover:bg-white rounded-full p-2 transition-colors cursor-pointer"
          title={isFavorite ? "Remove from favorites" : "Add to favorites"}
        >
          <svg
            className={`w-5 h-5 ${isFavorite ? "text-yellow-500 fill-yellow-500" : "text-gray-400"}`}
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
            fill={isFavorite ? "currentColor" : "none"}
          >
            <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Tier badge */}
        <div className="mb-2">
          <span
            className={`inline-block text-xs font-semibold px-2 py-0.5 rounded ${
              teeTime.tier === "premium"
                ? "bg-amber-100 text-amber-700"
                : teeTime.tier === "standard"
                  ? "bg-blue-100 text-blue-700"
                  : "bg-green-100 text-green-700"
            }`}
          >
            {teeTime.tier === "premium" ? "Premium" : teeTime.tier === "standard" ? "Standard" : "Budget"}
          </span>
        </div>
        {/* Course name & rating */}
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-semibold text-gray-900 text-lg leading-tight">
            {teeTime.courseName}
          </h3>
          <div className="flex items-center gap-1 text-sm text-gray-600 shrink-0 ml-2">
            <svg
              className="w-4 h-4 text-yellow-500 fill-yellow-500"
              viewBox="0 0 24 24"
            >
              <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
            <span>{teeTime.rating}</span>
            <span className="text-gray-400">({teeTime.reviewCount})</span>
          </div>
        </div>

        {/* Location */}
        <p className="text-sm text-gray-500 mb-3">
          {teeTime.city}, {teeTime.state}
          {teeTime.distanceMiles > 0 && <> &middot; {teeTime.distanceMiles} mi away</>}
        </p>

        {/* Date, time, holes */}
        <div className="flex flex-wrap gap-2 mb-3">
          <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 text-sm px-3 py-1 rounded-full">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {teeTime.displayDate}
          </span>
          <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 text-sm px-3 py-1 rounded-full">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {teeTime.displayTime}
          </span>
          <span className="bg-gray-100 text-gray-700 text-sm px-3 py-1 rounded-full">
            {teeTime.holes} holes
          </span>
        </div>

        {/* Price */}
        <div className="flex items-end justify-between mb-4">
          <div>
            {teeTime.price > 0 ? (
              <>
                <span className="text-2xl font-bold text-green-600">
                  ${Number.isInteger(teeTime.price) ? teeTime.price : teeTime.price.toFixed(2)}
                </span>
                {teeTime.discount > 0 && (
                  <span className="ml-2 text-sm text-gray-400 line-through">
                    ${Number.isInteger(teeTime.originalPrice) ? teeTime.originalPrice : teeTime.originalPrice.toFixed(2)}
                  </span>
                )}
              </>
            ) : (
              <span className="text-lg font-semibold text-gray-500">
                View Price
              </span>
            )}
          </div>
          <span className="text-sm text-gray-500">
            {teeTime.players} player{teeTime.players > 1 ? "s" : ""}
          </span>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <a
            href={teeTime.bookingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 bg-green-600 hover:bg-green-700 text-white text-center font-medium py-2.5 px-4 rounded-lg transition-colors text-sm"
          >
            Book on GolfNow
          </a>
          <button
            onClick={handleSendEmail}
            disabled={sendingEmail || emailSent}
            className="px-4 py-2.5 border border-gray-300 hover:border-green-400 rounded-lg transition-colors text-sm cursor-pointer disabled:opacity-50"
            title="Send booking link to your email"
          >
            {sendingEmail ? (
              <svg
                className="animate-spin h-5 w-5 text-gray-500"
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
            ) : emailSent ? (
              <svg
                className="h-5 w-5 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg
                className="h-5 w-5 text-gray-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            )}
          </button>
        </div>

        {/* Email status message */}
        {emailMessage && (
          <p
            className={`mt-2 text-xs ${emailSent ? "text-green-600" : "text-red-600"}`}
          >
            {emailMessage}
          </p>
        )}
      </div>
    </div>
  );
}
