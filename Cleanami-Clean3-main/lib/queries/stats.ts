import { db } from '@/db';
import { jobs, properties } from '@/db/schemas';
import { sql, gte, lt, and, inArray, eq } from 'drizzle-orm';
import { aggregations } from './utils/queryBuilder';

export async function getJobStats(customerId?: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const selectFields = {
    totalJobs: aggregations.count(jobs.id),
    totalActive: aggregations.countWhere(
      jobs.id,
      inArray(jobs.status, ['unassigned', 'assigned', 'in-progress'])
    ),
    totalToday: aggregations.countWhere(
      jobs.id,
      and(gte(jobs.checkInTime, today), lt(jobs.checkInTime, tomorrow))!
    ),
    totalCompleted: aggregations.countWhere(
      jobs.id,
      sql`${jobs.status} = 'completed'`
    ),
    totalCanceled: aggregations.countWhere(
      jobs.id,
      sql`${jobs.status} = 'canceled'`
    ),
  };

  if (customerId) {
    const [stats] = await db
      .select(selectFields)
      .from(jobs)
      .innerJoin(properties, eq(jobs.propertyId, properties.id))
      .where(eq(properties.customerId, customerId));

    return stats;
  }

  const [stats] = await db.select(selectFields).from(jobs);

  return stats;
}
