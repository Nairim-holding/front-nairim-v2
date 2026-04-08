"use client";

import Image from "next/image";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Navigation, EffectFade } from "swiper/modules";
import { ChevronLeft, ChevronRight } from "lucide-react"; // Usando ícones padrão

// Estilos essenciais
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/effect-fade';

interface Imovel {
  id: string;
  nome: string;
  imagem: string;
}

export default function CarrosselDinamico({ imoveis }: { imoveis: Imovel[] }) {
  if (!imoveis || imoveis.length === 0) return null;

  return (
    <section className="relative w-full h-[60vh] lg:h-[85vh] overflow-hidden bg-black group">
      <Swiper
        modules={[Autoplay, Navigation, EffectFade]}
        effect="fade"
        loop={imoveis.length > 1}
        autoplay={{ 
          delay: 5000, 
          disableOnInteraction: false 
        }}
        navigation={{
          nextEl: ".button-next",
          prevEl: ".button-prev",
        }}
        className="h-full w-full"
      >
        {imoveis.map((imovel) => (
          <SwiperSlide key={imovel.id}>
            <div className="relative w-full h-full">
              <Image
                src={imovel.imagem}
                alt={imovel.nome}
                fill
                priority
                className="object-cover object-center"
                sizes="100vw"
                quality={90}
              />
            </div>
          </SwiperSlide>
        ))}
      </Swiper>

      {/* Botões Customizados (Garantem que a setinha apareça) */}
      <button className="button-prev absolute left-5 top-1/2 -translate-y-1/2 z-10 w-12 h-12 flex items-center justify-center rounded-full bg-black/30 text-white opacity-0 group-hover:opacity-100 transition-all hover:bg-black/60">
        <ChevronLeft size={32} />
      </button>
      
      <button className="button-next absolute right-5 top-1/2 -translate-y-1/2 z-10 w-12 h-12 flex items-center justify-center rounded-full bg-black/30 text-white opacity-0 group-hover:opacity-100 transition-all hover:bg-black/60">
        <ChevronRight size={32} />
      </button>

      <style jsx global>{`
        /* Remove as setas padrão do Swiper que podem estar quebradas */
        .swiper-button-next,
        .swiper-button-prev {
          display: none !important;
        }
      `}</style>
    </section>
  );
}