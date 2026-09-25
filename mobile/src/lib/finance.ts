export type FinanceData = {
  payables: any[];
  transactions: any[];
  boletos: any[];
  receipts: any[];
  manualInadimplencias: any[];
  clients: any[];
  storage: Record<string, any>;
};

function parseValue(value: any, fallback: any = []) {
  if (value == null) return fallback;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

export function parseSharedState(shared: any): FinanceData {
  const storage = shared?.data?.storage || {};
  return {
    payables: parseValue(storage.brcondos_payables, []),
    transactions: parseValue(storage.brcondos_transactions, []),
    boletos: parseValue(storage.brcondos_boletos, []),
    receipts: parseValue(storage.brcondos_receipts, []),
    manualInadimplencias: parseValue(storage.brcondos_inadimplencias_manual, []),
    clients: parseValue(storage.brcondos_clients, []),
    storage,
  };
}

const num = (v: any) => Number(v || 0) || 0;
const today = () => new Date().toISOString().slice(0, 10);
const month = () => today().slice(0, 7);
const status = (v: any) => String(v || '').toLowerCase();

export function dashboardKpis(data: FinanceData) {
  const openPayables = data.payables.filter(p => !['pago', 'recebido', 'cancelado'].includes(status(p.status)));
  const openBoletos = data.boletos.filter(b => !['recebido', 'liquidado', 'pago', 'baixado'].includes(status(b.status)));
  const receivedMonth = data.transactions
    .filter(t => t.type === 'entrada' && String(t.date || '').startsWith(month()))
    .reduce((s, t) => s + num(t.value), 0);

  const overdueBoletos = openBoletos.filter(b => b.due && String(b.due) < today());
  const overdueManual = data.manualInadimplencias.filter(x => !['liquidado', 'pago', 'baixado', 'resolvida'].includes(status(x.status)));
  const inadValue = [...overdueBoletos, ...overdueManual].reduce((s, x) => s + num(x.value), 0);

  return {
    receivable: openBoletos.reduce((s, x) => s + num(x.value), 0),
    payable: openPayables.reduce((s, x) => s + num(x.value), 0),
    receivedMonth,
    inadimplencia: inadValue,
    overdueCount: overdueBoletos.length + overdueManual.length,
  };
}

export function money(v: any) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
