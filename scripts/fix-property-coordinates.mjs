// Batch audit/fix for property map pins.
//
// Why this exists: /api/cep/[cep] used to geocode addresses using only
// street + city + state (no house number), so Nominatim would drop the pin
// somewhere generic along the street instead of on the actual lot. That bug
// is fixed for new/edited properties (see src/app/api/cep/[cep]/route.ts),
// but properties saved before the fix can still have an imprecise pin. This
// script re-geocodes every property's stored address (now including the
// house number) and reports/optionally applies corrections.
//
// Usage (run with the DATABASE_URL of the environment you want to fix):
//   node scripts/fix-property-coordinates.mjs                  # dry run, report only
//   node scripts/fix-property-coordinates.mjs --apply           # write corrections
//   node scripts/fix-property-coordinates.mjs --apply --min-distance=100
//
// --min-distance=<meters>  Only update rows whose new pin moved more than
//                           this far from the stored one (default: 50).
//                           Rows with no stored coordinates are always
//                           filled in when --apply is set, regardless of
//                           this threshold.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

const NOMINATIM_DELAY_MS = 1100; // Respeita o limite de 1 req/s do Nominatim.

function parseArgs(argv) {
  const apply = argv.includes('--apply');
  const minDistanceArg = argv.find((a) => a.startsWith('--min-distance='));
  const minDistanceMeters = minDistanceArg ? Number(minDistanceArg.split('=')[1]) : 50;
  return { apply, minDistanceMeters };
}

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const envPath = path.join(PROJECT_ROOT, '.env');
  if (!fs.existsSync(envPath)) {
    throw new Error('DATABASE_URL não definida e .env não encontrado. Defina DATABASE_URL no ambiente antes de rodar o script.');
  }
  const content = fs.readFileSync(envPath, 'utf8');
  const match = content.match(/^DATABASE_URL\s*=\s*"?([^"\n]+)"?\s*$/m);
  if (!match) throw new Error('DATABASE_URL não encontrada no .env.');
  return match[1];
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Distância em metros entre duas coordenadas (fórmula de Haversine).
function distanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function nominatimSearch(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'nairim-fix-property-coordinates/1.0',
      'Accept-Language': 'pt-BR',
      Accept: 'application/json',
    },
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (Array.isArray(data) && data.length > 0) {
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  }
  return null;
}

// Mesma lógica de fallback do endpoint /api/cep: endereço completo (com
// número) primeiro, depois só cidade/estado se o Nominatim não achar nada.
async function geocodeAddress({ street, number, city, state }) {
  const enderecoCompleto = `${street}, ${number}, ${city}, ${state}, Brasil`;
  const cidadeEstado = `${city}, ${state}, Brasil`;

  let coords = await nominatimSearch(enderecoCompleto);
  await sleep(NOMINATIM_DELAY_MS);

  if (!coords) {
    coords = await nominatimSearch(cidadeEstado);
    await sleep(NOMINATIM_DELAY_MS);
  }

  return coords;
}

async function main() {
  const { apply, minDistanceMeters } = parseArgs(process.argv.slice(2));
  const client = new Client({ connectionString: loadDatabaseUrl() });
  await client.connect();

  const { rows } = await client.query(`
    SELECT p.id AS property_id, p.title, c.name AS company_name,
           a.id AS address_id, a.street, a.number, a.district, a.city, a.state,
           a.zip_code, a.latitude, a.longitude
    FROM "Property" p
    JOIN "Company" c ON c.id = p.company_id
    JOIN "PropertyAddress" pa ON pa.property_id = p.id AND pa.deleted_at IS NULL
    JOIN "Address" a ON a.id = pa.address_id AND a.deleted_at IS NULL
    WHERE p.deleted_at IS NULL
    ORDER BY c.name, p.title;
  `);

  console.log(`Modo: ${apply ? 'APLICANDO correções' : 'DRY RUN (nenhuma escrita)'}`);
  console.log(`Limite de distância para atualizar: ${minDistanceMeters}m`);
  console.log(`${rows.length} imóveis com endereço encontrados.\n`);

  let flagged = 0;
  let updated = 0;
  let notFound = 0;

  for (const row of rows) {
    const label = `[${row.company_name}] ${row.title} — ${row.street}, ${row.number}`;
    const coords = await geocodeAddress(row);

    if (!coords) {
      notFound += 1;
      console.log(`? ${label}\n  Não foi possível geocodificar este endereço.\n`);
      continue;
    }

    const hadCoords = row.latitude !== null && row.longitude !== null;
    const distance = hadCoords
      ? distanceMeters(row.latitude, row.longitude, coords.lat, coords.lng)
      : null;

    const shouldFlag = !hadCoords || (distance !== null && distance > minDistanceMeters);
    if (!shouldFlag) continue;

    flagged += 1;
    console.log(`⚠ ${label}`);
    console.log(`  CEP: ${row.zip_code} | Bairro: ${row.district} | Cidade/UF: ${row.city}/${row.state}`);
    if (hadCoords) {
      console.log(`  Atual: ${row.latitude}, ${row.longitude}`);
      console.log(`  Novo:  ${coords.lat}, ${coords.lng}  (moveu ~${Math.round(distance)}m)`);
    } else {
      console.log(`  Atual: sem coordenadas salvas`);
      console.log(`  Novo:  ${coords.lat}, ${coords.lng}`);
    }

    if (apply) {
      await client.query(
        `UPDATE "Address" SET latitude = $1, longitude = $2, updated_at = now() WHERE id = $3`,
        [coords.lat, coords.lng, row.address_id],
      );
      updated += 1;
      console.log('  → Atualizado no banco.');
    }
    console.log('');
  }

  console.log('--- Resumo ---');
  console.log(`Verificados: ${rows.length}`);
  console.log(`Sinalizados (divergência > ${minDistanceMeters}m ou sem coordenadas): ${flagged}`);
  console.log(`Não geocodificados: ${notFound}`);
  if (apply) {
    console.log(`Atualizados no banco: ${updated}`);
  } else {
    console.log('Nenhuma escrita realizada (dry run). Rode novamente com --apply para gravar.');
  }

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
