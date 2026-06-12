'use client';

import type { JobDetails } from '@/lib/queries/jobs';

export function CleanerCard({
  job,
  primaryCleaner,
  allCleaners,
  onAction,
}: {
  job: JobDetails;
  primaryCleaner?: JobDetails['cleaners'][0]['cleaner'];
  allCleaners: JobDetails['cleaners'];
  onAction: (action: { title: string; message: string; onConfirm: () => void }) => void;
}) {
  const handleCheckIn = async () => {
  onAction({
    title: 'Manual Check-In',
    message: `Check in ${primaryCleaner?.fullName} for this job?`,
    onConfirm: async () => {
      try {
        const response = await fetch(`/api/jobs/${job.id}/check-in`, {
          method: 'POST',
        });
        if (!response.ok) throw new Error('Failed to check in');
        // Optimistic update will be handled by real-time subscription
      } catch (error) {
        console.error('Check-in error:', error);
        alert('Failed to check in cleaner');
      }
    },
  });
};

const handleCheckOut = async () => {
  onAction({
    title: 'Manual Check-Out',
    message: `Check out ${primaryCleaner?.fullName} from this job?`,
    onConfirm: async () => {
      try {
        const response = await fetch(`/api/jobs/${job.id}/check-out`, {
          method: 'POST',
        });
        if (!response.ok) throw new Error('Failed to check out');
        // Optimistic update will be handled by real-time subscription
      } catch (error) {
        console.error('Check-out error:', error);
        alert('Failed to check out cleaner');
      }
    },
  });
};

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <div className="flex items-center mb-4 border-b pb-3">
        <svg className="h-6 w-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
        <h3 className="ml-3 text-lg font-semibold text-gray-800">Cleaner</h3>
      </div>

      <div className="space-y-4">
        {primaryCleaner ? (
          <>
            <div>
              <p className="font-semibold text-gray-800">{primaryCleaner.fullName}</p>
              <p className="text-sm text-gray-500">
                Reliability: {primaryCleaner.reliabilityScore ? `${primaryCleaner.reliabilityScore}%` : 'N/A'}
              </p>
              <p className="text-sm text-gray-500">Status: {primaryCleaner.onCallStatus}</p>
            </div>

            {/* Other cleaners */}
            {allCleaners.length > 1 && (
              <div className="pt-2 border-t">
                <p className="text-xs font-medium text-gray-500 mb-2">Additional Cleaners:</p>
                {allCleaners
                  .filter(c => c.role !== 'primary')
                  .map((c) => (
                    <div key={c.cleaner.id} className="text-sm text-gray-600">
                      <span className="font-medium">{c.cleaner.fullName}</span>
                      <span className="text-xs text-gray-400 ml-2">({c.role})</span>
                    </div>
                  ))}
              </div>
            )}

            {/* Action buttons */}
            {job.status === 'assigned' && (
              <button
                onClick={handleCheckIn}
                className="w-full text-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                Manual Check-In
              </button>
            )}

            {job.status === 'in-progress' && (
              <button
                onClick={handleCheckOut}
                className="w-full text-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gray-600 hover:bg-gray-700"
              >
                Manual Check-Out
              </button>
            )}
          </>
        ) : (
          <p className="text-sm text-gray-500">Unassigned</p>
        )}
      </div>
    </div>
  );
}