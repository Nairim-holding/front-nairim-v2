import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { nome, telefone, email, imovelId, imovelTitulo } = body;

    if (!nome || !telefone || !email || !imovelId) {
      return NextResponse.json({ error: "Campos obrigatórios faltando" }, { status: 400 });
    }

    const apiUrl = process.env.NEXT_PUBLIC_URL_API;
    const res = await fetch(`${apiUrl}/leads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, telefone, email, imovelId, imovelTitulo }),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: text || "Erro no backend" }, { status: res.status });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
