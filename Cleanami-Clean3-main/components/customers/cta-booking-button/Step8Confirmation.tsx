import GoogleConversionTracking from "@/components/ConversionTracking";
import { CheckCircle, Sparkles } from "lucide-react";

interface Step8ConfirmationProps {
  paymentIntentId?: string;
  amount?: number;
  currency?: string;
}

export const Step8Confirmation = ({ 
  paymentIntentId, 
  amount, 
  currency = 'CHF' 
}: Step8ConfirmationProps) => {
  return (
    <div className="text-center py-8 px-4">
      {paymentIntentId && amount && (
        <GoogleConversionTracking
          transactionId={paymentIntentId}
          value={amount}
          currency={currency}
        />
      )}
      <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-green-100">
        <CheckCircle className="h-12 w-12 text-green-600" />
      </div>
      <h2 className="mt-6 text-2xl font-bold text-gray-800">Setup Complete!</h2>
      <p className="mt-2 text-gray-600 max-w-md mx-auto">
        Congratulations! Your subscription is active, and your first cleaning is
        prepaid and ready to be scheduled.
      </p>
      <div className="mt-8 bg-white border border-gray-200 rounded-lg p-6 max-w-sm mx-auto">
        <div className="flex items-center">
          <div className="bg-teal-500 p-2 rounded-full mr-4">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <div>
            <h4 className="text-left font-semibold text-gray-800">
              What&apos;s Next?
            </h4>
            <p className="text-left text-sm text-gray-600">
              We&apos;ll monitor your iCal and automatically schedule your turnovers. We&apos;ll call you after booking to welcome you!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
