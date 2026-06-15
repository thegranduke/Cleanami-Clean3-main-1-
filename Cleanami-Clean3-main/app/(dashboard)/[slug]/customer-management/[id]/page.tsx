
import { JobHistory } from "@/components/dashbboard/admin/customer-management/JobHistory";
import { PaymentHistory } from "@/components/dashbboard/admin/customer-management/PaymentHistory";
import { Services } from "@/components/dashbboard/admin/customer-management/Services";
import { Subscriptions } from "@/components/dashbboard/admin/customer-management/Subscriptions";
import { CustomerProperties } from "@/components/dashbboard/admin/customer-management/CustomerProperties";
import { ClipboardListIcon, CreditCardIcon, DollarSign, House, MailIcon, PhoneIcon, SparkleIcon } from "lucide-react";
import Link from "next/link";
import { getCustomerDetails } from "@/lib/queries/customers";
import { formatContactValue } from "@/components/dashbboard/admin/ui/formatContact";


// FIX: The dynamic parameter from the folder name '[id]' is `params.id`.
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customerDetails = await getCustomerDetails(id);
  
  return (
    <div className="space-y-6">
      <Link
        href='/admin/customer-management'
        className="text-sm font-semibold text-teal-600 hover:text-teal-800"
      >
        &larr; Back to All Customers
      </Link>
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-gray-800">{customerDetails.name}</h2>
        <p className="text-sm text-gray-500 font-mono">{customerDetails.id}</p>
        <div className="mt-4 flex flex-col gap-2 text-sm text-gray-600 sm:flex-row sm:gap-8">
          <p className="flex items-center gap-2">
            <MailIcon className="h-4 w-4 text-teal-600" />
            <span className="font-medium text-gray-700">Email:</span>
            {formatContactValue(customerDetails.email)}
          </p>
          <p className="flex items-center gap-2">
            <PhoneIcon className="h-4 w-4 text-teal-600" />
            <span className="font-medium text-gray-700">Phone:</span>
            {formatContactValue(customerDetails.phone)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="font-semibold text-lg mb-4 flex items-center">
            <House className="h-6 w-6 mr-2 text-teal-500" /> Properties
          </h3>
          <CustomerProperties properties={customerDetails.properties} />
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="font-semibold text-lg mb-4 flex items-center">
            <SparkleIcon className="h-6 w-6 mr-2 text-teal-500" /> Service Add-ons
          </h3>
          <Services properties={customerDetails.properties} />
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="font-semibold text-lg mb-4 flex items-center">
            <CreditCardIcon className="h-6 w-6 mr-2 text-teal-500" />{" "}
            Subscriptions
          </h3>
          <Subscriptions subscriptions={customerDetails.subscriptions} />
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="font-semibold text-lg mb-4 flex items-center">
          <DollarSign className="h-6 w-6 mr-2 text-teal-500" /> Payment
          History
        </h3>
        <div className="overflow-x-auto max-h-96">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Date</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Job ID</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Amount</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Status</th>
              </tr>
            </thead>
            <PaymentHistory />
          </table>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="font-semibold text-lg mb-4 flex items-center">
          <ClipboardListIcon className="h-6 w-6 mr-2 text-teal-500" /> Job History
        </h3>
        <div className="overflow-x-auto max-h-96">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Job ID</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Property</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Date</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Status</th>
              </tr>
            </thead>
            <JobHistory jobs={customerDetails.recentJobs} properties={customerDetails.properties} />
          </table>
        </div>
      </div>
    </div>
  );
};

