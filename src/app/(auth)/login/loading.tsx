import { LoginLogo } from "@/components/auth/LoginLogo";
import { LoginHeader } from "@/components/auth/LoginHeader";

export default function Loading() {
  return (
    <section className="font-poppins flex flex-col lg:flex-row h-dvh w-full">
      <LoginLogo />

      <section className="flex flex-col justify-center items-center bg-surface-subtle w-full px-6 sm:px-10 md:px-16 lg:px-32 xl:px-40 2xl:px-60 py-10 sm:rounded-t-3xl lg:rounded-none shadow-lg  h-full">
        <LoginHeader />
        
        <div className="flex flex-col items-center justify-center w-full max-w-md gap-6">
          <div className="animate-pulse space-y-4 w-full">
            <div className="h-14 bg-gray-200 rounded-full w-full"></div>
            <div className="h-14 bg-gray-200 rounded-full w-full"></div>
            <div className="h-14 bg-gray-200 rounded-full w-full"></div>
          </div>
        </div>
      </section>
    </section>
  );
}
