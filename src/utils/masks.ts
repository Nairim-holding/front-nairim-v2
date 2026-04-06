// CPF: 000.000.000-00
export function maskCPF(value: string): string {
  const n = value.replace(/\D/g, '');
  if (n.length <= 3) return n;
  if (n.length <= 6) return `${n.slice(0, 3)}.${n.slice(3)}`;
  if (n.length <= 9) return `${n.slice(0, 3)}.${n.slice(3, 6)}.${n.slice(6)}`;
  return `${n.slice(0, 3)}.${n.slice(3, 6)}.${n.slice(6, 9)}-${n.slice(9, 11)}`;
}

// CNPJ: 00.000.000/0000-00
export function maskCNPJ(value: string): string {
  const n = value.replace(/\D/g, '');
  if (n.length <= 2) return n;
  if (n.length <= 5) return `${n.slice(0, 2)}.${n.slice(2)}`;
  if (n.length <= 8) return `${n.slice(0, 2)}.${n.slice(2, 5)}.${n.slice(5)}`;
  if (n.length <= 12) return `${n.slice(0, 2)}.${n.slice(2, 5)}.${n.slice(5, 8)}/${n.slice(8)}`;
  return `${n.slice(0, 2)}.${n.slice(2, 5)}.${n.slice(5, 8)}/${n.slice(8, 12)}-${n.slice(12, 14)}`;
}

// CEP: 00000-000
export function maskCEP(value: string): string {
  const n = value.replace(/\D/g, '');
  return n.length <= 5 ? n : `${n.slice(0, 5)}-${n.slice(5, 8)}`;
}

// Telefone: (00) 00000-0000 ou (00) 0000-0000
export function maskPhone(value: string): string {
  const n = value.replace(/\D/g, '');
  if (n.length <= 2) return n;
  if (n.length <= 6) return `(${n.slice(0, 2)}) ${n.slice(2)}`;
  if (n.length <= 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6, 10)}`;
  return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7, 11)}`;
}

// Moeda: R$ 0,00
export function maskMoney(value: string | number): string {
  if (typeof value === 'number') {
    const cents = Math.round(parseFloat(value.toFixed(2)) * 100);
    return maskMoney(String(cents));
  }
  const numbers = value.replace(/\D/g, '');
  if (!numbers) return 'R$ 0,00';
  const floatValue = parseFloat(numbers) / 100;
  return floatValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}


// Metros quadrados: 0,00 m²
export function maskSquareMeters(value: string): string {
  const numbers = value.replace(/\D/g, '');
  const floatValue = parseFloat(numbers) / 100;
  return `${floatValue.toFixed(2).replace('.', ',')} m²`;
}
