"use client";
import Image from "next/image";

export default function SectionImage() {
  return (
    <section className="relative w-full h-[50vh] min-h-[300px] max-h-[800px] sm:h-[60vh] md:h-[70vh] lg:h-[80vh]">
      <Image
        src="/Imagem-Ilustrativa.jpg"
        alt="Imagem Ilustrativa"
        fill
        sizes="100vw"
        className="object-cover object-center"
        priority
        quality={75}
      />
      <div className="absolute inset-0 bg-black/20" />
    </section>
  );
}