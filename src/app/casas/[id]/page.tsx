import { Suspense } from "react";
import PropertyDetailPage from "@/components/domain/properties/PropertyDetail";

export default function CasaDetailPage() {
  return (
    <Suspense>
      <PropertyDetailPage />
    </Suspense>
  );
}
