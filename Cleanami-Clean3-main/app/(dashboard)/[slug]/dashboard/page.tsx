import { getJobsWithDetails } from '@/lib/queries/jobs';
import { RealTimeJobBoard } from "@/components/dashbboard/admin/RealTimeJobBoard";
import { PrefetchedInfinitePage } from '@/components/PrefetchedInfinitePage';

export default async function Page() {
  return (
    <PrefetchedInfinitePage
      queryKey={['jobs']}
      queryFn={async () => {
        const result = await getJobsWithDetails({ page: 1 });
        return {
          jobs: result.data,
          nextPage: result.nextPage,
        };

      }}
      getNextPageParam={(lastPage) => lastPage.nextPage}
    >
      <RealTimeJobBoard />
    </PrefetchedInfinitePage>
  );
}