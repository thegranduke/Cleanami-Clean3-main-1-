"use client";

import { useEffect, useState } from "react";
import { Loader } from "lucide-react";
import { formatDateRange } from "@/lib/cleaner/availability-deadline";
import { parseCleanerApiError } from "@/lib/cleaner/parse-api-error";
import { CleanerPageMessage } from "@/components/cleaner/CleanerPageMessage";
import { cn } from "@/lib/utils";

type AvailabilityDay = {
  date: string;
  label: string;
  isAvailable: boolean;
  onCallEligible: boolean;
};

type AvailabilityResponse = {
  period: { start: string; end: string; dates: string[] };
  days: AvailabilityDay[];
  deadline: {
    pastDeadline: boolean;
    isGracePeriod: boolean;
    rejected: boolean;
  };
};

export function AvailabilityPageClient() {
  const [days, setDays] = useState<AvailabilityDay[]>([]);
  const [period, setPeriod] = useState<{ start: string; end: string } | null>(
    null
  );
  const [deadline, setDeadline] = useState<AvailabilityResponse["deadline"] | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadErrorVariant, setLoadErrorVariant] = useState<"warning" | "error">(
    "warning"
  );
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch("/api/cleaner/availability");
        const data = (await response.json()) as AvailabilityResponse & {
          error?: string;
        };
        if (!response.ok) {
          const parsed = parseCleanerApiError(response, data);
          setLoadError(parsed.message);
          setLoadErrorVariant(parsed.variant === "error" ? "error" : "warning");
          return;
        }
        setDays(data.days);
        setPeriod({ start: data.period.start, end: data.period.end });
        setDeadline(data.deadline);
      } catch {
        setLoadError("Could not load availability. Please refresh and try again.");
        setLoadErrorVariant("error");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function updateDay(
    date: string,
    patch: Partial<Pick<AvailabilityDay, "isAvailable" | "onCallEligible">>
  ) {
    setDays((prev) =>
      prev.map((day) => {
        if (day.date !== date) return day;
        const next = { ...day, ...patch };
        if (patch.isAvailable === false) {
          next.onCallEligible = false;
        }
        return next;
      })
    );
    setSuccessMessage(null);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch("/api/cleaner/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          days: days.map((d) => ({
            date: d.date,
            isAvailable: d.isAvailable,
            onCallEligible: d.onCallEligible,
          })),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Save failed");
      }

      setSuccessMessage(
        data.message ??
          `Availability saved for ${period ? formatDateRange(period.start, period.end) : "this period"}`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader className="h-8 w-8 animate-spin text-brand" />
      </div>
    );
  }

  if (loadError) {
    return (
      <CleanerPageMessage
        title="Availability unavailable"
        message={loadError}
        variant={loadErrorVariant}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Availability</h1>
        <p className="text-sm text-gray-500">
          {period
            ? `Next 2 weeks: ${formatDateRange(period.start, period.end)}`
            : "Set your availability for the next two weeks"}
        </p>
      </div>

      {deadline?.pastDeadline && !deadline.rejected && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Submission is past the deadline. Your availability may not be
          considered for this period.
        </div>
      )}

      {deadline?.rejected && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Submissions are closed — more than 24 hours past the Sunday 6 PM
          deadline. Contact support if you need to update availability.
        </div>
      )}

      {successMessage && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {successMessage}
        </div>
      )}

      <ul className="space-y-3">
        {days.map((day) => (
          <li
            key={day.date}
            className="rounded-xl border bg-white p-4 shadow-sm"
          >
            <p className="mb-3 text-sm font-semibold text-gray-900">
              {day.label}
            </p>

            <div className="space-y-3">
              <label className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Available</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={day.isAvailable}
                  disabled={deadline?.rejected}
                  onClick={() =>
                    updateDay(day.date, { isAvailable: !day.isAvailable })
                  }
                  className={cn(
                    "relative h-6 w-11 rounded-full transition-colors",
                    day.isAvailable ? "bg-brand" : "bg-gray-300",
                    deadline?.rejected && "opacity-50"
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
                      day.isAvailable && "translate-x-5"
                    )}
                  />
                </button>
              </label>

              {day.isAvailable && (
                <label className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">On-call</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={day.onCallEligible}
                    disabled={deadline?.rejected}
                    onClick={() =>
                      updateDay(day.date, {
                        onCallEligible: !day.onCallEligible,
                      })
                    }
                    className={cn(
                      "relative h-6 w-11 rounded-full transition-colors",
                      day.onCallEligible ? "bg-indigo-600" : "bg-gray-300",
                      deadline?.rejected && "opacity-50"
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
                        day.onCallEligible && "translate-x-5"
                      )}
                    />
                  </button>
                </label>
              )}
            </div>
          </li>
        ))}
      </ul>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving || deadline?.rejected}
        className="w-full rounded-lg bg-brand py-3 text-sm font-semibold text-white hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {saving ? "Saving…" : "Save availability"}
      </button>
    </div>
  );
}
