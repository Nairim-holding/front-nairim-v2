import ApartamentosLocacao from "@/components/ApartamentosLocacao";
import CasasLocacao from "@/components/CasasLocacao";
import Filter from "@/components/Filter";
import Footer from "@/components/Footer";
import Header  from "@/components/Header";
import Headline from "@/components/Headline";


export default function Home() {
  return (
    <main>
      <Header />
      <Headline />
      <Filter />
      <CasasLocacao />
      <ApartamentosLocacao />
      <Footer />
    </main>
  );
}
