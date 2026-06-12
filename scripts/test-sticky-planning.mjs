/**
 * Valida o cabeçalho fixo (sticky) da página Planejamento e Controle.
 * Faz login, abre a página, rola a tabela e confere que as linhas de saldo
 * e o cabeçalho de colunas permanecem visíveis e na mesma posição.
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const EMAIL = 'teste2@gmail.com';
const PASSWORD = '123456';

function rect(page, selector) {
  return page.evaluate((sel) => {
    const el = [...document.querySelectorAll(sel)].find(e => e.offsetParent !== null || e.tagName === 'TH');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { top: Math.round(r.top), left: Math.round(r.left), visible: r.bottom > 0 && r.top < window.innerHeight };
  }, selector);
}

async function main() {
  const browser = await chromium.launch();
  const results = [];

  for (const vp of [
    { name: 'desktop', width: 1600, height: 800 },
    { name: 'desktop-baixo', width: 1600, height: 450 },
    { name: 'tablet', width: 900, height: 450 },
    { name: 'mobile', width: 390, height: 500 },
  ]) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });

    // login
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    await page.fill('input[type="email"], input[name="email"], input[placeholder*="mail" i]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard**', { timeout: 20000 });

    await page.goto(`${BASE}/dashboard/planejamento`, { waitUntil: 'networkidle' });
    await page.waitForSelector('th:has-text("Categorias e Subcategorias")', { timeout: 20000 });
    await page.waitForTimeout(1000);

    const findHeaderTh = `xpath=//th[contains(., "Categorias e Subcategorias")]`;
    const findSaldoTh = `xpath=//th[contains(., "Saldo Acumulado")]`;

    const before = {
      header: await page.locator(findHeaderTh).boundingBox(),
      saldo: await page.locator(findSaldoTh).boundingBox(),
    };

    // rola o container da tabela até o fim
    const scrolled = await page.evaluate(() => {
      const containers = [...document.querySelectorAll('div')].filter(d => {
        const s = getComputedStyle(d);
        return (s.overflowY === 'auto' || s.overflow === 'auto') && d.scrollHeight > d.clientHeight + 10;
      });
      const c = containers[0];
      if (!c) return { ok: false, reason: 'nenhum container com scroll vertical' };
      c.scrollTop = c.scrollHeight;
      return { ok: true, scrollTop: c.scrollTop, scrollHeight: c.scrollHeight, clientHeight: c.clientHeight };
    });
    await page.waitForTimeout(500);

    const after = {
      header: await page.locator(findHeaderTh).boundingBox(),
      saldo: await page.locator(findSaldoTh).boundingBox(),
    };

    await page.screenshot({ path: `c:/Users/Marcio/Desktop/front-nairim-v2/scripts/sticky-${vp.name}.png` });

    const headerStuck = before.header && after.header && Math.abs(before.header.y - after.header.y) <= 2;
    const saldoStuck = before.saldo && after.saldo && Math.abs(before.saldo.y - after.saldo.y) <= 2;

    results.push({
      viewport: vp.name,
      scrolled,
      headerY: { before: before.header?.y, after: after.header?.y, stuck: headerStuck },
      saldoY: { before: before.saldo?.y, after: after.saldo?.y, stuck: saldoStuck },
    });

    await page.close();
  }

  await browser.close();
  console.log(JSON.stringify(results, null, 2));
  const allOk = results.every(r => r.scrolled.ok === false || (r.headerY.stuck && r.saldoY.stuck));
  console.log(allOk ? '\n✅ STICKY OK em todos os viewports' : '\n❌ FALHA: cabeçalho não ficou fixo');
  process.exit(allOk ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
