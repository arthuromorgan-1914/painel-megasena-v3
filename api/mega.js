// api/mega.js  (Serverless Function - Node runtime)
const SOURCES = [
  { url: 'https://servicebus2.caixa.gov.br/portaldeloterias/api/lotteries/megasena/latest', type: 'json' },
  { url: 'https://servicebus2.caixa.gov.br/portaldeloterias/api/resultados?modalidade=megasena', type: 'text' },
  { url: 'https://loteriascaixa-api.herokuapp.com/api/mega-sena/latest', type: 'json' },
];

async function fetchWithTimeout(resource, { timeout = 6000, headers = {} } = {}) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort('timeout'), timeout);
  try {
    return await fetch(resource, {
      method: 'GET',
      headers: {
        'Accept': headers.accept || '*/*',
        'User-Agent': 'Mozilla/5.0 (compatible; painel-megasena; +vercel)',
        ...headers,
      },
      signal: ctrl.signal,
      cache: 'no-store',
    });
  } finally {
    clearTimeout(id);
  }
}

async function trySources() {
  for (const s of SOURCES) {
    try {
      const res = await fetchWithTimeout(s.url, { timeout: 7000, headers: { accept: s.type === 'json' ? 'application/json' : 'text/html' } });
      if (!res.ok) continue;

      if (s.type === 'json') {
        const d = await res.json();
        const numero   = Number(d.numero || d.numeroConcurso);
        const dezenas  = d.dezenasSorteadasOrdemSorteio || d.listaDezenas || d.dezenas || [];
        const dataApur = d.dataApuracao || d.data || null;
        if (numero && dezenas.length) {
          return { ok: true, numero, dezenas: dezenas.map(x => String(x).padStart(2,'0')), dataApuracao: dataApur, fonte: s.url };
        }
      } else {
        const t = await res.text();
        const numMatch = t.match(/Concurso\s*(\d{3,5})/i);
        const dezenasMatch = t.match(/(\d{2})[ ,;-]+(\d{2})[ ,;-]+(\d{2})[ ,;-]+(\d{2})[ ,;-]+(\d{2})[ ,;-]+(\d{2})/);
        if (numMatch && dezenasMatch) {
          const numero  = Number(numMatch[1]);
          const dezenas = dezenasMatch.slice(1,7);
          return { ok: true, numero, dezenas, dataApuracao: null, fonte: s.url };
        }
      }
    } catch (e) {
      // tenta a próxima
      continue;
    }
  }
  return { ok: false, error: 'Todas as fontes falharam.' };
}

export default async function handler(req, res) {
  try {
    const r = await trySources();
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(r);
  } catch (e) {
    res.status(200).json({ ok: false, error: String(e) });
  }
}
