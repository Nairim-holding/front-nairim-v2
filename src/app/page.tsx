import Filter from "@/components/filters/PropertyFilter";
import Footer from "@/components/layout/AppFooter";
import Header from "@/components/layout/AppHeader";
import ImoveisList from "@/components/domain/properties/PropertyList";
import CarrosselDinamico from "@/components/layout/HeroImage"; 

const API_URL = process.env.NEXT_PUBLIC_URL_API;

async function getImoveisDestaque() {
  try {
    const res = await fetch(`${API_URL}/properties`, { cache: 'no-store' });
    if (!res.ok) return [];
    
    const result = await res.json();
    
    // Acessa a chave 'data' do seu JSON
    const rawList = result.data || [];

    return rawList
      .map((imovel: any) => {
        // Busca a imagem de destaque ou a primeira imagem do array 'documents'
        const destaque = imovel.documents?.find((doc: any) => doc.is_featured && doc.type === "IMAGE") 
                        || imovel.documents?.find((doc: any) => doc.type === "IMAGE");

        if (!destaque) return null;

        return {
          id: imovel.id,
          nome: imovel.title,
          imagem: destaque.file_path, // O JSON já envia a URL completa
          preco: imovel.values?.[0]?.rental_value || "Sob consulta"
        };
      })
      .filter((i: any) => i !== null); // Remove imóveis sem imagem

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
            Buscando destaques Nairim...
          </div>
        )}
      </div>

      <Filter />
      <ImoveisList />
      <Footer />
    </main>
  );
}