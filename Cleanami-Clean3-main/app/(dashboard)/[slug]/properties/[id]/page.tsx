import { getPropertyDetails } from "@/lib/queries/properties";
import { PropertyDetailesRightColumn } from "@/components/dashbboard/admin/properties/PropertyDetailsRightColumn";
import PropertyDetailsLeftColumn from "@/components/dashbboard/admin/properties/PropertyDetailsLeftColumn";
import { PropertyHeader } from "@/components/dashbboard/admin/properties/PropertyHeader";

// The page now receives the dynamic route parameter, e.g., 'id'
export default async function Page({ params }: { params: { id: string } }) {
  // Fetch ALL property data in one go on the server
  const propertyDetails = await getPropertyDetails(params.id);
 
  return (
    <div className="space-y-6">
      {/* Pass the necessary data down as props */}
      <PropertyHeader 
        property={propertyDetails} 
        customer={propertyDetails.customer} 
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PropertyDetailsLeftColumn 
          property={propertyDetails} 
          subscription={propertyDetails.activeSubscription} 
        />
        
         {/* checklistFiles={propertyDetails.checklistFiles}  */}
        <PropertyDetailesRightColumn />
      </div>
    </div>
  );
};