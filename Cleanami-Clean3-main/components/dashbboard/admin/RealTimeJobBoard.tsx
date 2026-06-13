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
import { GetJobStatsResponse } from "@/app/api/jobs/stats/route";
import { KpiCard } from "./ui/KpiCard";
import { ClientTime } from "./ui/ClientTime";
import { getStatusBadge } from "../utils";

async function fetchJobs({ pageParam = 1 }: { pageParam: number }) {
  const res = await fetch(`/api/jobs?page=${pageParam}`);
  const result = (await res.json()) as GetJobsResponse & { error?: string };
  if (!res.ok) {
    throw new Error(result.error ?? "Could not load jobs");
  }
  return {
    jobs: result.data,
    nextPage: result.nextPage,
  };
}

export const RealTimeJobBoard = () => {
  const { data: user, isLoading: userLoading } = useCurrentUser();
  const userRole = user?.user_metadata?.role;
  const isAdmin = userRole === "admin" || userRole === "super_admin";
  const isCustomer = userRole === "user";
  const portalPrefix = isAdmin ? "/admin" : "/customer";

  const queryClient = useQueryClient();

  const { data: stats } = useQuery({
    queryKey: ["jobs", "stats"],
    queryFn: async () => {
      const res = await fetch("/api/jobs/stats");
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? "Failed to fetch stats");
      }
      return res.json() as Promise<GetJobStatsResponse>;
    },
    enabled: isAdmin || isCustomer,
    refetchInterval: 30000,
  });

  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
  } = useInfiniteQuery({
    queryKey: ["jobs"],
    queryFn: fetchJobs,
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    enabled: isAdmin || isCustomer,
  });

  useEffect(() => {
    if (!isAdmin) return;

    const supabase = createClient();
    const channel = supabase
      .channel("realtime-jobs-board")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "jobs" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["jobs"] });
          queryClient.invalidateQueries({ queryKey: ["jobs", "stats"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "jobs_to_cleaners" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["jobs"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, isAdmin]);

  const allJobs = data?.pages.flatMap((page) => page.jobs) ?? [];
  const uniqueJobs = Array.from(
    new Map(
      allJobs.filter((job) => job != null).map((job) => [job.id, job])
    ).values()
  );

  if (userLoading) {
    return (
      <div className="rounded-lg bg-white p-8 text-center text-gray-500 shadow-md">
        Loading your dashboard…
      </div>
    );
  }

  if (!isAdmin && !isCustomer) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-center text-amber-900">
        <p className="font-medium">Dashboard unavailable</p>
        <p className="mt-2 text-sm">
          This view is for property owners and administrators.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">
          {isCustomer ? "Your properties" : "Dashboard"}
        </h1>
        {isCustomer && (
          <p className="mt-1 text-sm text-gray-500">
            Upcoming and recent cleans for your subscribed properties.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {stats && (
          <>
            <KpiCard title="Total Jobs" value={stats.totalJobs.toString()} />
            <KpiCard title="Active Jobs" value={stats.totalActive.toString()} />
            <KpiCard
              title="Today's check-in schedule"
              value={stats.totalToday.toString()}
            />
            <KpiCard
              title="Completed"
              value={stats.totalCompleted.toString()}
            />
          </>
        )}
      </div>

      <div>
        <h2 className="mb-4 text-2xl font-bold text-gray-800">
          {isCustomer ? "Your clean schedule" : "Real-Time Job Board"}
        </h2>
        <div className="overflow-hidden rounded-lg bg-white shadow-md">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                  >
                    Property
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                  >
                    Cleaners
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                  >
                    Status
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                  >
                    Check-in time
                  </th>
                  <th scope="col" className="relative px-6 py-3">
                    <span className="sr-only">Details</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {status === "pending" ? (
                  <tr>
                    <td colSpan={5} className="p-4 text-center">
                      Loading jobs…
                    </td>
                  </tr>
                ) : status === "error" ? (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-red-500">
                      {error.message}
                    </td>
                  </tr>
                ) : uniqueJobs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-gray-500">
                      No jobs scheduled yet. Jobs appear here after your
                      property calendar syncs.
                    </td>
                  </tr>
                ) : (
                  uniqueJobs.map((job) => (
                    <tr key={job.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                        {job.property?.address ?? "N/A"}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        {job.assignedCleaners.length > 0
                          ? job.assignedCleaners
                              .map(
                                (
                                  c: JobsWithDetails["data"][number]["assignedCleaners"][number]
                                ) => c.fullName
                              )
                              .join(", ")
                          : "Awaiting assignment"}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <span
                          className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${getStatusBadge(
                            job.status || ""
                          )}`}
                        >
                          {job.status}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        {job.checkInTime ? (
                          <ClientTime dateString={job.checkInTime} />
                        ) : (
                          <span>N/A</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                        <Link
                          href={
                            `${portalPrefix}/job-oversight/${job.id}` as Route
                          }
                          className="text-teal-600 hover:text-teal-900"
                        >
                          Details
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {uniqueJobs.length > 0 && (
            <div className="flex justify-center p-4">
              <button
                onClick={() => fetchNextPage()}
                disabled={!hasNextPage || isFetchingNextPage}
                className="rounded-lg bg-teal-600 px-4 py-2 font-semibold text-white shadow-md hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                {isFetchingNextPage
                  ? "Loading more…"
                  : hasNextPage
                    ? "Load more"
                    : "Nothing more to load"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
