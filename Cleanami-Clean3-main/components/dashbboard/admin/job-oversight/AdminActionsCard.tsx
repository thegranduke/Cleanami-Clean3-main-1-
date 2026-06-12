'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { JobDetails } from '@/lib/queries/jobs';
import type { GetAvailableCleanersForJobResponse } from '@/app/api/jobs/[id]/available-cleaners/route';

// type AvailableCleaner = {
//   id: string;
//   fullName: string;
//   reliabilityScore: string | null;
//   onCallStatus: string;
//   distance: number;
// };

export function AdminActionsCard({
  job,
  onAction,
}: {
  job: JobDetails;
  onAction: (action: { title: string; message: string; onConfirm: () => void }) => void;
}) {
  const [selectedCleanerId, setSelectedCleanerId] = useState('');
  const [newDeadline, setNewDeadline] = useState(
    job.checkInTime ? new Date(job.checkInTime).toISOString().substring(0, 16) : ''
  );

  const isDisabled = job.status === 'canceled' || job.status === 'completed';

  
  const { data: response , isLoading: loadingCleaners } = useQuery<GetAvailableCleanersForJobResponse>({
  queryKey: ['available-cleaners', job.id],
  queryFn: async () => {
    const res = await fetch(`/api/jobs/${job.id}/available-cleaners`);
    if (!res.ok) throw new Error('Failed to fetch available cleaners');
    return res.json();
  },
});


  const availableCleaners = response?.cleaners || [];
  // const radiusMiles = response. || 25;

  const handleReassign = () => {
    if (!selectedCleanerId) return;

    const selectedCleaner = availableCleaners.find(c => c.id === selectedCleanerId);

    onAction({
      title: 'Reassign Cleaner',
      message: `Are you sure you want to reassign this job to ${selectedCleaner?.fullName}?`,
      onConfirm: async () => {
        try {
          const response = await fetch(`/api/jobs/${job.id}/reassign`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cleanerId: selectedCleanerId, role: 'primary' }),
          });
          if (!response.ok) throw new Error('Failed to reassign');
          setSelectedCleanerId('');
        } catch (error) {
          console.error('Reassign error:', error);
          alert('Failed to reassign cleaner');
        }
      },
    });
  };

  const handleExtendDeadline = () => {
    if (!newDeadline) return;

    onAction({
      title: 'Extend Deadline',
      message: `Extend deadline to ${new Date(newDeadline).toLocaleString()}?`,
      onConfirm: async () => {
        try {
          const response = await fetch(`/api/jobs/${job.id}/extend-deadline`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ newDeadline }),
          });
          if (!response.ok) throw new Error('Failed to extend deadline');
        } catch (error) {
          console.error('Extend deadline error:', error);
          alert('Failed to extend deadline');
        }
      },
    });
  };

  const handleUrgentReplacement = () => {
    onAction({
      title: 'Trigger Urgent Replacement',
      message: 'This will unassign the current cleaner and flag the job as urgent. Continue?',
      onConfirm: async () => {
        try {
          const response = await fetch(`/api/jobs/${job.id}/urgent-replacement`, {
            method: 'POST',
          });
          if (!response.ok) throw new Error('Failed to trigger urgent replacement');
        } catch (error) {
          console.error('Urgent replacement error:', error);
          alert('Failed to trigger urgent replacement');
        }
      },
    });
  };

  const handleCancelJob = () => {
    onAction({
      title: 'Cancel Job',
      message: 'Are you sure you want to cancel this job? This action cannot be undone.',
      onConfirm: async () => {
        try {
          const response = await fetch(`/api/jobs/${job.id}/cancel`, {
            method: 'POST',
          });
          if (!response.ok) throw new Error('Failed to cancel job');
        } catch (error) {
          console.error('Cancel job error:', error);
          alert('Failed to cancel job');
        }
      },
    });
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <div className="flex items-center mb-4 border-b pb-3">
        <svg className="h-6 w-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <h3 className="ml-3 text-lg font-semibold text-gray-800">Admin Overrides</h3>
      </div>

      <div className="space-y-4">
        {/* Reassign Cleaner */}
        <div>
          <label htmlFor="reassign-cleaner" className="block text-sm font-medium text-gray-700 mb-1">
            Reassign Cleaner
          </label>
          {loadingCleaners ? (
            <div className="text-sm text-gray-500">Loading cleaners...</div>
          ) : availableCleaners.length === 0 ? (
            <div className="text-sm text-yellow-600 bg-yellow-50 p-2 rounded">
              No cleaners available in this city
            </div>
          ) : (
            <div className="flex rounded-md shadow-sm">
              <select
  id="reassign-cleaner"
  value={selectedCleanerId}
  onChange={(e) => setSelectedCleanerId(e.target.value)}
  disabled={isDisabled}
  className="flex-1 focus:ring-teal-500 focus:border-teal-500 block w-full rounded-l-md sm:text-sm border-gray-300 disabled:bg-gray-100"
>
  <option value="">-- Select Cleaner --</option>
  {availableCleaners.map((cleaner) => (
    <option key={cleaner.id} value={cleaner.id}>
      {cleaner.fullName}
      {cleaner.reliabilityScore && ` (${cleaner.reliabilityScore}%)`}
      {` - ${cleaner.distance} mi`}
      {cleaner.onCallStatus === 'on_job' && ' - On Job'}
    </option>
  ))}
</select>
              
              <button
                onClick={handleReassign}
                disabled={isDisabled || !selectedCleanerId}
                className="-ml-px relative inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-r-md text-gray-700 bg-gray-50 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Assign
              </button>
            </div>
          )}
          {/* <p className="mt-1 text-xs text-gray-500">
  {availableCleaners.length} cleaner{availableCleaners.length !== 1 ? 's' : ''} within {radiusMiles} miles
</p> */}
        </div>

        {/* Extend Deadline */}
        <div>
          <label htmlFor="extend-deadline" className="block text-sm font-medium text-gray-700 mb-1">
            Extend Deadline
          </label>
          <div className="flex rounded-md shadow-sm">
            <input
              type="datetime-local"
              id="extend-deadline"
              value={newDeadline}
              onChange={(e) => setNewDeadline(e.target.value)}
              disabled={isDisabled}
              className="flex-1 focus:ring-teal-500 focus:border-teal-500 block w-full rounded-l-md sm:text-sm border-gray-300 disabled:bg-gray-100"
            />
            <button
              onClick={handleExtendDeadline}
              disabled={isDisabled || !newDeadline}
              className="-ml-px relative inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-r-md text-gray-700 bg-gray-50 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Update
            </button>
          </div>
        </div>

        {/* Urgent Replacement */}
        <button
          onClick={handleUrgentReplacement}
          disabled={isDisabled}
          className="w-full text-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Trigger Urgent Replacement
        </button>

        {/* Cancel Job */}
        <div className="pt-2 border-t">
          <button
            onClick={handleCancelJob}
            disabled={isDisabled}
            className="w-full flex items-center justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Cancel Job
          </button>
        </div>
      </div>
    </div>
  );
}