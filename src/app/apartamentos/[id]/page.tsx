import { Suspense } from "react";
import PropertyDetailPage from "@/components/domain/properties/PropertyDetail";

export default function ApartamentoDetailPage() {
  return (
    <Suspense>
      <PropertyDetailPage />
    </Suspense>
  );
}
