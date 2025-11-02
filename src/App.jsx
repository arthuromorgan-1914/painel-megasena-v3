import React, { useEffect, useState } from 'react'
import {
  LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts'
import { generateSuggestions } from './lib/suggest'

// ===== DEMO dos gráficos mantidos =====
const desempenhoGeral = 74
const variacaoSemanal = +5
const performanceHistory = [
  { semana: 'S-4', score: 61 },
  { semana: 'S-3', score: 66 },
  { semana: 'S-2', score: 69 },
  { semana: 'S-1', score: 72 },
  { semana: 'Atual', score: desempenhoGeral },
]
const paresImpares = [
  { tipo: 'Pares', valor: 54 },
  { tipo: 'Ímpares', valor: 46 },
]
const distribuicaoDezenas = [
  { faixa: '1-10', qtd: 18 },
  { faixa: '11-20', qtd: 22 },
  { faixa: '21-30', qtd: 20 },
  { faixa: '31-40', qtd: 19 },
  { faixa: '41-50', qtd: 13 },
  { faixa: '51-60', qtd: 8 },
]

// estilos inline simples
const box = { border: '1px solid #e5e7eb', borderRadius: 12, background: '#fff', padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }
const h2 = { fontSize: 18, margin: 0, marginBottom: 8, fontWeight: 600 }
const p  = { margin: '6px 0', color: '#4b5563', fontSize: 14 }
const chip = (bg, color='#fff') => ({ display: 'inline-block', padding: '4px 8px', borderRadius: 8, fontWeight: 700, background: bg, color })

export default function App() {
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState(
    new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  )
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)
  const [concurso, setConcurso] = useState(null)   // {numero, dataApuracao, dezenas:[]}
  const [sugestoes, setSugestoes] = useState([])

  // busca real via API interna
  useEffect(() => {
    (async () => {
      try {
        setLoading(true); setErro(null)
        const res = await fetch('/api/mega', { cache: 'no-store' })
        const data = await res.json()
        if (data?.ok) {
          const dezenas = (data.dezenas || []).map(x => String(x).padStart(2,'0'))
          setConcurso({ numero: data.numero, dataApuracao: data.dataApuracao || null, dezenas })
          setSugestoes(generateSuggestions({ ultimo: dezenas.map(d => Number(d)), seed: data.numero }))
        } else {
          setErro('Não foi possível sincronizar agora. Mostrando sugestões base.')
          setConcurso(null)
          setSugestoes(generateSuggestions({ ultimo: [], seed: 1 }))
        }
      } catch (e) {
        setErro('Falha na sincronização. Mostrando sugestões base.')
        setConcurso(null)
        setSugestoes(generateSuggestions({ ultimo: [], seed: 2 }))
      } finally {
        setLoading(false)
        setUltimaAtualizacao(new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }))
      }
    })()
  }, [])

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: 24 }}>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline', marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Painel da Mega-Sena</h1>
        <div style={{ fontSize: 13, color: '#374151' }}>
          <strong>Última atualização:</strong> {ultimaAtualizacao}
        </div>
      </div>

      {/* Alerta de sincronização */}
      {erro && (
        <div style={{ ...box, borderColor: '#fcd34d', background: '#fffbeb', color: '#92400e', marginBottom: 12 }}>
          ⚠️ {erro}
        </div>
      )}

      {/* 1) Desempenho */}
      <div style={{ ...box, background: 'linear-gradient(90deg,#16a34a,#059669)', color: '#fff', textAlign: 'center' }}>
        <h2 style={{ ...h2, color: '#fff' }}>Índice de Desempenho Acumulado</h2>
        <p style={{ ...p, color: 'rgba(255,255,255,0.9)' }}>
          Mostra o quanto o sistema vem acertando os números ao longo do tempo.
        </p>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 16 }}>
          <div style={{ fontSize: 48, fontWeight: 800 }}>{desempenhoGeral}%</div>
          <div style={chip(variacaoSemanal >= 0 ? 'rgba(16,185,129,0.9)' : '#ef4444')}>
            {variacaoSemanal >= 0 ? '+' : ''}{variacaoSemanal} p.p.
          </div>
        </div>
        <p style={{ fontSize: 12, marginTop: 8, opacity: 0.9 }}>
          A variação indica se as previsões estão melhorando ou piorando na semana.
        </p>
      </div>

      {/* 2) Histórico */}
      <div style={{ ...box, marginTop: 16 }}>
        <h2 style={h2}>Histórico do Índice de Precisão</h2>
        <p style={p}>Evolução da taxa de acertos ao longo das últimas semanas.</p>
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
                {paresImpares.map((_, i) => (
                  <Cell key={i} fill={i % 2 === 0 ? '#16a34a' : '#2563eb'} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 4) Distribuição por faixa */}
      <div style={{ ...box, marginTop: 16 }}>
        <h2 style={h2}>Distribuição por Faixa de Números</h2>
        <p style={p}>Quantos números de cada grupo (1-10, 11-20, etc.) costumam sair.</p>
        <div style={{ width: '100%', height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={distribuicaoDezenas}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="faixa" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="qtd" fill="#f59e0b" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 5) Último sorteio (real) */}
      <div style={{ ...box, marginTop: 16 }}>
        <h2 style={h2}>Último Sorteio</h2>
        <p style={p}>Dados obtidos automaticamente da fonte oficial (com fallback).</p>
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
                <div key={d} style={{ padding: '8px 12px', borderRadius: 10, background: '#f3f4f6', fontWeight: 700 }}>
                  {d}
                </div>
              ))}
            </div>
          </>
        ) : (
          <div style={{ color: '#6b7280' }}>Sem dados no momento.</div>
        )}
      </div>

      {/* 6) Sugestões (regras) */}
      <div style={{ ...box, marginTop: 16 }}>
        <h2 style={h2}>Sugestões de Jogos</h2>
        <p style={p}>Combinações balanceadas por faixas e pares/ímpares, evitando repetir o último sorteio.</p>
        <ol style={{ margin: 0, paddingLeft: 16, display: 'grid', gap: 8 }}>
          {sugestoes.map((jogo, idx) => (
            <li key={idx} style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <strong style={{ width: 28 }}>#{String(idx+1).padStart(2,'0')}</strong>
              {jogo.map((d) => (
                <span key={d} style={{ padding: '6px 10px', borderRadius: 8, background: '#eef2ff', fontWeight: 700 }}>
                  {d}
                </span>
              ))}
            </li>
          ))}
        </ol>
        <p style={{ ...p, fontSize: 12, marginTop: 8 }}>
          *Use como inspiração; não garante prêmio.
        </p>
      </div>
    </div>
  )
}
