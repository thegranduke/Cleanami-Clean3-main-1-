import React, { useState, useEffect } from 'react';
import { loadStripe, StripeElementsOptions } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { PriceDetails, SignupFormData } from '@/lib/validations/bookng-modal';
import { createValidatedPaymentIntent } from '@/lib/actions/payment.actions';
import { CheckoutForm } from './CheckoutForm';
import { FounderCard } from '../../FounderCard';
import { ShieldCheck, Lock } from 'lucide-react';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

interface Props {
  priceDetails: PriceDetails | null;
  formData: SignupFormData;
  onPaymentSuccess: (paymentIntentId: string) => void;
  onBookCall?: () => void;
  onContinueSetup?: () => void;
}

export const Step7Payment = ({ 
  priceDetails, 
  formData, 
  onPaymentSuccess,
  onBookCall,
  onContinueSetup,
}: Props) => {
  const [clientSecret, setClientSecret] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);

  useEffect(() => {
    if (!priceDetails || priceDetails.totalPerClean <= 0) return;

    const amountInCents = Math.round(priceDetails.totalPerClean * 100);

    createValidatedPaymentIntent(formData, amountInCents)
      .then(result => {
        if (result.error) {
          setError(result.error);
        } else if (result.clientSecret) {
          setClientSecret(result.clientSecret);
          setError(null);
        }
      });
  }, [priceDetails, formData]);

  const appearance = { theme: 'stripe' as const, variables: { colorPrimary: '#14b8a6' } };
  const options: StripeElementsOptions = { clientSecret, appearance };

  const handleContinueToPayment = () => {
    setShowPaymentForm(true);
    onContinueSetup?.();
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900">Secure Payment & Activation</h3>
        <p className="mt-1 text-sm text-gray-600">
          Enter your payment details to prepay for your first clean and activate your subscription.
        </p>
      </div>

      {/* Reassurance text ABOVE Founder Card - per spec */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-amber-800 font-medium">
          Want to double-check everything before activating?
        </p>
      </div>

      {/* Founder Card - CALL DECISION POINT E (ABOVE payment fields) - per spec */}
      {!showPaymentForm && onBookCall && (
        <FounderCard
          onBookCall={onBookCall}
          onContinue={handleContinueToPayment}
        />
      )}

      {/* Payment Form - shown after user dismisses Founder Card or clicks continue */}
      {(showPaymentForm || !onBookCall) && (
        <>
          {error && (
            <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-md text-sm">
              {error}
            </div>
          )}

          {clientSecret && !error ? (
            <Elements options={options} stripe={stripePromise}>
              <CheckoutForm onPaymentSuccess={onPaymentSuccess} />
            </Elements>
          ) : (
            <div className="h-48 flex items-center justify-center">
              {!error && <div className="spinner" />}
            </div>
          )}

          {/* Reassurance text BELOW payment section - per spec */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex items-start gap-3">
            <Lock className="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-gray-700 font-medium">
                Payments are processed securely via Stripe.
              </p>
              <p className="text-sm text-gray-600 mt-1">
                We only charge after a clean is completed and verified.
              </p>
            </div>
          </div>
        </>
      )}

      <style jsx>{`
        .spinner {
          border: 3px solid #e5e7eb;
          border-top: 3px solid #14b8a6;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};