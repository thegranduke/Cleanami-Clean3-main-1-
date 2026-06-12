'use client';

import { useMemo, useState, useEffect } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { CleanersResponse } from '@/lib/queries/cleaners';
import { createClient } from '@/lib/supabase/client';
import { CleanersTable, SortableKey, SortConfig } from './CleanersTable';

async function fetchCleaners({ pageParam = 1 }: { pageParam: number }) {
  const res = await fetch(`/api/cleaners?page=${pageParam}`);
  if (!res.ok) {
    throw new Error('Network response was not ok');
  }
  return res.json() as Promise<CleanersResponse>;
}

export function CleanersPageClient() {
  const queryClient = useQueryClient();
  const [sortConfig, setSortConfig] = useState<SortConfig | null>({ key: 'createdAt', direction: 'descending' });

  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
  } = useInfiniteQuery({
    queryKey: ['cleaners'],
    queryFn: fetchCleaners,
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.nextPage,
  });
  
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('realtime-cleaners')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cleaners' },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['cleaners'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const allCleaners = useMemo(() => data?.pages.flatMap(page => page.data) ?? [], [data]);

  const uniqueCleaners = useMemo(() => 
    Array.from(new Map(allCleaners.map(c => [c.id, c])).values()), 
    [allCleaners]
  );
  
  const sortedCleaners = useMemo(() => {
    let sortableItems = [...uniqueCleaners];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const key = sortConfig.key;
        const valA = a[key];
        const valB = b[key];

        if (valA === null) return 1;
        if (valB === null) return -1;
        
        if (valA < valB) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (valA > valB) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [uniqueCleaners, sortConfig]);

  const handleSort = (key: SortableKey) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };
  
  const handleManageCleaner = (cleaner: CleanersResponse['data'][number]) => {
    console.log('Managing cleaner:', cleaner);
  };

  if (status === 'pending') return <p>Loading cleaners...</p>;
  if (status === 'error') return <p>Error: {error.message}</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Manage Cleaners</h1>
      <CleanersTable 
        cleaners={sortedCleaners} 
        sortConfig={sortConfig}
        onSort={handleSort}
        onManageCleaner={handleManageCleaner}
      />
      <div className="flex justify-center py-4">
        <button
          onClick={() => fetchNextPage()}
          disabled={!hasNextPage || isFetchingNextPage}
          className="px-4 py-2 bg-teal-600 text-white font-semibold rounded-lg shadow-md hover:bg-teal-700 disabled:bg-gray-400"
        >
          {isFetchingNextPage ? 'Loading...' : hasNextPage ? 'Load More' : 'No more cleaners'}
        </button>
      </div>
    </div>
  );
}
