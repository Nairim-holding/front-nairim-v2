import Filter from "@/components/filters/PropertyFilter";
import Footer from "@/components/layout/AppFooter";
import Header from "@/components/layout/AppHeader";
import ImoveisList from "@/components/domain/properties/PropertyList";
import CarrosselDinamico from "@/components/layout/HeroImage";
import { getPublicPropertiesData } from "@/server/queries/public";
import type { PublicProperty } from "@/core/entities/public-property";

const SLUG = 'nairim';

// Equivalente ao `next: { revalidate: 300 }` que o fetch antigo usava (ISR).
export const revalidate = 300;

async function getImoveisDestaque() {
  try {
    const result = await getPublicPropertiesData(SLUG, { limit: 20 });
    const rawList: PublicProperty[] = result.items ?? [];

    const toSlide = (imovel: PublicProperty, disponivel: boolean) => {
      const destaque =
        imovel.documents?.find((doc) => doc.is_featured && doc.file_path) ||
        imovel.documents?.find((doc) => doc.file_path);
      if (!destaque || !destaque.file_path) return null;

      const desc = (imovel.type?.description ?? "").toLowerCase();
      let tipo = "imoveis";
      if (desc === "casa" || desc.includes("chác") || desc.includes("sítio")) tipo = "casas";
      else if (desc.includes("apart") || desc.includes("cobertura") || desc.includes("flat") || desc.includes("kitnet")) tipo = "apartamentos";
      else if (desc.includes("comercial") || desc.includes("loja") || desc.includes("barracão") || desc.includes("galpão")) tipo = "comerciais";

      return {
        id: imovel.id,
        nome: imovel.title,
        imagem: destaque.file_path,
        tipo,
        disponivel,
      };
    };

    const isAvailable = (i: PublicProperty) => {
      const valStatus = (i.values?.[0]?.status ?? "").toUpperCase();
      return valStatus === "AVAILABLE";
    };

    const disponiveis = rawList
      .filter(isAvailable)
      .map((i) => toSlide(i, true))
      .filter((i): i is NonNullable<typeof i> => i !== null);

    if (disponiveis.length > 0) return disponiveis;

    // Fallback: mostra indisponíveis com badge
    return rawList
      .map((i) => toSlide(i, false))
      .filter((i): i is NonNullable<typeof i> => i !== null);

  } catch (error) {
    console.error("Erro ao processar os dados da API:", error);
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
            Buscando destaques...
          </div>
        )}
      </div>

      <Filter />
      <ImoveisList />
      <Footer />
    </main>
  );
}