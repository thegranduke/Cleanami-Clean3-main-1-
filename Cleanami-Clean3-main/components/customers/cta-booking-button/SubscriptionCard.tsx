export const SubscriptionCard = ({
  months,
  selected,
  onSelect,
}: {
  months: number;
  selected: boolean;
  onSelect: (months: number) => void;
}) => (
  <div
    onClick={() => onSelect(months)}
    className={`text-center p-3 m-2 border rounded-lg cursor-pointer transition-all duration-200 ${
      selected
        ? "bg-teal-50 border-teal-500 ring-2 ring-teal-500"
        : "bg-white border-gray-200 hover:border-gray-400"
    }`}
  >
    <p className="font-semibold text-lg  text-gray-800">{months}</p>
    <p className="text-sm text-gray-600">{months === 1 ? "Month" : "Months"}</p>
  </div>
);
