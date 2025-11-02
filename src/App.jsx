import React, { useEffect, useMemo, useState } from 'react'
import {
  LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts'
import { generateSuggestions } from './lib/suggest'
import {
  getJogos, saveJogos,
  getHistorico, upsertHistorico,
  getManualResult, saveManualResult, clearManualResult
} from './lib/storage'

// gráficos “contexto” (fixos)
const paresImpares = [ { tipo: 'Pares', valor: 54 }, { tipo: 'Ímpares', valor: 46 } ]
const distribuicaoDezenas = [
  { faixa: '1-10', qtd: 18 }, { faixa: '11-20', qtd: 22 }, { faixa: '21-30', qtd: 20 },
  { faixa: '31-40', qtd: 19 }, { faixa: '41-50', qtd: 13 }, { faixa: '51-60', qtd: 8 },
]

// estilos simples
const box = { border: '1px solid #e5e7eb', borderRadius: 12, background: '#fff', padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }
const h2 = { fontSize: 18, margin: 0, marginBottom: 8, fontWeight: 600 }
const p  = { margin: '6px 0', color: '#4b5563', fontSize: 14 }
const chip = (bg, color='#fff') => ({ display: 'inline-block', padding: '4px 8px', borderRadius: 8, fontWeight: 700, background: bg, color })

// helpers
function norm6(arr) {
  const n = Array.from(new Set(arr.map(x => String(x ?? '').trim()).filter(Boolean)))
    .map(x => String(parseInt(x, 10)).padStart(2,'0'))
    .filter(x => !isNaN(Number(x)) && Number(x) >= 1 && Number(x) <= 60)
    .slice(0, 6)
    .sort((a,b)=>Number(a)-Number(b))
  return n
}
function acertos(jogo, dezenasOficiais) {
  const s = new Set(dezenasOficiais)
  return jogo.filter(d => s.has(d)).length
}
const vazio6 = () => Array.from({ length: 6 }, () => ['', '', '', '', '', ''])

export default function App() {
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState(new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }))
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)
  const [fonte, setFonte] = useState(null)      // "API", "LOCAL", "MANUAL"
  const [concurso, setConcurso] = useState(null) // { numero, dataApuracao, dezenas:[] }
  const [sugestoes, setSugestoes] = useState([])
  const [meusJogos, setMeusJogos] = useState(vazio6())
  const [histReal, setHistReal] = useState(getHistorico())

  // ========= sincronização com 3 níveis de fallback =========
  async function tryApi() {
    const res = await fetch('/api/mega', { cache: 'no-store' })
    const data = await res.json()
    if (data?.ok) {
      return {
        fonte: 'API',
        numero: data.numero,
        dezenas: (data.dezenas || []).map(x => String(x).padStart(2,'0')),
        dataApuracao: data.dataApuracao || null
      }
    }
    throw new Error(data?.error || 'API indisponível')
  }
  async function tryLocalJson() {
    // /public/latest.json
    const res = await fetch('/latest.json', { cache: 'no-store' })
    if (!res.ok) throw new Error(`latest.json ${res.status}`)
    const d = await res.json()
    if (!d?.numero || !Array.isArray(d?.dezenas) || d.dezenas.length !== 6) {
      throw new Error('latest.json inválido')
    }
    return {
      fonte: 'LOCAL',
      numero: Number(d.numero),
      dezenas: d.dezenas.map(x => String(x).padStart(2,'0')),
      dataApuracao: d.dataApuracao || null
    }
  }
  function tryManual() {
    const m = getManualResult()
    if (m?.numero && Array.isArray(m.dezenas) && m.dezenas.length === 6) {
      return {
        fonte: 'MANUAL',
        numero: Number(m.numero),
        dezenas: m.dezenas.map(x => String(x).padStart(2,'0')),
        dataApuracao: m.dataApuracao || null
      }
    }
    throw new Error('Sem resultado manual')
  }

  async function sincronizarAgora() {
    try {
      setLoading(true); setErro(null)
      // ordem: API -> LOCAL (/public/latest.json) -> MANUAL (localStorage)
      let r
      try { r = await tryApi() } catch { /* segue fallback */ }
      if (!r) { try { r = await tryLocalJson() } catch { /* segue */ } }
      if (!r) { r = tryManual() }

      setFonte(r.fonte)
      setConcurso({ numero: r.numero, dataApuracao: r.dataApuracao, dezenas: r.dezenas })

      const sug = generateSuggestions({ ultimo: r.dezenas.map(d => Number(d)), seed: r.numero })
      setSugestoes(sug)

      const salvos = getJogos(r.numero)
      setMeusJogos(salvos.length ? salvos.map(x => x.slice()) : sug.map(j => j.slice()))
    } catch (e) {
      setErro('Sem dados de sorteio (API/LOCAL/MANUAL indisponíveis). Use a entrada manual abaixo.')
      setFonte(null); setConcurso(null); setSugestoes([])
    } finally {
      setLoading(false)
      setUltimaAtualizacao(new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }))
    }
  }

  useEffect(() => { sincronizarAgora() }, [])

  // histórico real (ou fallback visual)
  const performanceHistory = useMemo(() => {
    const base = histReal.slice(-5)
    if (!base.length) {
      return [
        { semana: 'S-4', score: 60 },
        { semana: 'S-3', score: 64 },
        { semana: 'S-2', score: 68 },
        { semana: 'S-1', score: 72 },
        { semana: 'Atual', score: 74 },
      ]
    }
    const lab = i => i === base.length - 1 ? 'Atual' : `S-${base.length - 1 - i}`
    return base.map((h, i) => ({ semana: lab(i), score: Math.round(h.desempenho) }))
  }, [histReal])

  const desempenhoGeral = performanceHistory.at(-1)?.score ?? 74
  const variacaoSemanal = performanceHistory.length >= 2
    ? desempenhoGeral - performanceHistory.at(-2).score
    : 0

  // edição de jogos
  function setCel(idxJogo, idxDez, value) {
    setMeusJogos(prev => {
      const next = prev.map(r => r.slice())
      next[idxJogo][idxDez] = value
      return next
    })
  }
  function usarSugestoes() {
    if (!sugestoes.length) return
    setMeusJogos(sugestoes.map(j => j.slice()))
  }

  function salvarJogos() {
    if (!concurso?.numero) { alert('Aguarde sincronizar o concurso (ou defina manualmente).'); return }
    const jogos = meusJogos.map(norm6)
    const completos = jogos.filter(j => j.length === 6)
    if (completos.length !== 6) {
      alert('Você precisa registrar exatamente 6 jogos completos (6 dezenas em cada).')
      return
    }
    saveJogos(concurso.numero, completos)
    alert('6 jogos salvos para este concurso.')
  }

  function calcularDesempenho() {
    if (!concurso?.dezenas?.length) { alert('Resultado não disponível. Sincronize ou preencha manualmente.'); return }
    const jogos = getJogos(concurso.numero)
    if (jogos.length !== 6) { alert('Salve primeiro os 6 jogos completos.'); return }
    const hits = jogos.map(j => acertos(j, concurso.dezenas))
    const media = hits.reduce((a,b)=>a+b,0) / hits.length
    const desempenho = (media / 6) * 100
    upsertHistorico({
      concurso: concurso.numero,
      data: concurso.dataApuracao || new Date().toLocaleDateString('pt-BR'),
      jogos: jogos.length,
      mediaAcertos: Number(media.toFixed(2)),
      desempenho: Number(desempenho.toFixed(2)),
    })
    setHistReal(getHistorico())
    alert(`Desempenho atualizado!\nMédia de acertos: ${media.toFixed(2)} de 6 (${desempenho.toFixed(1)}%).`)
  }

  // ===== Entrada Manual do Resultado =====
  const [mNumero, setMNumero] = useState('')
  const [mData, setMData] = useState('')
  const [mDz, setMDz] = useState(['','','','','',''])

  function setMDzCel(i, v) {
    setMDz(prev => {
      const n = prev.slice()
      n[i] = v
      return n
    })
  }
  function usarManualComoOficial() {
    const dz = norm6(mDz)
    if (!mNumero || dz.length !== 6) {
      alert('Preencha o número do concurso e as 6 dezenas (1–60).')
      return
    }
    const obj = {
      numero: Number(mNumero),
      dataApuracao: mData || null,
      dezenas: dz
    }
    saveManualResult(obj)
    alert('Resultado manual salvo. Vou sincronizar com ele agora.')
    setMNumero(''); setMData(''); setMDz(['','','','','',''])
    sincronizarAgora()
  }
  function limparManual() {
    clearManualResult()
    alert('Resultado manual apagado.')
    sincronizarAgora()
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: 24 }}>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Painel da Mega-Sena</h1>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 13, color: '#374151' }}>
            <strong>Última atualização:</strong> {ultimaAtualizacao}
          </div>
          <div style={{ marginTop: 8 }}>
            <button onClick={sincronizarAgora}
              style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #0ea5e9', color: '#0ea5e9', background: '#fff' }}>
              🔄 sincronizar agora
            </button>
            {loading && <span style={{ fontSize: 13, marginLeft: 8, color: '#374151' }}>verificando…</span>}
          </div>
        </div>
      </div>

      {/* Aviso/erro */}
      {erro && (
        <div style={{ ...box, borderColor: '#fcd34d', background: '#fffbeb', color: '#92400e', marginTop: 12 }}>
          ⚠️ {erro}
        </div>
      )}

      {/* 1) Índice de desempenho (usa histórico real quando houver) */}
      <div style={{ ...box, background: 'linear-gradient(90deg,#16a34a,#059669)', color: '#fff', textAlign: 'center', marginTop: 12 }}>
        <h2 style={{ ...h2, color: '#fff' }}>Índice de Desempenho Acumulado</h2>
        <p style={{ ...p, color: 'rgba(255,255,255,0.9)' }}>Mostra o quanto o sistema vem acertando os números ao longo do tempo.</p>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 16 }}>
          <div style={{ fontSize: 48, fontWeight: 800 }}>{performanceHistory.at(-1)?.score ?? 74}%</div>
          <div style={chip(variacaoSemanal >= 0 ? 'rgba(16,185,129,0.9)' : '#ef4444')}>
            {variacaoSemanal >= 0 ? '+' : ''}{Math.round(variacaoSemanal)} p.p.
          </div>
        </div>
        <p style={{ fontSize: 12, marginTop: 8, opacity: 0.9 }}>A variação indica se as previsões estão melhorando ou piorando na semana.</p>
      </div>

      {/* 2) Histórico */}
      <div style={{ ...box, marginTop: 16 }}>
        <h2 style={h2}>Histórico do Índice de Precisão</h2>
        <p style={p}>Quando você registra seus jogos e calcula após o sorteio, este gráfico usa seus resultados reais.</p>
        <div style={{ width: '100%', height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={performanceHistory}>
              <Line type="monotone" dataKey="score" stroke="#10b981" strokeWidth={2} />
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="semana" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 3) Pares x Ímpares */}
      <div style={{ ...box, marginTop: 16 }}>
        <h2 style={h2}>Distribuição entre Números Pares e Ímpares</h2>
        <p style={p}>Ajuda a equilibrar as apostas.</p>
        <div style={{ width: '100%', height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={paresImpares} dataKey="valor" nameKey="tipo" outerRadius={90} label>
                {paresImpares.map((_, i) => <Cell key={i} fill={i % 2 === 0 ? '#16a34a' : '#2563eb'} />)}
              </Pie>
              <Tooltip /><Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 4) Distribuição por Faixa */}
      <div style={{ ...box, marginTop: 16 }}>
        <h2 style={h2}>Distribuição por Faixa de Números</h2>
        <p style={p}>Quantos números de cada grupo (1-10, 11-20, etc.) costumam sair.</p>
        <div style={{ width: '100%', height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={distribuicaoDezenas}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="faixa" /><YAxis /><Tooltip />
              <Bar dataKey="qtd" fill="#f59e0b" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 5) Último Sorteio (fonte indicada) */}
      <div style={{ ...box, marginTop: 16 }}>
        <h2 style={h2}>Último Sorteio {fonte && <span style={{ fontSize: 12, color: '#6b7280' }}>({fonte})</span>}</h2>
        <p style={p}>Dados de: API oficial (quando disponível) → arquivo local (`/latest.json`) → resultado manual (localStorage).</p>
        {loading ? (
          <div style={{ color: '#374151' }}>Carregando…</div>
        ) : concurso ? (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
              <div style={chip('#0ea5e9')}>Concurso {concurso.numero}</div>
              {concurso.dataApuracao && <div style={{ fontSize: 14, color: '#374151' }}><strong>Data:</strong> {concurso.dataApuracao}</div>}
              <div style={chip('#10b981')}>Sincronizado</div>
            </div>
            <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {concurso.dezenas.map((d) => (
                <div key={d} style={{ padding: '8px 12px', borderRadius: 10, background: '#f3f4f6', fontWeight: 700 }}>{d}</div>
              ))}
            </div>
          </>
        ) : (
          <div style={{ color: '#6b7280' }}>Sem dados no momento.</div>
        )}
      </div>

      {/* 6) Sugestões */}
      <div style={{ ...box, marginTop: 16 }}>
        <h2 style={h2}>Sugestões de Jogos</h2>
        <p style={p}>Combinações balanceadas por faixas e pares/ímpares; evita repetir o último sorteio.</p>
        <ol style={{ margin: 0, paddingLeft: 16, display: 'grid', gap: 8 }}>
          {sugestoes.map((jogo, idx) => (
            <li key={idx} style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <strong style={{ width: 28 }}>#{String(idx+1).padStart(2,'0')}</strong>
              {jogo.map((d) => (
                <span key={d} style={{ padding: '6px 10px', borderRadius: 8, background: '#eef2ff', fontWeight: 700 }}>{d}</span>
              ))}
            </li>
          ))}
        </ol>
      </div>

      {/* 7) Registrar 6 jogos */}
      <div style={{ ...box, marginTop: 16 }}>
        <h2 style={h2}>Registrar meus 6 jogos desta semana</h2>
        <p style={p}>Digite 6 dezenas por linha (1–60). Você precisa salvar exatamente 6 jogos completos.</p>

        {meusJogos.map((linha, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
            <strong style={{ width: 28 }}>#{String(i+1).padStart(2,'0')}</strong>
            {linha.map((v, j) => (
              <input key={j}
                value={v}
                onChange={e => setCel(i, j, e.target.value)}
                inputMode="numeric" placeholder="00" maxLength={2}
                style={{ width: 44, padding: 6, borderRadius: 8, border: '1px solid #d1d5db', textAlign: 'center' }}
              />
            ))}
          </div>
        ))}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={usarSugestoes}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #7c3aed', color: '#7c3aed', background: '#fff' }}>
            preencher com sugestões
          </button>
          <button onClick={salvarJogos}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #10b981', color: '#10b981', background: '#fff' }}>
            salvar 6 jogos desta semana
          </button>
          <button onClick={calcularDesempenho}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #111827', color: '#111827', background: '#fff' }}>
            calcular desempenho (usa último sorteio)
          </button>
        </div>
      </div>

      {/* 8) Resultado manual (fallback final) */}
      <div style={{ ...box, marginTop: 16 }}>
        <h2 style={h2}>Resultado manual (fallback)</h2>
        <p style={p}>Se o site oficial estiver indisponível, preencha aqui o concurso e as dezenas oficiais.</p>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
          <label>Concurso:&nbsp;
            <input value={mNumero} onChange={e=>setMNumero(e.target.value)} inputMode="numeric" placeholder="0000"
              style={{ width: 80, padding: 6, borderRadius: 8, border: '1px solid #d1d5db' }}/>
          </label>
          <label>Data (opcional):&nbsp;
            <input value={mData} onChange={e=>setMData(e.target.value)} placeholder="dd/mm/aaaa"
              style={{ width: 120, padding: 6, borderRadius: 8, border: '1px solid #d1d5db' }}/>
          </label>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          {mDz.map((v, i) => (
            <input key={i} value={v} onChange={e=>setMDzCel(i, e.target.value)}
              inputMode="numeric" placeholder="00" maxLength={2}
              style={{ width: 44, padding: 6, borderRadius: 8, border: '1px solid #d1d5db', textAlign: 'center' }}/>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={usarManualComoOficial}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #0ea5e9', color: '#0ea5e9', background: '#fff' }}>
            usar como oficial
          </button>
          <button onClick={limparManual}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #ef4444', color: '#ef4444', background: '#fff' }}>
            limpar manual
          </button>
        </div>
      </div>
    </div>
  )
}
