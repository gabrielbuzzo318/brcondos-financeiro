import 'dotenv/config';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import forge from 'node-forge';

const text = (name, fallback = '') => String(process.env[name] ?? fallback).trim();
const digits = (name, fallback = '') => text(name, fallback).replace(/\D/g, '');

let certPfxPath = text('GISS_CERT_PFX_PATH');
const certPassword = text('GISS_CERT_PASSWORD');

const certPemBase64 = text('GISS_CERT_PEM_BASE64');
const keyPemBase64 = text('GISS_KEY_PEM_BASE64');

if (!certPfxPath && certPemBase64 && keyPemBase64) {
  certPfxPath = path.join(os.tmpdir(), 'brcondos-giss-cert.pfx');
  try {
    const certPem = Buffer.from(certPemBase64, 'base64').toString('utf8');
    const keyPem = Buffer.from(keyPemBase64, 'base64').toString('utf8');
    const cert = forge.pki.certificateFromPem(certPem);
    const key = forge.pki.privateKeyFromPem(keyPem);
    const p12Asn1 = forge.pkcs12.toPkcs12Asn1(key, [cert], certPassword, {
      algorithm: '3des',
      friendlyName: 'BRCONDOS GISS A1'
    });
    const der = forge.asn1.toDer(p12Asn1).getBytes();
    fs.writeFileSync(certPfxPath, Buffer.from(der, 'binary'), { mode: 0o600 });
  } catch (err) {
    console.error('Falha ao reconstruir certificado GISS:', err.message);
    certPfxPath = '';
  }
}

const certPfxBase64Parts = Array.from({ length: 8 }, (_, i) => i + 1)
  .map(i => text(`GISS_CERT_PFX_BASE64_${i}`))
  .filter(Boolean)
  .join('');
const certPfxBase64 = certPfxBase64Parts || text('GISS_CERT_PFX_BASE64');

if (!certPfxPath && certPfxBase64) {
  certPfxPath = path.join(os.tmpdir(), 'brcondos-giss-cert.pfx');
  try {
    fs.writeFileSync(certPfxPath, Buffer.from(certPfxBase64, 'base64'), { mode: 0o600 });
  } catch (err) {
    console.error('Falha ao preparar certificado GISS:', err.message);
  }
}

export const config = {
  giss: {
    env: text('GISS_ENV', 'homologacao'),
    versao: text('GISS_VERSAO', '2.04'),
    wsdlUrl: text('GISS_WSDL_URL'),
    serviceUrl: text('GISS_SERVICE_URL'),
    cnpj: digits('GISS_CNPJ'),
    inscricaoMunicipal: text('GISS_INSCRICAO_MUNICIPAL'),
    certPfxPath,
    certPassword,
    serieRps: text('GISS_SERIE_RPS', 'RPS'),
    itemListaServico: text('GISS_ITEM_LISTA_SERVICO'),
    codigoTributacaoMunicipio: text('GISS_CODIGO_TRIBUTACAO_MUNICIPIO'),
    codigoNbs: text('GISS_CODIGO_NBS'),
    codigoMunicipio: digits('GISS_CODIGO_MUNICIPIO'),
    exigibilidadeIss: text('GISS_EXIGIBILIDADE_ISS', '1'),
    optanteSimples: text('GISS_OPTANTE_SIMPLES', '1'),
    incentivoFiscal: text('GISS_INCENTIVO_FISCAL', '2'),
    discriminacaoPadrao: text('GISS_DISCRIMINACAO_PADRAO', 'Administração de Condomínios.'),
    indicadorOperacao: digits('GISS_INDOP'),
    cstIbsCbs: digits('GISS_CST_IBSCBS'),
    classificacaoTributaria: digits('GISS_CLASS_TRIB_IBSCBS'),
    localidadeIncidencia: digits('GISS_LOCALIDADE_INCIDENCIA')
  }
};
