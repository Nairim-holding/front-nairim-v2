"use client";
import Link from "next/link";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import { ApiResponse } from "@/types/types";
import { useAuth } from "@/contexts/AuthContext";

export default function LoginPage() {
  const navigation = useRouter();
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const formData = new FormData(e.target as HTMLFormElement);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_URL_API}/auth/login`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, password }),
        }
      );

      const data: ApiResponse = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || `HTTP error! status: ${response.status}`);
      }
      
      login(data.data.token, data.data.user);
      
      navigation.push('/dashboard');
    } catch (err: unknown) {
      let errorMessage = 'Erro ao tentar fazer login. Verifique suas credenciais.';
      
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === 'string') {
        errorMessage = err;
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }

  const togglePassword = () => setShowPassword((prev) => !prev);

  return (
    <section className="font-poppins flex flex-col lg:flex-row h-dvh w-full">
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

      <section className="flex flex-col justify-center items-center bg-surface-subtle w-full px-6 sm:px-10 md:px-16 lg:px-32 xl:px-40 2xl:px-60 py-10 sm:rounded-t-3xl lg:rounded-none shadow-lg  h-full">
        <div className="flex items-start w-full max-w-md mb-10 flex-col">
          <h1 className="text-3xl font-bold text-content mb-2 w-full text-center">
            Bem vindo de volta!
          </h1>
          <span className="text-content-muted text-lg w-full text-center">Faça login</span>
        </div>

        <form className="flex flex-col gap-6 w-full max-w-md" onSubmit={onSubmit}>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 text-content-placeholder" size={20} />
            <input
              type="email"
              name="email"
              placeholder="exemplo@gmail.com"
              className="h-[56px] text-content w-full pl-12 pr-4 py-3 bg-surface border border-ui-border rounded-full focus:border-brand focus:ring-1 focus:ring-brand outline-none transition-all duration-200 placeholder:text-content-placeholder disabled:opacity-50 disabled:cursor-not-allowed"
              required
              disabled={isLoading}
              aria-label="Email"
              autoComplete="email"
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-content-placeholder" size={20} />
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              placeholder="senha"
              className="h-[56px] text-content w-full pl-12 pr-12 py-3 bg-surface border border-ui-border rounded-full focus:border-brand focus:ring-1 focus:ring-brand outline-none transition-all duration-200 placeholder:text-content-placeholder disabled:opacity-50 disabled:cursor-not-allowed"
              required
              disabled={isLoading}
              aria-label="Senha"
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={togglePassword}
              className="absolute right-4 top-1/2 transform -translate-y-1/2 text-content-placeholder hover:text-brand transition-colors duration-200 disabled:opacity-50"
              disabled={isLoading}
              aria-label="Mostrar senha"
            >
              {showPassword ? <Eye size={20} /> : <EyeOff size={20} />}
            </button>
          </div>

          {error && (
            <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="
              bg-brand hover:bg-brand-hover
              text-white font-normal rounded-full py-3 px-6
              transition-all duration-200
              disabled:opacity-50 disabled:cursor-not-allowed
              mt-2 h-[56px]
            "
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Entrando...
              </span>
            ) : 'Entrar'}
          </button>
        </form>

        <Link 
          href="/forgot-password" 
          className="text-sm underline text-center text-content-muted hover:text-brand transition-colors duration-200 mt-8"
        >
          Esqueci a senha
        </Link> 
      </section>
    </section>
  );
}