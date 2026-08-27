import fs from 'node:fs';

const file=new URL('./server.js',import.meta.url);
let src=fs.readFileSync(file,'utf8');

if(!src.includes("from './dre-notes.js'")){
  const anchor="import { config } from './config.js';";
  if(!src.includes(anchor))throw new Error('PATCH DRE NOTES: import anchor não encontrado.');
  src=src.replace(anchor,`${anchor}\nimport { createDreNote, listDreNotes } from './dre-notes.js';`);
}

if(!src.includes("app.get('/api/dre/notes'")){
  const anchor="app.post('/api/auth/first-access-complete', requireAuth, route((req, res) => markFirstAccessDone(req, res)));";
  if(!src.includes(anchor))throw new Error('PATCH DRE NOTES: auth anchor não encontrado.');
  src=src.replace(anchor,`${anchor}\n\napp.get('/api/dre/notes', requireAuth, route(req => listDreNotes(req, req.query.period)));\napp.post('/api/dre/notes', requireAuth, route(req => createDreNote(req, req.body)));`);
}

fs.writeFileSync(file,src,'utf8');
console.log('DRE NOTES PATCH: histórico mensal de anotações ativado.');
