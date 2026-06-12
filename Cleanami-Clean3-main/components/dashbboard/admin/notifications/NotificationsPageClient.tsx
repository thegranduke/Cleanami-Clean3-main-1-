"use client";
import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function NotificationsPageClient() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["notifications", "recent"],
    queryFn: async () => {
      const res = await fetch("/api/notifications");
      if (!res.ok) throw new Error("Failed to fetch notifications");
      return res.json();
    },
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/notifications/${id}/mark-read`, { method: "POST" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications", "recent"] }),
  });

  if (isLoading) return <div>Loading notifications...</div>;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Notifications</h2>
      <div className="space-y-2">
        {data?.map((n: any) => (
          <div key={n.id} className="p-3 border rounded flex justify-between items-start">
            <div>
              <div className="font-medium">{n.title}</div>
              <div className="text-sm text-muted-foreground">{n.message}</div>
              <div className="text-xs text-muted-foreground">{n.createdAt || n.created_at}</div>
            </div>
            <div>
              {!n.is_read && (
                <button className="btn" onClick={() => markRead.mutate(n.id)}>
                  Mark read
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
