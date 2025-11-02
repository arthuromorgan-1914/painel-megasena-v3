// api/mega.js — Node runtime com diagnóstico
// Tenta 3 fontes (2 JSON + 1 HTML) e expõe relatório de debug opcional (?debug=1)

const SOURCES = [
  {
    name: 'CAIXA JSON',
    url: 'https://servicebus2.caixa.gov.br/portaldeloterias/api/lotteries/megasena/latest',
    type: 'json',
    parse: (d) => {
      const numero  = Number(d.numero || d.numeroConcurso);
      const dezenas = d.dezenasSorteadasOrdemSorteio || d.listaDezenas || d.dezenas || [];
      const data    = d.dataApuracao || d.data || null;
      if (numero && dezenas.length) {
        return { numero, dezenas: dezenas.map(x => String(x).padStart(2,'0')), dataApuracao: data };
      }
      return null;
    }
  },
  {
    name: 'Heroku Mirror',
    url: 'https://loteriascaixa-api.herokuapp.com/api/mega-sena/latest',
    type: 'json',
    parse: (d) => {
      const numero  = Number(d.numero || d.numeroConcurso);
      const dezenas = d.dezenasSorteadasOrdemSorteio || d.listaDezenas || d.dezenas || [];
      const data    = d.dataApuracao || d.data || null;
      if (numero && dezenas.length) {
        return { numero, dezenas: dezenas.map(x => String(x).padStart(2,'0')), dataApuracao: data };
      }
      return null;
    }
  },
  {
    name: 'CAIXA HTML',
    url: 'https://loterias.caixa.gov.br/Paginas/Mega-Sena.aspx',
    type: 'text',
    parse: (t) => {
      // melhor-esforço: procura "Concurso 29xx" + 6 dezenas com 2 dígitos
      const num = t.match(/Concurso\s*(\d{3,5})/i);
      const dzs = t.match(/(\d{2})[^0-9]+(\d{2})[^0-9]+(\d{2})[^0-9]+(\d{2})[^0-9]+(\d{2})[^0-9]+(\d{2})/);
      if (num && dzs) {
        const numero = Number(num[1]);
        const dezenas = dzs.slice(1,7);
        return { numero, dezenas, dataApuracao: null };
      }
      return null;
    }
  }
];

async function fetchWithTimeout(resource, { timeout = 8000, headers = {} } = {}) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort('timeout'), timeout);
  try {
    return await fetch(resource, {
      method: 'GET',
      headers: {
        'Accept': headers.accept || '*/*',
        'User-Agent': 'Mozilla/5.0 (compatible; painel-megasena; +vercel)',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
        'Referer': 'https://loterias.caixa.gov.br/',
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
  const trace = [];
  for (const s of SOURCES) {
    const step = { source: s.name, url: s.url, ok: false };
    try {
      const res = await fetchWithTimeout(s.url, { timeout: 8000, headers: { accept: s.type === 'json' ? 'application/json' : 'text/html' } });
      step.http = { status: res.status, statusText: res.statusText };
      if (!res.ok) { trace.push(step); continue; }

      const body = (s.type === 'json') ? await res.json() : await res.text();
      const parsed = s.parse(body);
      if (parsed) {
        step.ok = true;
        step.parsed = { numero: parsed.numero, dezenasCount: parsed.dezenas?.length || 0 };
        trace.push(step);
        return { ok: true, ...parsed, fonte: s.name, _trace: trace };
      } else {
        step.parseError = true;
        trace.push(step);
      }
    } catch (e) {
      step.error = String(e && e.message ? e.message : e);
      trace.push(step);
    }
  }
  return { ok: false, error: 'Todas as fontes falharam.', _trace: trace };
}

export default async function handler(req, res) {
  try {
    const result = await trySources();
    // debug opcional: ?debug=1 devolve o trace
    const wantDebug = (req.query && (req.query.debug === '1' || req.query.debug === 'true'));
    const payload = wantDebug ? result : (() => {
      const { _trace, ...rest } = result;
      return rest;
    })();

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(payload);
  } catch (e) {
    res.status(200).json({ ok: false, error: String(e) });
  }
}
