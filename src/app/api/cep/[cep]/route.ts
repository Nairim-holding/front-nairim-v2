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
  latitude?: number;
  longitude?: number;
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

async function buscarCoordenadas(endereco: string, cidadeEstado: string): Promise<{ lat?: number; lng?: number }> {
  try {
    // Tentativa 1: Endereço Completo
    let url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(endereco)}&limit=1`;
    let res = await fetch(url, {
      headers: {
        "User-Agent": `${'nairim'}/1.0`,
        "Accept-Language": "pt-BR",
        Accept: "application/json",
      },
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
        };
      }
    }

    // Tentativa 2: Apenas Cidade e Estado (Fallback)
    url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cidadeEstado)}&limit=1`;
    res = await fetch(url, {
      headers: {
        "User-Agent": `${'nairim'}/1.0`,
        "Accept-Language": "pt-BR",
        Accept: "application/json",
      },
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
        };
      }
    }
  } catch (err) {
    console.error("Erro ao buscar coordenadas no Nominatim:", err);
  }
  return {};
}

async function normalizarViaCep(data: ViaCepResponse, numero?: string): Promise<CepNormalizado> {
  const logradouroCompleto = numero ? `${data.logradouro}, ${numero}` : data.logradouro;
  const enderecoCompleto = `${logradouroCompleto}, ${data.localidade}, ${data.uf}, Brasil`;
  const cidadeEstado = `${data.localidade}, ${data.uf}, Brasil`;
  const coords = await buscarCoordenadas(enderecoCompleto, cidadeEstado);

  return {
    cep: data.cep,
    rua: data.logradouro,
    complemento: data.complemento,
    bairro: data.bairro,
    cidade: data.localidade,
    estado: data.uf,
    fonte: "ViaCEP",
    latitude: coords.lat,
    longitude: coords.lng,
  };
}

async function normalizarOpenCep(data: OpenCepResponse, numero?: string): Promise<CepNormalizado> {
  const logradouroCompleto = numero ? `${data.logradouro}, ${numero}` : data.logradouro;
  const enderecoCompleto = `${logradouroCompleto}, ${data.localidade}, ${data.uf}, Brasil`;
  const cidadeEstado = `${data.localidade}, ${data.uf}, Brasil`;
  const coords = await buscarCoordenadas(enderecoCompleto, cidadeEstado);

  return {
    cep: data.cep,
    rua: data.logradouro,
    complemento: data.complemento,
    bairro: data.bairro,
    cidade: data.localidade,
    estado: data.uf,
    fonte: "OpenCEP",
    latitude: coords.lat,
    longitude: coords.lng,
  };
}

async function normalizarBrasilApi(data: BrasilApiResponse, numero?: string): Promise<CepNormalizado> {
  const logradouroCompleto = numero ? `${data.street}, ${numero}` : data.street;
  const enderecoCompleto = `${logradouroCompleto}, ${data.city}, ${data.state}, Brasil`;
  const cidadeEstado = `${data.city}, ${data.state}, Brasil`;
  const coords = await buscarCoordenadas(enderecoCompleto, cidadeEstado);

  return {
    cep: data.cep,
    rua: data.street,
    complemento: '',
    bairro: data.neighborhood,
    cidade: data.city,
    estado: data.state,
    fonte: "BrasilAPI",
    latitude: coords.lat,
    longitude: coords.lng,
  };
}

async function buscarViaCep(cep: string, numero?: string): Promise<CepNormalizado> {
  const response = await fetchComTimeout(`https://viacep.com.br/ws/${cep}/json/`);

  if (!response.ok) {
    throw new Error("Erro HTTP ViaCEP");
  }

  const data: ViaCepResponse = await response.json();

  if (data.erro) {
    throw new Error("CEP não encontrado no ViaCEP");
  }

  return await normalizarViaCep(data, numero);
}

async function buscarOpenCep(cep: string, numero?: string): Promise<CepNormalizado> {
  const response = await fetchComTimeout(`https://opencep.com/v1/${cep}`);

  if (!response.ok) {
    throw new Error("Erro HTTP OpenCEP");
  }

  const data: OpenCepResponse = await response.json();

  if (!data.cep) {
    throw new Error("CEP não encontrado no OpenCEP");
  }

  return await normalizarOpenCep(data, numero);
}

async function buscarBrasilApi(cep: string, numero?: string): Promise<CepNormalizado> {
  const response = await fetchComTimeout(`https://brasilapi.com.br/api/cep/v2/${cep}`);

  if (!response.ok) {
    throw new Error("Erro HTTP BrasilAPI");
  }

  const data: BrasilApiResponse = await response.json();

  if (!data.cep) {
    throw new Error("CEP não encontrado na BrasilAPI");
  }

  return await normalizarBrasilApi(data, numero);
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ cep: string }> }
) {
  const { cep } = await context.params;
  const cepLimpo = limparCep(cep);
  // Número do imóvel, quando já conhecido — refina a geocodificação (Nominatim)
  // para o ponto exato do lote em vez de um ponto genérico da rua.
  const numero = request.nextUrl.searchParams.get("numero")?.trim() || undefined;

  if (!validarCep(cepLimpo)) {
    return NextResponse.json(
      { error: "CEP inválido" },
      { status: 400 }
    );
  }

  try {
    const endereco = await buscarViaCep(cepLimpo, numero);
    return NextResponse.json(endereco, { status: 200 });
  } catch (viaCepError: unknown) {
    if (viaCepError instanceof Error) {
      console.warn("ViaCEP falhou:", viaCepError.message);
    }

    try {
      const endereco = await buscarOpenCep(cepLimpo, numero);
      return NextResponse.json(endereco, { status: 200 });
    } catch (openCepError: unknown) {
      if (openCepError instanceof Error) {
        console.warn("OpenCEP falhou:", openCepError.message);
      }

      // Terceiro fallback: BrasilAPI
      try {
        const endereco = await buscarBrasilApi(cepLimpo, numero);
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