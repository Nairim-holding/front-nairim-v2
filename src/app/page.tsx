import Filter from "@/components/filters/PropertyFilter";
import Footer from "@/components/layout/AppFooter";
import Header from "@/components/layout/AppHeader";
import ImoveisList from "@/components/domain/properties/PropertyList";
import CarrosselDinamico from "@/components/layout/HeroImage"; 

const API_URL = process.env.NEXT_PUBLIC_URL_API;

async function getImoveisDestaque() {
  try {
    const res = await fetch(`${API_URL}/properties?limit=100`, { cache: 'no-store' });
    if (!res.ok) return [];

    const result = await res.json();
    const rawList: any[] = result.data || [];

    const toSlide = (imovel: any, disponivel: boolean) => {
      const destaque =
        imovel.documents?.find((doc: any) => doc.is_featured && doc.type === "IMAGE") ||
        imovel.documents?.find((doc: any) => doc.type === "IMAGE");
      if (!destaque) return null;
      return {
        id: imovel.id,
        nome: imovel.title,
        imagem: destaque.file_path,
        disponivel,
      };
    };

    const isAvailable = (i: any) => {
      const valStatus = (i.values?.[0]?.status ?? "").toUpperCase();
      const propStatus = (i.status ?? "").toUpperCase();
      return valStatus === "AVAILABLE" || (valStatus === "" && propStatus === "ACTIVE");
    };

    const disponiveis = rawList
      .filter(isAvailable)
      .map((i: any) => toSlide(i, true))
      .filter((i): i is NonNullable<typeof i> => i !== null);

    if (disponiveis.length > 0) return disponiveis;

    // Fallback: mostra indisponíveis com badge
    return rawList
      .map((i: any) => toSlide(i, false))
      .filter((i): i is NonNullable<typeof i> => i !== null);

  } catch (error) {
    console.error("Erro ao processar dados da API:", error);
    return [];
  }
}

export default async function Home() {
  const imoveis = await getImoveisDestaque();

  return (
    <main className="min-h-screen flex flex-col">
      <Header />
      
      <div className="pb-10 md:pb-20">
        {imoveis.length > 0 ? (
          <CarrosselDinamico imoveis={imoveis} />
        ) : (
          <div className="relative w-full h-[50vh] bg-slate-100 flex items-center justify-center font-medium text-slate-400 animate-pulse">
            Buscando destaques da Nairim Holding...
          </div>
        )}
      </div>

      <Filter />
      <ImoveisList />
      <Footer />
    </main>
  );
}