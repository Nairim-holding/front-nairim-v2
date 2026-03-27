import ApartamentosLocacao from "@/components/domain/properties/ApartmentRentals";
import CasasLocacao from "@/components/domain/properties/HouseRentals";
import Filter from "@/components/filters/PropertyFilter";
import Footer from "@/components/layout/AppFooter";
import Header  from "@/components/layout/AppHeader";
import Headline from "@/components/layout/HeroImage";
import ImoveisList from "@/components/domain/properties/PropertyList";


export default function Home() {
  return (
    <main>
      <Header />
      <Headline />
      <Filter />
      <ImoveisList />
      <Footer />
    </main>
  );
}
