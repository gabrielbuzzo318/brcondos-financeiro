import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const partsDir = path.join(root, 'webparts');
const publicDir = path.join(root, 'public');
const output = path.join(publicDir, 'index.html');

const expected = Array.from({ length: 36 }, (_, i) => `part${String(i).padStart(2, '0')}.txt`);
const missing = expected.filter(name => !fs.existsSync(path.join(partsDir, name)));
if (missing.length) {
  throw new Error(`Frontend incompleto. Faltam: ${missing.join(', ')}`);
}

fs.mkdirSync(publicDir, { recursive: true });
let html = expected.map(name => fs.readFileSync(path.join(partsDir, name), 'utf8')).join('');

const frontendPatches=['webpatch-auth.js','webpatch.js','webpatch-finaliza-historico.js','webpatch-retry-v3.js','webpatch-giss-authoritative-20260826.js','webpatch-giss-pendentes-v1.js','webpatch-sicredi-status.js','webpatch-sicredi-pdf.js','webpatch-apagar-nav.js','webpatch-cnpj.js','webpatch-ui-fixes.js','webpatch-reports-excel.js','webpatch-report-click-guard.js','webpatch-fluxo-money.js','webpatch-brand-logo.js','webpatch-dashboard-nav.js','webpatch-supplier-autofill.js','webpatch-dre-accounts.js','webpatch-filter-persistence.js'];

for (const patchName of frontendPatches) {
  const patchPath = path.join(root, patchName);
  if (!fs.existsSync(patchPath)) continue;
  let patch = fs.readFileSync(patchPath, 'utf8').trim();
  if (patchName === 'webpatch.js') {
    patch = patch.replace('/api/nfse/consultar-rps?numero=', '/api/nfse/consultar-rps-historico?numero=');
  }
  const marker = html.lastIndexOf('</script>');
  if (marker < 0) throw new Error(`Não encontrei </script> para aplicar ${patchName}.`);
  html = `${html.slice(0, marker)}\n${patch}\n${html.slice(marker)}`;
}

fs.writeFileSync(output, html, 'utf8');

const loginSource = path.join(root, 'login.html');
if (!fs.existsSync(loginSource)) throw new Error('Tela de login não encontrada.');
let loginHtml = fs.readFileSync(loginSource, 'utf8');
loginHtml = loginHtml.replace('</head>', '<style>.login-links{display:none!important}</style>\n</head>');

for(const patchName of ['webpatch-brand-logo.js','webpatch-dashboard-nav.js']){
  const patchPath=path.join(root,patchName);
  if(!fs.existsSync(patchPath))continue;
  const patch=fs.readFileSync(patchPath,'utf8').trim();
  loginHtml=loginHtml.replace('</body>',`<script>\n${patch}\n</script>\n</body>`);
}

fs.writeFileSync(path.join(publicDir, 'login.html'), loginHtml, 'utf8');

if (!html.includes('<!DOCTYPE html>') || !html.includes('</html>')) {
  throw new Error('HTML remontado parece inválido.');
}

console.log(`Frontend BRCONDOS montado: ${html.length} caracteres.`);
console.log('Tela pública de login publicada.');
