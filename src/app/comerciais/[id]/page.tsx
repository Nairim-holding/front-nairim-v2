import { Suspense } from "react";
import PropertyDetailPage from "@/components/domain/properties/PropertyDetail";

export default function ComercialDetailPage() {
  return (
    <Suspense>
      <PropertyDetailPage />
    </Suspense>
  );
}
