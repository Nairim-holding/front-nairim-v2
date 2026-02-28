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

function normalizarViaCep(data: ViaCepResponse): CepNormalizado {
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

function normalizarOpenCep(data: OpenCepResponse): CepNormalizado {
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

async function buscarViaCep(cep: string): Promise<CepNormalizado> {
  const response = await fetchComTimeout(`https://viacep.com.br/ws/${cep}/json/`);

  if (!response.ok) {
    throw new Error("Erro HTTP ViaCEP");
  }

  const data: ViaCepResponse = await response.json();

  if (data.erro) {
    throw new Error("CEP não encontrado no ViaCEP");
  }

  return normalizarViaCep(data);
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

  return normalizarOpenCep(data);
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ cep: string }> }
) {
  const { cep } = await context.params;
  const cepLimpo = limparCep(cep);

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
        console.error("OpenCEP também falhou:", openCepError.message);
      }

      return NextResponse.json(
        { error: "CEP não encontrado em nenhuma base" },
        { status: 404 }
      );
    }
  }
}