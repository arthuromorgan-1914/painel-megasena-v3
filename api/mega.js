// /api/mega.js
export const config = { runtime: 'edge' };

const SOURCES = [
  { url: 'https://servicebus2.caixa.gov.br/portaldeloterias/api/lotteries/megasena/latest', type: 'json' },
  { url: 'https://servicebus2.caixa.gov.br/portaldeloterias/api/resultados?modalidade=megasena', type: 'text' },
  { url: 'https://loteriascaixa-api.herokuapp.com/api/mega-sena/latest', type: 'json' },
];

async function fetchWithTimeout(resource, options = {}) {
  const { timeout = 6000, ...opts } = options;
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort('timeout'), timeout);
  try {
    return await fetch(resource, { ...opts, signal: ctrl.signal, headers: { 'Accept': opts.accept || '*/*' } });
  } finally {
    clearTimeout(id);
  }
}

async function trySources() {
  for (const src of SOURCES) {
    try {
      const res = await fetchWithTimeout(src.url, { timeout: 6000, accept: src.type === 'json' ? 'application/json' : 'text/html', cache: 'no-store' });
      if (!res.ok) continue;

      if (src.type === 'json') {
        const d = await res.json();
        const numero   = Number(d.numero || d.numeroConcurso);
        const dezenas  = d.dezenasSorteadasOrdemSorteio || d.listaDezenas || d.dezenas || [];
        const dataApur = d.dataApuracao || d.data || d.dataProximoConcurso; // melhor esforço
        if (numero && dezenas.length) return { ok: true, numero, dezenas: dezenas.map(x => String(x).padStart(2,'0')), dataApuracao: dataApur };
      } else {
        const t = await res.text();
        const numMatch = t.match(/Concurso\\s*(\\d{3,5})/i);
        const dezenasMatch = t.match(/(\\d{2})[ ,;-]+(\\d{2})[ ,;-]+(\\d{2})[ ,;-]+(\\d{2})[ ,;-]+(\\d{2})[ ,;-]+(\\d{2})/);
        if (numMatch && dezenasMatch) {
          const numero  = Number(numMatch[1]);
          const dezenas = dezenasMatch.slice(1,7);
          return { ok: true, numero, dezenas, dataApuracao: null };
        }
      }
    } catch {
      // tenta a próxima
    }
  }
  return { ok: false };
}

export default async function handler() {
  const r = await trySources();
  return new Response(JSON.stringify(r), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}
