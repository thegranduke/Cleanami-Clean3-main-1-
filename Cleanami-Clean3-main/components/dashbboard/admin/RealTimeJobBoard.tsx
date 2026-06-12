"use client";

import { useEffect } from "react";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import Link from "next/link";
import { Route } from "next";

import { useCurrentUser } from "@/hooks/useCurrentUser";
import { JobsWithDetails } from "@/lib/queries/jobs";
import { createClient } from "@/lib/supabase/client";
import { GetJobsResponse } from "@/app/api/jobs/route";
import { formatDate } from "date-fns";
import { GetJobStatsResponse } from "@/app/api/jobs/stats/route";
import { KpiCard } from "./ui/KpiCard";
import { ClientTime } from "./ui/ClientTime";
import { getStatusBadge } from "../utils";
import { format, toZonedTime } from "date-fns-tz";

async function fetchJobs({ pageParam = 1 }: { pageParam: number }) {
  const res = await fetch(`/api/jobs?page=${pageParam}`);
  if (!res.ok) {
    throw new Error("Network response was not ok");
  }
  const result: GetJobsResponse = await res.json();
  return {
    jobs: result.data,
    nextPage: result.nextPage,
  };
}

const IANA_TIMEZONE = "America/New_York";



export const RealTimeJobBoard = () => {
  const { data: user } = useCurrentUser();
  const isAdmin =
    user?.user_metadata.role === "admin" ||
    user?.user_metadata.role === "super_admin";

  const queryClient = useQueryClient();

  const { data: stats } = useQuery({
    queryKey: ["jobs", "stats"],
    queryFn: async () => {
      const res = await fetch("/api/jobs/stats");
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json() as Promise<GetJobStatsResponse>;
    },
    refetchInterval: 30000,
  });

  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    status,
  } = useInfiniteQuery({
    queryKey: ["jobs"],
    queryFn: fetchJobs,
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.nextPage,
  });

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("realtime-jobs-board")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "jobs" },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ["jobs"] });
          queryClient.invalidateQueries({ queryKey: ["jobs", "stats"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "jobs_to_cleaners" },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ["jobs"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const allJobs = data?.pages.flatMap((page) => page.jobs) ?? [];
  const uniqueJobs = Array.from(
    new Map(
      allJobs.filter((job) => job != null).map((job) => [job.id, job])
    ).values()
  );

  return (

    <>
      {isAdmin && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {stats && (
              <>
                <KpiCard
                  title="Total Jobs"
                  value={stats.totalJobs.toString()}
                />
                <KpiCard
                  title="Active Jobs"
                  value={stats.totalActive.toString()}
                />
                <KpiCard
                  title="Today's check-in Schedule"
                  value={stats.totalToday.toString()}
                />
                <KpiCard
                  title="Completed"
                  value={stats.totalCompleted.toString()}
                />
                <KpiCard
                  title="Canceled"
                  value={stats.totalCanceled.toString()}
                />
              </>
            )}
          </div>

          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              Real-Time Job Board
            </h2>
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Job ID
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Property
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Cleaners
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Status
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Check In Time
                      </th>
                      <th scope="col" className="relative px-6 py-3">
                        <span className="sr-only">Details</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {status === "pending" ? (
                      <tr>
                        <td colSpan={6} className="text-center p-4">
                          Loading jobs...
                        </td>
                      </tr>
                    ) : status === "error" ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="text-center p-4 text-red-500"
                        >
                          Error: {error.message}
                        </td>
                      </tr>
                    ) : (
                      <>
                        {uniqueJobs.map((job) => (
                          <tr key={job.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-600">
                              {job.id.substring(0, 8)}...
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {job.property?.address ?? "N/A"}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {job.assignedCleaners.length > 0
                                ? 
                                  job.assignedCleaners
                                    .map(
                                      (
                                        c: JobsWithDetails["data"][number]["assignedCleaners"][number]
                                      ) => c.fullName
                                    )
                                    .join(", ")
                                : "Unassigned"}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span
                                className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadge(
                                  job.status || ""
                                )}`}
                              >
                                {job.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              
                              {job.checkInTime ? (
                                <ClientTime dateString={job.checkInTime} />
                              ) : (
                                <span>N/A</span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <Link
                                href={`/admin/job-oversight/${job.id}` as Route}
                                className="text-teal-600 hover:text-teal-900"
                              >
                                Details
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="p-4 flex justify-center">
                <button
                  onClick={() => fetchNextPage()}
                  disabled={!hasNextPage || isFetchingNextPage}
                  className="px-4 py-2 bg-teal-600 text-white font-semibold rounded-lg shadow-md hover:bg-teal-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {isFetchingNextPage
                    ? "Loading more..."
                    : hasNextPage
                    ? "Load More"
                    : "Nothing more to load"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
