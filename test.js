/*
 * Test suite for DataForma — static file server + HTML validation
 * Run: node test.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const TEST_PORT = 4601;
const BASE = `http://127.0.0.1:${TEST_PORT}`;

let server;
let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) {
    console.log(`  ✓ ${msg}`);
    passed++;
  } else {
    console.error(`  ✗ ${msg}`);
    failed++;
  }
}

async function fetchText(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    }).on('error', reject);
  });
}

async function runTests() {
  console.log('\n📋 DataForma Test Suite\n');
  console.log('═'.repeat(50));

  // Start server on test port
  console.log('\n▶ Avvio server di test...');
  process.env.PORT = TEST_PORT;
  // Clear require cache to pick up new PORT
  delete require.cache[require.resolve('./server.js')];
  server = require('./server.js');
  await new Promise(r => setTimeout(r, 500)); // wait for server

  try {
    // ── 1. Basic HTTP ──
    console.log('\n── Test HTTP di base ──');

    const indexRes = await fetchText(`${BASE}/`);
    assert(indexRes.status === 200, `GET / → 200 OK`);
    assert(indexRes.headers['content-type'].includes('text/html'), `GET / → Content-Type: text/html`);

    const robotsRes = await fetchText(`${BASE}/robots.txt`);
    assert(robotsRes.status === 200, `GET /robots.txt → 200 OK`);
    assert(robotsRes.body.includes('Sitemap:'), `robots.txt contiene Sitemap:`);

    const sitemapRes = await fetchText(`${BASE}/sitemap.xml`);
    assert(sitemapRes.status === 200, `GET /sitemap.xml → 200 OK`);
    assert(sitemapRes.body.includes('https://cristianporco.it/app/dataforma/'), `sitemap.xml contiene URL canonico`);

    const notFoundRes = await fetchText(`${BASE}/inesistente`);
    assert(notFoundRes.status === 404, `GET /inesistente → 404`);

    // ── 2. HTML structure ──
    console.log('\n── Test struttura HTML ──');
    const html = indexRes.body;

    assert(html.includes('<!DOCTYPE html>'), 'DOCTYPE presente');
    assert(html.includes('<html lang="it">'), 'lang="it"');
    assert(html.includes('<meta name="viewport"'), 'viewport meta');
    assert((html.match(/<title>/g) || []).length === 1, 'Esattamente un <title>');
    assert(html.includes('<title>DataForma'), 'Title contiene DataForma');
    assert((html.match(/<meta name="description"/g) || []).length >= 1, 'Meta description presente');

    // ── 3. SEO elements ──
    console.log('\n── Test elementi SEO ──');

    assert(html.includes('<link rel="canonical"'), 'Canonical link presente');
    assert(html.includes('cristianporco.it/app/dataforma/'), 'URL canonico corretto');
    assert(html.includes('og:title'), 'OG title presente');
    assert(html.includes('og:description'), 'OG description presente');
    assert(html.includes('og:type'), 'OG type presente');
    assert(html.includes('og:url'), 'OG url presente');
    assert(html.includes('application/ld+json'), 'JSON-LD presente');
    assert(html.includes('WebApplication'), 'JSON-LD tipo WebApplication');

    // ── 4. Semantic HTML ──
    console.log('\n── Test HTML semantico ──');

    assert((html.match(/<h1>/g) || []).length === 1, 'Esattamente un <h1>');
    assert(html.includes('<header'), 'Elemento <header>');
    assert(html.includes('<main'), 'Elemento <main>');
    assert(html.includes('<footer'), 'Elemento <footer>');
    assert(html.includes('<label for="ruleInput"'), 'Label per input regola');

    // ── 5. Accessibility ──
    console.log('\n── Test accessibilità ──');

    assert(html.includes('aria-live="polite"'), 'aria-live sulla preview');
    assert(html.includes('aria-label'), 'aria-label presenti');
    assert(html.includes('aria-expanded'), 'aria-expanded presenti');
    assert(html.includes('prefers-reduced-motion'), 'Supporto prefers-reduced-motion');

    // ── 6. Vue app ──
    console.log('\n── Test Vue.js ──');

    assert(html.includes('unpkg.com/vue@3'), 'Vue 3 CDN');
    assert(html.includes('createApp'), 'Vue createApp presente');
    assert(html.includes('id="app"'), 'Mount point #app');
    assert(html.includes('v-model="rule"'), 'v-model per rule input');

    // ── 7. Token system ──
    console.log('\n── Test sistema token ──');

    assert(html.includes("'gg'"), 'Token gg definito');
    assert(html.includes("'mm'"), 'Token mm definito');
    assert(html.includes("'aaaa'"), 'Token aaaa definito');
    assert(html.includes("'hh'"), 'Token hh definito');
    assert(html.includes("'min'"), 'Token min definito');
    assert(html.includes("'ss'"), 'Token ss definito');
    assert(html.includes("'mese'"), 'Token mese definito');
    assert(html.includes("'nome_giorno'"), 'Token nome_giorno definito');
    assert(html.includes('tokenize'), 'Funzione tokenize presente');

    // ── 8. Features ──
    console.log('\n── Test funzionalità ──');

    assert(html.includes('copyFormat'), 'Funzione copyFormat presente');
    assert(html.includes('selectPreset'), 'Funzione selectPreset presente');
    assert(html.includes('selectDate'), 'Funzione selectDate presente');
    assert(html.includes('calDays'), 'Calendario (calDays) presente');
    assert(html.includes('presets'), 'Presets definiti');
    assert(html.includes("'Italiano'"), 'Preset Italiano');
    assert(html.includes("'ISO 8601'"), 'Preset ISO 8601');
    assert(html.includes("'Americano'"), 'Preset Americano');

    // ── 9. No external APIs ──
    console.log('\n── Test self-contained ──');

    const externalUrls = html.match(/https?:\/\/[^"'\s]*/g) || [];
    const allowed = ['unpkg.com/vue@3', 'schema.org', 'cristianporco.it', 'w3.org'];
    const suspicious = externalUrls.filter(u => !allowed.some(a => u.includes(a)) && !u.includes('sitemaps.org'));
    assert(suspicious.length === 0, `Nessuna chiamata API esterna (trovate: ${suspicious.length})`);

    // ── 10. Sub-path safety ──
    console.log('\n── Test sub-path safety ──');

    // No absolute paths starting with / in href/src (except canonical, OG, JSON-LD)
    const absPaths = html.match(/(?:href|src|action)="\/(?!\/)[^"]*"/g) || [];
    const allowedAbs = absPaths.filter(p => {
      return p.includes('schema.org') || p.includes('cristianporco.it') || p.includes('sitemaps.org');
    });
    const badAbs = absPaths.filter(p => !allowedAbs.includes(p));
    assert(badAbs.length === 0, `Nessun path assoluto non consentito (trovati: ${badAbs.length})`);

  } catch (err) {
    console.error(`\n⚠ Errore nei test: ${err.message}`);
    failed++;
  }

  // ── Summary ──
  console.log('\n' + '═'.repeat(50));
  console.log(`\n📊 RISULTATI: ${passed} passati, ${failed} falliti (${passed + failed} totali)\n`);

  // Cleanup
  server.close();
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
