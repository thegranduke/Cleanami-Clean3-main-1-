'use client'
import { useEffect, useState } from 'react';

const SafeClientDate = ({ date }: { date: string | null | undefined }) => {
    const [formattedDate, setFormattedDate] = useState<string | null>(null);

    useEffect(() => {
        if (date) {
            setFormattedDate(new Date(date).toLocaleDateString());
        }
    }, [date]);

    return <>{formattedDate}</>;
}

export const PaymentHistory = () => {
  return (
    <tbody className="divide-y">
        <tr>
            <td colSpan={4} className="text-center p-4 text-gray-500">No payment history found.</td>
        </tr>
    </tbody>
  );
};
