import { NextRequest, NextResponse } from "next/server";

const TIMEOUT = 5000;

interface ViaCepResponse {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
}

interface OpenCepResponse {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
}

interface BrasilApiResponse {
  cep: string;
  state: string;
  city: string;
  neighborhood: string;
  street: string;
  service: string;
}

interface CepNormalizado {
  cep: string;
  rua: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
  fonte: string;
}

function limparCep(cep: string): string {
  return cep.replace(/\D/g, "");
}

function validarCep(cep: string): boolean {
  return /^[0-9]{8}$/.test(cep);
}

async function fetchComTimeout(url: string, timeout = TIMEOUT): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    return await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
    });
  } finally {
    clearTimeout(id);
  }
}

async function normalizarViaCep(data: ViaCepResponse): Promise<CepNormalizado> {

  return {
    cep: data.cep,
    rua: data.logradouro,
    complemento: data.complemento,
    bairro: data.bairro,
    cidade: data.localidade,
    estado: data.uf,
    fonte: "ViaCEP",
  };
}

async function normalizarOpenCep(data: OpenCepResponse): Promise<CepNormalizado> {

  return {
    cep: data.cep,
    rua: data.logradouro,
    complemento: data.complemento,
    bairro: data.bairro,
    cidade: data.localidade,
    estado: data.uf,
    fonte: "OpenCEP",
  };
}

async function normalizarBrasilApi(data: BrasilApiResponse): Promise<CepNormalizado> {

  return {
    cep: data.cep,
    rua: data.street,
    complemento: '',
    bairro: data.neighborhood,
    cidade: data.city,
    estado: data.state,
    fonte: "BrasilAPI",
  };
}

async function buscarViaCep(cep: string): Promise<CepNormalizado> {
  const response = await fetchComTimeout(`https://viacep.com.br/ws/${cep}/json/`);

  if (!response.ok) {
    throw new Error("Erro HTTP ViaCEP");
  }

  const data: ViaCepResponse = await response.json();

  if (data.erro) {
    throw new Error("CEP não encontrado no ViaCEP");
  }

  return await normalizarViaCep(data);
}

async function buscarOpenCep(cep: string): Promise<CepNormalizado> {
  const response = await fetchComTimeout(`https://opencep.com/v1/${cep}`);

  if (!response.ok) {
    throw new Error("Erro HTTP OpenCEP");
  }

  const data: OpenCepResponse = await response.json();

  if (!data.cep) {
    throw new Error("CEP não encontrado no OpenCEP");
  }

  return await normalizarOpenCep(data);
}

async function buscarBrasilApi(cep: string): Promise<CepNormalizado> {
  const response = await fetchComTimeout(`https://brasilapi.com.br/api/cep/v2/${cep}`);

  if (!response.ok) {
    throw new Error("Erro HTTP BrasilAPI");
  }

  const data: BrasilApiResponse = await response.json();

  if (!data.cep) {
    throw new Error("CEP não encontrado na BrasilAPI");
  }

  return await normalizarBrasilApi(data);
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ cep: string }> }
) {
  const { cep } = await context.params;
  const cepLimpo = limparCep(cep);
  // CEP preenche o endereço. A localização é confirmada separadamente no cadastro.

  if (!validarCep(cepLimpo)) {
    return NextResponse.json(
      { error: "CEP inválido" },
      { status: 400 }
    );
  }

  try {
    const endereco = await buscarViaCep(cepLimpo);
    return NextResponse.json(endereco, { status: 200 });
  } catch (viaCepError: unknown) {
    if (viaCepError instanceof Error) {
      console.warn("ViaCEP falhou:", viaCepError.message);
    }

    try {
      const endereco = await buscarOpenCep(cepLimpo);
      return NextResponse.json(endereco, { status: 200 });
    } catch (openCepError: unknown) {
      if (openCepError instanceof Error) {
        console.warn("OpenCEP falhou:", openCepError.message);
      }

      // Terceiro fallback: BrasilAPI
      try {
        const endereco = await buscarBrasilApi(cepLimpo);
        return NextResponse.json(endereco, { status: 200 });
      } catch (brasilApiError: unknown) {
        if (brasilApiError instanceof Error) {
          console.error("BrasilAPI também falhou:", brasilApiError.message);
        }

        return NextResponse.json(
          { error: "CEP não encontrado em nenhuma base" },
          { status: 404 }
        );
      }
    }
  }
}
