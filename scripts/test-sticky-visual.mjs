/** Reproduz o cenário do usuário: rola parcialmente e tira screenshots. */
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';

async function main() {
  const browser = await chromium.launch();
  // viewport baixo p/ forçar scroll vertical + dark mode (cenário do usuário)
  const page = await browser.newPage({ viewport: { width: 1920, height: 480 } });
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => document.body.classList.add('dark'));
  });

  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[type="email"], input[name="email"], input[placeholder*="mail" i]', 'teste2@gmail.com');
  await page.fill('input[type="password"]', '123456');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard**', { timeout: 20000 });

  await page.goto(`${BASE}/dashboard/planejamento`, { waitUntil: 'networkidle' });
  await page.waitForSelector('th:has-text("Categorias e Subcategorias")', { timeout: 20000 });
  await page.waitForTimeout(1500);

  const info = await page.evaluate(() => {
    const containers = [...document.querySelectorAll('div')].filter(d => {
      const s = getComputedStyle(d);
      return (s.overflowY === 'auto' || s.overflow === 'auto') && d.scrollHeight > d.clientHeight + 10;
    });
    const c = containers[0];
    const table = document.querySelector('table');
    const orangeRow = [...document.querySelectorAll('tbody tr')].find(tr => tr.style.backgroundColor);
    return {
      hasScroll: !!c,
      containerH: c?.clientHeight,
      scrollH: c?.scrollHeight,
      tableH: table?.getBoundingClientRect().height,
      orangeRowH: orangeRow?.getBoundingClientRect().height,
      tbodyRows: document.querySelectorAll('tbody tr').length,
    };
  });
  console.log('INFO:', JSON.stringify(info));

  // rola em passos e tira screenshot em cada posição
  for (const frac of [0.3, 0.6, 1]) {
    await page.evaluate((f) => {
      const containers = [...document.querySelectorAll('div')].filter(d => {
        const s = getComputedStyle(d);
        return (s.overflowY === 'auto' || s.overflow === 'auto') && d.scrollHeight > d.clientHeight + 10;
      });
      const c = containers[0];
      if (c) c.scrollTop = (c.scrollHeight - c.clientHeight) * f;
    }, frac);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `c:/Users/Marcio/Desktop/front-nairim-v2/scripts/visual-${Math.round(frac * 100)}.png` });
  }

  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
