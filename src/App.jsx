import React, { useEffect, useMemo, useState } from 'react'
import {
  LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts'
import { generateSuggestions } from './lib/suggest'
import { getJogos, saveJogos, getHistorico, upsertHistorico } from './lib/storage'

// ===== gráficos “contexto” (fixos por enquanto) =====
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

// auxiliares
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
  const [concurso, setConcurso] = useState(null)
  const [sugestoes, setSugestoes] = useState([])
  const [meusJogos, setMeusJogos] = useState(vazio6())
  const [histReal, setHistReal] = useState(getHistorico())

  // ======== função que sincroniza (também usada no botão) ========
  async function sincronizarAgora() {
    try {
      setLoading(true); setErro(null)
      const res = await fetch('/api/mega', { cache: 'no-store' })
      const data = await res.json()
      if (data?.ok) {
        const dezenas = (data.dezenas || []).map(x => String(x).padStart(2,'0'))
        setConcurso({ numero: data.numero, dataApuracao: data.dataApuracao || null, dezenas })
        const sug = generateSuggestions({ ultimo: dezenas.map(d => Number(d)), seed: data.numero })
        setSugestoes(sug)

        const salvos = getJogos(data.numero)
        if (salvos.length) setMeusJogos(salvos.map(x => x.slice()))
        else setMeusJogos(sug.map(j => j.slice()))
      } else {
        setErro(data?.error || 'Não foi possível sincronizar agora.')
      }
    } catch (e) {
      setErro('Falha na sincronização: ' + (e?.message || String(e)))
    } finally {
      setLoading(false)
      setUltimaAtualizacao(new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }))
    }
  }

  // busca inicial
  useEffect(() => { sincronizarAgora() }, [])

  // histórico real (ou simulado)
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
    if (!concurso?.numero) { alert('Aguarde sincronizar o número do concurso.'); return }
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
    if (!concurso?.dezenas?.length) { alert('Resultado oficial não disponível ainda.'); return }
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

      {/* Aviso */}
      {erro && (
        <div style={{ ...box, borderColor: '#fcd34d', background: '#fffbeb', color: '#92400e', marginTop: 12 }}>
          ⚠️ {erro}
        </div>
      )}

      {/* Demais seções: desempenho, histórico, gráficos, sugestões, registrar jogos */}
      {/* ... mantenha as mesmas seções do seu App.jsx anterior ... */}
    </div>
  )
}
