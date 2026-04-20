import { Suspense } from "react";
import PropertyDetailPage from "@/components/domain/properties/PropertyDetail";

export default function ImovelDetailPage() {
  return (
    <Suspense>
      <PropertyDetailPage />
    </Suspense>
  );
}
