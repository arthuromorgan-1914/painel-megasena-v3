// src/lib/suggest.js
function rand(seed) {
  // PRNG simples e determinístico (opcional) baseado no concurso
  let s = (seed || 1) % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function pick(arr, n, r) {
  const a = [...arr];
  const out = [];
  while (out.length < n && a.length) {
    const i = Math.floor(r() * a.length);
    out.push(a.splice(i, 1)[0]);
  }
  return out;
}

function asIntStr(n) { return String(n).padStart(2, '0'); }

export function generateSuggestions({ ultimo = [], seed = 1 }) {
  const rng = rand(seed);
  const banned = new Set(ultimo.map(x => Number(x)));

  // Faixas para cobrir amplitude
  const ranges = [
    [1,10], [11,20], [21,30], [31,40], [41,50], [51,60]
  ].map(([a,b]) => Array.from({length:b-a+1}, (_,i)=>a+i).filter(n => !banned.has(n)));

  // objetivo de soma leve (aprox 150–220)
  const sumOk = (arr) => {
    const s = arr.reduce((acc,n)=>acc+n,0);
    return s >= 150 && s <= 220;
  };

  // monta 6 jogos
  const jogos = [];
  while (jogos.length < 6) {
    // 1 de cada metade baixa/alta + pares/ímpares 3–3 (ou 4–2)
    const wantEven = rng() < 0.5 ? 3 : 4;
    const wantOdd  = 6 - wantEven;

    let pool = ranges.flat().filter(Boolean);
    // embaralha determinístico
    pool = pool.sort(() => rng() - 0.5);

    const chosen = [];
    // tenta cobrir faixas
    for (const rArr of ranges) {
      const candidates = rArr.filter(n =>
        (n % 2 === 0 && chosen.filter(x=>x%2===0).length < wantEven) ||
        (n % 2 === 1 && chosen.filter(x=>x%2===1).length < wantOdd)
      );
      if (candidates.length) {
        chosen.push(pick(candidates, 1, rng)[0]);
      }
      if (chosen.length === 6) break;
    }
    // completa faltantes
    while (chosen.length < 6) {
      const n = pick(pool.filter(n =>
        !chosen.includes(n) &&
        ((n % 2 === 0 && chosen.filter(x=>x%2===0).length < wantEven) ||
         (n % 2 === 1 && chosen.filter(x=>x%2===1).length < wantOdd))
      ), 1, rng)[0];
      if (n) chosen.push(n);
      else break;
    }

    const uniq = Array.from(new Set(chosen)).slice(0,6).sort((a,b)=>a-b);
    if (uniq.length === 6 && sumOk(uniq)) {
      const formatted = uniq.map(asIntStr);
      // evita duplicar jogo idêntico
      if (!jogos.some(j => j.join(',') === formatted.join(','))) {
        jogos.push(formatted);
      }
    }
  }
  return jogos;
}
