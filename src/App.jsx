import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts'

const SOURCES = [
  { url: 'https://servicebus2.caixa.gov.br/portaldeloterias/api/lotteries/megasena/latest', type: 'json' },
  { url: 'https://servicebus2.caixa.gov.br/portaldeloterias/api/resultados?modalidade=megasena', type: 'text' },
  { url: 'https://loteriascaixa-api.herokuapp.com/api/mega-sena/latest', type: 'json' },
]

async function fetchLatestDraw() {
  for (const src of SOURCES) {
    try {
      const res = await fetch(src.url, {
        headers: { 'Accept': src.type === 'json' ? 'application/json' : 'text/html' },
        mode: 'cors',
      })
      if (!res.ok) continue
      if (src.type === 'json') {
        const data = await res.json()
        const numero = Number(data.numero || data.numeroConcurso)
        const dezenas = data.dezenasSorteadasOrdemSorteio || data.listaDezenas || []
        const dataApuracao = data.dataApuracao || undefined
        if (numero && dezenas.length) return { numero, dezenas, dataApuracao }
      } else {
        const text = await res.text()
        const numMatch = text.match(/Concurso\\s*(\\d{3,5})/i)
        const dezenasMatch = text.match(/(\\d{2})[ ,;-]+(\\d{2})[ ,;-]+(\\d{2})[ ,;-]+(\\d{2})[ ,;-]+(\\d{2})[ ,;-]+(\\d{2})/)
        if (numMatch && dezenasMatch) {
          const numero = Number(numMatch[1])
          const dezenas = dezenasMatch.slice(1, 7)
          return { numero, dezenas }
        }
      }
    } catch (e) { continue }
  }
  throw new Error('Não foi possível obter o último resultado da Mega-Sena.')
}

export default function App() {
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState(new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }))
  const [sincronizado, setSincronizado] = useState(false)
  const [erroSync, setErroSync] = useState(null)
  const [ultimoConcursoLocal, setUltimoConcursoLocal] = useState(2929)
  const [ultimoConcursoRemoto, setUltimoConcursoRemoto] = useState(2929)
  const [checando, setChecando] = useState(false)
  const [dezenasUltimo, setDezenasUltimo] = useState([])
  const [dataApuracao, setDataApuracao] = useState(undefined)

  async function checarAtualizacoes() {
    setChecando(true); setErroSync(null)
    try {
      const remoto = await fetchLatestDraw()
      setUltimoConcursoRemoto(remoto.numero)
      setDezenasUltimo(remoto.dezenas)
      setDataApuracao(remoto.dataApuracao)
      if (remoto.numero > ultimoConcursoLocal) {
        setSincronizado(true)
        setUltimoConcursoLocal(remoto.numero)
        setUltimaAtualizacao(new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }))
      } else {
        setSincronizado(false)
      }
    } catch (e) {
      setErroSync(e?.message || 'Falha ao consultar os resultados.')
      setSincronizado(false)
    } finally {
      setChecando(false)
    }
  }

  useEffect(() => { checarAtualizacoes() }, [])

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

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <motion.h1 className="text-2xl font-bold" initial={{opacity:0,y:-10}} animate={{opacity:1,y:0}}>
          Painel da Mega-Sena
        </motion.h1>
        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-700">
          <div>
            <span className="font-medium">Última atualização:</span> {ultimaAtualizacao}
            {dataApuracao && <span className="ml-2 text-xs text-gray-500">(Concurso de {dataApuracao})</span>}
          </div>
          {sincronizado ? (
            <span className="bg-emerald-600 text-white px-2 py-1 rounded text-xs">Sincronizado com a CAIXA</span>
          ) : (
            <span className="bg-amber-500 text-white px-2 py-1 rounded text-xs">Aguardando novo sorteio</span>
          )}
        </div>
      </div>

      {erroSync && (
        <div className="border border-amber-300 bg-amber-50 p-3 text-amber-800 text-sm rounded">
          ⚠️ {erroSync}
        </div>
      )}

      {/* Seções (simplificadas) ... */}
      <div className="shadow rounded bg-white p-4">
        <h2 className="font-semibold text-lg mb-2">Histórico do Índice de Precisão</h2>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={performanceHistory}>
            <Line type="monotone" dataKey="score" stroke="#10b981" strokeWidth={2} />
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="semana" />
            <YAxis domain={[0, 100]} />
            <Tooltip />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="shadow rounded bg-white p-4">
        <h2 className="font-semibold text-lg mb-2">Distribuição entre Números Pares e Ímpares</h2>
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie data={paresImpares} dataKey="valor" nameKey="tipo" outerRadius={80} label>
              {paresImpares.map((_, i) => <Cell key={i} fill={i % 2 === 0 ? '#16a34a' : '#2563eb'} />)}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="shadow rounded bg-white p-4">
        <h2 className="font-semibold text-lg mb-2">Distribuição por Faixa de Números</h2>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={distribuicaoDezenas}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="faixa" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="qtd" fill="#f59e0b" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="text-xs text-gray-500">
        <p>Último concurso local: {ultimoConcursoLocal}</p>
        <p>Último concurso remoto (detectado): {ultimoConcursoRemoto}</p>
        {dezenasUltimo.length > 0 && (<p>Dezenas do último remoto: {dezenasUltimo.join(' · ')}</p>)}
      </div>
    </div>
  )
}
