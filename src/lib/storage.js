// src/lib/storage.js
const K_JOGOS = 'ms_jogos_por_concurso'   // { [numeroConcurso]: [ [6 dezenas], ... ] }
const K_HIST  = 'ms_historico'            // [ { concurso, data, jogos, mediaAcertos, desempenho }, ... ]
const K_MANUAL = 'ms_resultado_manual'    // { numero, dataApuracao, dezenas }

function read(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback }
  catch { return fallback }
}
function write(key, value) { localStorage.setItem(key, JSON.stringify(value)) }

export function getJogos(concurso) {
  const all = read(K_JOGOS, {})
  return all[String(concurso)] || []
}
export function saveJogos(concurso, jogos) {
  const all = read(K_JOGOS, {})
  all[String(concurso)] = jogos
  write(K_JOGOS, all)
}

export function getHistorico() {
  return read(K_HIST, [])
}
export function upsertHistorico(entry) {
  const hist = read(K_HIST, [])
  const idx = hist.findIndex(h => h.concurso === entry.concurso)
  if (idx >= 0) hist[idx] = entry
  else hist.push(entry)
  write(K_HIST, hist.slice(-10))
}

// Resultado manual (local)
export function getManualResult() {
  return read(K_MANUAL, null)
}
export function saveManualResult(obj) {
  // espera { numero, dataApuracao, dezenas: ["00","00","00","00","00","00"] }
  write(K_MANUAL, obj)
}
export function clearManualResult() {
  localStorage.removeItem(K_MANUAL)
}
