import { PropertyDetails } from "@/lib/queries/properties";
import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";

interface PropertyHeaderProps {
  property: PropertyDetails;
  customer: PropertyDetails['customer'];
}

export const PropertyHeader = ({ property, customer }: PropertyHeaderProps) => {
  return (
    <div>
      <Link
        href="/admin/properties"
        className="flex items-center text-sm font-semibold text-gray-600 hover:text-gray-900 mb-4"
      >
        <ArrowLeftIcon className="mr-2 h-5 w-5" />
        Back to Properties List
      </Link>
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h1 className="text-3xl font-bold text-gray-900">{property.address}</h1>
        <p className="text-gray-500 mt-1">Owned by: {customer?.name ?? 'N/A'}</p>
      </div>
    </div>
  );
};
