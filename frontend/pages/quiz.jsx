import React, { useState } from 'react'
import { Brain, ArrowDown, ArrowUp, Lightbulb } from 'lucide-react'
import Link from 'next/link'
import { useAuth } from '../context/AuthContext'
import { requestBackendJson } from '../lib/backendApi'

export default function QuizPage() {
  const { token } = useAuth()
  const [question, setQuestion] = useState('')
  const [bloomLevel, setBloomLevel] = useState(3)
  const [variants, setVariants] = useState(null)
  const [analyzeResult, setAnalyzeResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)

  const handleIdentifyLevel = async () => {
    if (!question.trim()) {
      alert('Please enter a question first')
      return
    }
    
    setAnalyzing(true)
    try {
      const data = await requestBackendJson('/quiz/analyze-level', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: {
          question_text: question
        }
      })
      setAnalyzeResult(data)
    } catch (err) {
      console.error('Error analyzing level:', err)
      alert(err.message || 'Failed to analyze question')
    } finally {
      setAnalyzing(false)
    }
  }

  const handleConvertDifficulty = async () => {
    setLoading(true)
    try {
      const data = await requestBackendJson('/quiz/convert-difficulty', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: {
          question_text: question,
          current_level: bloomLevel,
          target_level: bloomLevel
        }
      })
      setVariants(data.variants)
    } catch (err) {
      console.error('Error converting difficulty:', err)
      alert(err.message || 'Failed to generate difficulty variants')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f4f4f5] via-[#f4f4f5] to-[#ede0d0]">
      {/* Header */}
      <header className="sticky top-0 border-b border-[#dccabc] bg-[#fbf6f0]/90 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Brain className="w-8 h-8 text-[#7d4f31]" />
            <h1 className="text-2xl font-bold">Question Difficulty Converter</h1>
          </div>
          <Link href="/dashboard" className="btn btn-outline">Back</Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="card p-8 mb-8">
          <h2 className="text-xl font-bold mb-6">Adjust Question Difficulty Level</h2>
          
          <div className="space-y-6">
            {/* Question Input */}
            <div>
              <label className="block text-sm font-medium mb-2">Enter Your Question</label>
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Enter the question you want to convert..."
                className="input min-h-[140px]"
                rows={4}
              />
            </div>

            {/* Bloom's Level Selector */}
            <div>
              <label className="block text-sm font-medium mb-2">Current Bloom&apos;s Level</label>
              <select
                value={bloomLevel}
                onChange={(e) => setBloomLevel(Number(e.target.value))}
                className="input"
              >
                <option value={1}>1 - Remember (Recall facts)</option>
                <option value={2}>2 - Understand (Explain concepts)</option>
                <option value={3}>3 - Apply (Use procedures)</option>
                <option value={4}>4 - Analyze (Break down components)</option>
                <option value={5}>5 - Evaluate (Make judgments)</option>
                <option value={6}>6 - Create (Design solutions)</option>
              </select>
            </div>

            {/* Identify Level Button */}
            <div className="flex gap-3">
              <button
                onClick={handleIdentifyLevel}
                disabled={!question || analyzing}
                className="flex-1 rounded-lg bg-[#c9ab3f] py-3 font-semibold text-zinc-950 transition hover:bg-[#76482b] disabled:bg-[#c7b5a5] flex items-center justify-center gap-2"
              >
                <Lightbulb className="w-5 h-5" />
                {analyzing ? 'Analyzing...' : 'Identify Question Level'}
              </button>
            </div>

            <button
              onClick={handleConvertDifficulty}
              disabled={!question || loading}
              className="w-full btn btn-primary py-3"
            >
              {loading ? 'Converting...' : 'Generate Difficulty Variants'}
            </button>
          </div>
        </div>

        {/* Analysis Result */}
        {analyzeResult && (
          <div className="card p-6 mb-8 bg-[#f4e7d8] border-2 border-[#d5b698]">
            <h3 className="text-2xl font-bold mb-4 text-[#5f3d26]">Identified Bloom&apos;s Level</h3>
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-lg">
                <p className="text-sm text-slate-600 mb-1">Current Level</p>
                <p className="text-2xl font-bold text-[#7b4d30]">
                  Level {analyzeResult.level} - {analyzeResult.level_name}
                </p>
              </div>
              <div className="bg-white p-4 rounded-lg">
                <p className="text-sm text-slate-600 mb-1">Confidence</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-slate-200 rounded-full h-2">
                    <div 
                      className="h-2 rounded-full bg-[#c9ab3f]" 
                      style={{width: `${(analyzeResult.confidence || 0.7) * 100}%`}}
                    ></div>
                  </div>
                  <span className="text-sm font-semibold">{Math.round((analyzeResult.confidence || 0.7) * 100)}%</span>
                </div>
              </div>
              {analyzeResult.keywords && analyzeResult.keywords.length > 0 && (
                <div className="bg-white p-4 rounded-lg">
                  <p className="text-sm text-slate-600 mb-2">Detected Keywords</p>
                  <div className="flex flex-wrap gap-2">
                    {analyzeResult.keywords.map((keyword, idx) => (
                      <span key={idx} className="rounded-full bg-[#ead6c1] px-3 py-1 text-sm text-[#6c452b]">
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Variants Display */}
        {variants && (
          <div className="space-y-6">
            <h3 className="text-2xl font-bold">Question Variants</h3>
            
            {variants.map((variant, idx) => (
              <div key={idx} className="card p-6 border-2 border-slate-200">
                <div className="flex items-start gap-4 mb-4">
                  <div className="flex-1">
                    <h4 className="font-bold text-lg text-[#18181b] mb-1">
                      {variant.bloom_level_name} (Level {variant.bloom_level})
                    </h4>
                    <p className="text-sm text-slate-600">{variant.reasoning}</p>
                  </div>
                  {variant.bloom_level < bloomLevel && (
                    <ArrowDown className="w-5 h-5 text-[#18181b] flex-shrink-0" />
                  )}
                  {variant.bloom_level > bloomLevel && (
                    <ArrowUp className="w-5 h-5 text-[#52525b] flex-shrink-0" />
                  )}
                </div>
                <p className="rounded-lg bg-[#f4f4f5] p-4 text-base">{variant.text}</p>
              </div>
            ))}
          </div>
        )}

        {/* Bloom's Reference */}
        <div className="card mt-12 border border-[#d4d4d8] bg-[#fafafa] p-6">
          <h3 className="font-bold text-lg mb-4">Bloom&apos;s Taxonomy Levels</h3>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div><strong className="text-[#18181b]">Level 1 - Remember:</strong> Recall facts and definitions</div>
            <div><strong className="text-[#18181b]">Level 2 - Understand:</strong> Explain concepts and ideas</div>
            <div><strong className="text-[#18181b]">Level 3 - Apply:</strong> Use procedures and techniques</div>
            <div><strong className="text-[#18181b]">Level 4 - Analyze:</strong> Break into components</div>
            <div><strong className="text-[#18181b]">Level 5 - Evaluate:</strong> Make judgments and decisions</div>
            <div><strong className="text-[#18181b]">Level 6 - Create:</strong> Design and formulate new ideas</div>
          </div>
        </div>
      </main>
    </div>
  )
}
