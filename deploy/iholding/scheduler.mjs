import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout } from 'node:timers/promises';

// Recupera a execucao perdida se o container estava parado no dia 5 as 09h.
// A marca em volume persistente impede novas execucoes apos reiniciar.
export function dueMonth(date, lastMonth) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit',
    day: '2-digit', hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).map(part => [part.type, part.value]));
  const month = `${parts.year}-${parts.month}`;
  const due = Number(parts.day) > 5 || (Number(parts.day) === 5 && Number(parts.hour) >= 9);
  return due && lastMonth !== month ? month : null;
}

export async function syncIndexes(secret, request = fetch) {
  const response = await request('http://iholding-front:3000/api/cron/adjustment-indexes', {
    headers: { Authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(300000),
  });
  if (!response.ok) throw new Error(`Sincronizacao recusada: HTTP ${response.status}`);
  const result = await response.json();
  if (!result.ok || !Array.isArray(result.companies) || !result.companies.length || result.companies.some(company => company.error)) {
    throw new Error('Sincronizacao incompleta; sera tentada novamente.');
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.env.CRON_SECRET) throw new Error('Configure CRON_SECRET.');
  const stateFile = '/state/adjustment-indexes-month';
  let lastMonth;
  try {
    lastMonth = (await readFile(stateFile, 'utf8')).trim();
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  console.log('Agendador ativo: indices mensais a partir do dia 5, 09h America/Sao_Paulo.');
  for (;;) {
    const month = dueMonth(new Date(), lastMonth);
    if (month) {
      try {
        await syncIndexes(process.env.CRON_SECRET);
        await writeFile(stateFile, month);
        lastMonth = month;
        console.log(`Indices sincronizados: ${month}`);
      } catch (error) {
        console.error(error.message);
      }
    }
    await setTimeout(60000);
  }
}
