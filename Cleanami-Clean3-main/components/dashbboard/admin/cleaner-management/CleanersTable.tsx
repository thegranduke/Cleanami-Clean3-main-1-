'use client'

import { ChevronDownIcon, ChevronsUpDown, ChevronUpIcon, UserIcon } from "lucide-react";
import { CleanersResponse } from "@/lib/queries/cleaners"; 
import { formatDate } from "date-fns";

type Cleaner = CleanersResponse['data'][number];

const getStatusBadge = (status: "available" | "unavailable" | "on_job" | string | null | undefined) => {
  switch (status) {
    case 'available': return 'bg-green-100 text-green-800';
    case 'on_job': return 'bg-blue-100 text-blue-800';
    case 'unavailable': return 'bg-yellow-100 text-yellow-800';
    case 'Suspended': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

export type SortDirection = 'ascending' | 'descending';
export type SortableKey = 'fullName' | 'onCallStatus' | 'createdAt';

export interface SortConfig {
  key: SortableKey;
  direction: SortDirection;
}

interface CleanersTableProps {
  cleaners: Cleaner[];
  sortConfig: SortConfig | null;
  onSort: (key: SortableKey) => void;
  onManageCleaner: (cleaner: Cleaner) => void;
}

export const CleanersTable = ({ cleaners, sortConfig, onSort, onManageCleaner }: CleanersTableProps) => {
  const headers: { key: SortableKey; label: string }[] = [
    { key: 'fullName', label: 'Name' },
    { key: 'onCallStatus', label: 'Status' },
    { key: 'createdAt', label: 'Join Date' },
  ];

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {headers.map((header) => (
                <th
                  key={header.key}
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  <button
                    onClick={() => onSort(header.key)}
                    className="flex items-center group focus:outline-none"
                  >
                    {header.label}
                    <span className="ml-2">
                      {sortConfig?.key === header.key ? (
                        sortConfig.direction === "ascending" ? (
                          <ChevronUpIcon className="h-4 w-4" />
                        ) : (
                          <ChevronDownIcon className="h-4 w-4" />
                        )
                      ) : (
                        <ChevronsUpDown className="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </span>
                  </button>
                </th>
              ))}
              <th scope="col" className="relative px-6 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {cleaners.map((cleaner) => (
              <tr key={cleaner.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-10 bg-gray-200 rounded-full flex items-center justify-center">
                      <UserIcon className="h-6 w-6 text-gray-500" />
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">
                        {cleaner.fullName}
                      </div>
                      <div className="text-sm text-gray-500">{cleaner.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadge(
                      cleaner.onCallStatus
                    )}`}
                  >
                    {cleaner.onCallStatus?.replace('_', ' ') || 'N/A'}
                  </span>
                </td>
                 <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDate(cleaner.createdAt, 'yyyy-MM-dd')}
                </td>
                {/* <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() => onManageCleaner(cleaner)}
                    className="text-teal-600 hover:text-teal-900"
                  >
                    Manage
                  </button>
                </td> */}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

