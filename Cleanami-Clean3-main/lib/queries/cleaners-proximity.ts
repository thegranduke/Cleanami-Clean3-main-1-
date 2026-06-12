import { db } from '@/db';
import { cleaners } from '@/db/schemas';
import { isNotNull, and } from 'drizzle-orm';
import { calculateDistance, getPropertyCoordinates } from '@/lib/services/google-maps/geocoding';

const DEFAULT_SERVICE_RADIUS_MILES = 25;

export type AvailableCleanerWithDistance = {
  id: string;
  fullName: string;
  reliabilityScore: string | null;
  onCallStatus: 'available' | 'unavailable' | 'on_job';
  distance: number;
};

export async function getAvailableCleanersForProperty(
  propertyId: string,
  options?: {
    radiusMiles?: number;
    includeOnJob?: boolean;
  }
): Promise<AvailableCleanerWithDistance[]> {
  const radiusMiles = options?.radiusMiles ?? DEFAULT_SERVICE_RADIUS_MILES;
  const includeOnJob = options?.includeOnJob ?? true;

  const propertyCoords = await getPropertyCoordinates(propertyId);

  if (!propertyCoords) {
    throw new Error('Could not geocode property address');
  }

  const allCleaners = await db.query.cleaners.findMany({
    where: and(
      isNotNull(cleaners.latitude),
      isNotNull(cleaners.longitude),
      isNotNull(cleaners.onCallStatus)
    ),
    columns: {
      id: true,
      fullName: true,
      latitude: true,
      longitude: true,
      reliabilityScore: true,
      onCallStatus: true,
    },
  });

  const availableCleaners = allCleaners
    .map((cleaner) => {
      const distance = calculateDistance(
        propertyCoords,
        {
          latitude: parseFloat(cleaner.latitude!),
          longitude: parseFloat(cleaner.longitude!),
        }
      );

      return {
        id: cleaner.id,
        fullName: cleaner.fullName,
        reliabilityScore: cleaner.reliabilityScore,
        onCallStatus: cleaner.onCallStatus!,
        distance: Math.round(distance * 10) / 10,
      };
    })
    .filter((c) => {
      if (c.distance > radiusMiles) return false;
      
      if (!includeOnJob && c.onCallStatus === 'on_job') return false;
      
      return true;
    })
    .sort((a, b) => {
      const scoreA = parseFloat(a.reliabilityScore || '0');
      const scoreB = parseFloat(b.reliabilityScore || '0');
      if (scoreB !== scoreA) return scoreB - scoreA;
      return a.distance - b.distance;
    });

  return availableCleaners;
}

export async function getAvailableCleanersForJob(
  jobId: string,
  options?: {
    radiusMiles?: number;
    includeOnJob?: boolean;
  }
): Promise<{
  cleaners: AvailableCleanerWithDistance[];
  propertyId: string;
  propertyAddress: string;
}> {
  const { jobs } = await import('@/db/schemas');
  const { eq } = await import('drizzle-orm');

  const job = await db.query.jobs.findFirst({
    where: eq(jobs.id, jobId),
    with: {
      property: {
        columns: {
          id: true,
          address: true,
        },
      },
    },
  });

  if (!job || !job.property) {
    throw new Error('Job or property not found');
  }

  const cleaners = await getAvailableCleanersForProperty(job.property.id, options);

  return {
    cleaners,
    propertyId: job.property.id,
    propertyAddress: job.property.address,
  };
}

export async function getClosestCleanerForProperty(
  propertyId: string,
  options?: {
    radiusMiles?: number;
  }
): Promise<AvailableCleanerWithDistance | null> {
  const cleaners = await getAvailableCleanersForProperty(propertyId, {
    ...options,
    includeOnJob: false,
  });

  return cleaners[0] || null;
}