import fs from 'node:fs';

const file = new URL('./server.js', import.meta.url);
let src = fs.readFileSync(file, 'utf8');

if (!src.includes("from './cnpj-server.js'")) {
  const anchor = "import { config } from './config.js';";
  if (!src.includes(anchor)) throw new Error('PATCH CNPJ: import anchor não encontrado.');
  src = src.replace(anchor, `${anchor}\nimport { consultarCnpjPublico } from './cnpj-server.js';`);
}

if (!src.includes("app.get('/api/cnpj/:cnpj'")) {
  const anchor = "app.post('/api/auth/first-access-complete', requireAuth, route((req, res) => markFirstAccessDone(req, res)));";
  if (!src.includes(anchor)) throw new Error('PATCH CNPJ: auth anchor não encontrado.');
  src = src.replace(anchor, `${anchor}\n\napp.use('/api/cnpj', requireAuth);\napp.get('/api/cnpj/:cnpj', route(req => consultarCnpjPublico(req.params.cnpj)));`);
}

fs.writeFileSync(file, src, 'utf8');
console.log('CNPJ PATCH: proxy autenticado com fallback ativado.');
