import Image from 'next/image';

export const LoginLogo = () => {
  return (
    <>
      {/* Mobile Logo */}
      <section 
        className="w-full flex flex-col items-center justify-center text-center p-6 lg:hidden"
        style={{
          background: 'linear-gradient(180deg, #6A36C5 0%, #22005B 84.79%, #11002E 100%)'
        }}
      >
        <Image
          src="/logo-login.svg"
          alt="logo-nairim-old-woman-home"
          width={200}
          height={72}
          className="mb-4"
          priority
        />
      </section>

      {/* Desktop Logo */}
      <section 
        className="hidden lg:flex w-full justify-center items-center"
        style={{
          background: 'linear-gradient(180deg, #6A36C5 0%, #22005B 84.79%, #11002E 100%)'
        }}
      >
        <Image
          src="/logo-login.svg"
          alt="logo-nairim-old-woman-home"
          width={601}
          height={217}
          className="xl:px-10"
          priority
          fetchPriority="high"
        />
      </section>
    </>
  );
};
