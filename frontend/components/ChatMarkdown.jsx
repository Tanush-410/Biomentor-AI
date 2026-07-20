import React, { useEffect, useRef, useState, useId } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'

import { useAuth } from '../context/AuthContext'
import { requestBackendJson } from '../lib/backendApi'

let mermaidInitialized = false

/**
 * Best-effort fixup for the most common ways the LLM breaks Mermaid syntax:
 *
 * 1) Leaving parentheses, colons, pipes, or other punctuation unquoted inside
 *    a node label, e.g. C[Override run() method]. Mermaid treats "(" as the
 *    start of a round-edge node shape, so anything after it inside an unquoted
 *    [...] label causes a parse error. Wrapping the label text in double quotes
 *    (and escaping any quotes already inside it) makes it literal text again.
 * 2) Writing an edge label as A -->|Yes|> B instead of A -->|Yes| B. The
 *    correct syntax closes the label with a single pipe and nothing else --
 *    a trailing ">" after the closing pipe is invalid and fails to parse.
 */
function sanitizeMermaidLabels(code) {
  const wrapIfNeeded = (open, label, close) => {
    const trimmed = label.trim()
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
      return `${open}${label}${close}`
    }
    if (/[(){}|:;"']/.test(label)) {
      const escaped = label.replace(/"/g, '#quot;')
      return `${open}"${escaped}"${close}`
    }
    return `${open}${label}${close}`
  }

  return code
    .split('\n')
    .map((line) => {
      return line
        // Fix "-->|Label|>" (and similar) -- strip the stray ">" right after
        // an edge label's closing pipe.
        .replace(/\|([^|\n]*)\|>/g, '|$1|')
        .replace(/(\[)([^\[\]]*)(\])/g, (_, open, label, close) => wrapIfNeeded(open, label, close))
        .replace(/(\{)([^{}]*)(\})/g, (_, open, label, close) => wrapIfNeeded(open, label, close))
    })
    .join('\n')
}

/**
 * Renders a Mermaid diagram from a fenced ```diagram / ```mermaid code block.
 * The AI chat is instructed (see backend qa.py system prompt) to emit these
 * fences whenever a visual explanation (flowchart, cycle, structure, timeline)
 * would help the answer land better than prose alone. As a safety net, if the
 * raw source fails to parse we retry once with sanitizeMermaidLabels() before
 * giving up and showing the raw source.
 */
function MermaidBlock({ code }) {
  const containerRef = useRef(null)
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function render() {
      try {
        const mermaid = (await import('mermaid')).default
        if (!mermaidInitialized) {
          mermaid.initialize({
            startOnLoad: false,
            // The app's global Tailwind reset conflicts with Mermaid's default
            // HTML-based node labels (rendered inside <foreignObject><span>),
            // which makes label text invisible even though the node shapes draw
            // fine. Forcing plain SVG <text> labels sidesteps that entirely.
            flowchart: { htmlLabels: false },
            theme: 'base',
            themeVariables: {
              primaryColor: '#d9c25c',
              primaryBorderColor: '#0a0a0a',
              primaryTextColor: '#0a0a0a',
              lineColor: '#0a0a0a',
              secondaryColor: '#e3ce7a',
              tertiaryColor: '#f2e9c4',
              fontFamily: 'Source Sans 3, Libre Franklin, sans-serif'
            }
          })
          mermaidInitialized = true
        }

        // mermaid.render(id, code) with no third argument appends its scratch
        // SVG straight to document.body, and only removes it on success -- on
        // a parse failure it draws its own "Syntax error in text" bomb graphic
        // into that body-attached element and leaves it there permanently
        // (confirmed in Mermaid's own source: render$4 in mermaid.js).
        //
        // Passing a container fixes that, but it must still be attached to
        // document.body (just visually hidden) rather than fully detached --
        // several of Mermaid's per-diagram renderers (flowchart's included)
        // internally re-locate the SVG via a document.body-scoped query
        // rather than the element reference we pass in, so a detached
        // container makes that lookup return null and crashes with
        // "Cannot read properties of null (reading 'appendChild')".
        // We attach an off-screen container ourselves and always remove it
        // in `finally`, so cleanup happens on both success and failure --
        // unlike Mermaid's own cleanup, which only runs on success.
        const renderIntoScratch = async (id, text) => {
          const scratch = document.createElement('div')
          scratch.setAttribute('aria-hidden', 'true')
          scratch.style.position = 'absolute'
          scratch.style.top = '-10000px'
          scratch.style.left = '-10000px'
          scratch.style.visibility = 'hidden'
          document.body.appendChild(scratch)
          try {
            return await mermaid.render(id, text, scratch)
          } finally {
            scratch.remove()
          }
        }

        const source = code.trim()
        let svg
        try {
          ;({ svg } = await renderIntoScratch(`mermaid-${uid}`, source))
        } catch (firstErr) {
          const sanitized = sanitizeMermaidLabels(source)
          if (sanitized === source) throw firstErr
          ;({ svg } = await renderIntoScratch(`mermaid-${uid}-retry`, sanitized))
        }

        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg
        }
      } catch (err) {
        if (!cancelled) setError(err?.message || 'Could not render this diagram.')
      }
    }

    render()
    return () => {
      cancelled = true
    }
  }, [code, uid])

  if (error) {
    return (
      <div className="my-3 rounded-xl border border-zinc-300 bg-zinc-50 p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-600">
          Diagram could not be rendered ({error}). Raw source:
        </p>
        <pre className="overflow-x-auto rounded-lg border border-zinc-200 bg-white p-2 text-xs text-zinc-800">
          <code>{code}</code>
        </pre>
      </div>
    )
  }

  return (
    <div className="my-3 overflow-x-auto rounded-2xl border border-black/10 bg-white/80 p-4">
      <div ref={containerRef} className="flex justify-center" />
    </div>
  )
}

/**
 * Renders a ```image code block by asking the backend for a real photo
 * (Wikimedia Commons) first, then falling back to a free AI-generated
 * illustration (Pollinations) if no real image was found.
 */
function ImageBlock({ prompt }) {
  const { token } = useAuth() || {}
  const [status, setStatus] = useState('loading')
  const [imageUrl, setImageUrl] = useState(null)
  const [sourceLabel, setSourceLabel] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function resolveImage() {
      setStatus('loading')
      try {
        const payload = await requestBackendJson('/qa/image-search', {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: { query: prompt }
        })
        if (cancelled) return
        if (payload?.image_url) {
          setImageUrl(payload.image_url)
          setSourceLabel('wikimedia')
          setStatus('ready')
          return
        }
      } catch (err) {
        if (cancelled) return
      }

      if (cancelled) return
      setImageUrl(`https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=768&height=512&nologo=true`)
      setSourceLabel('generated')
      setStatus('ready')
    }

    resolveImage()
    return () => {
      cancelled = true
    }
  }, [prompt, token])

  if (status === 'loading') {
    return (
      <div className="my-3 flex h-48 items-center justify-center rounded-2xl border border-black/10 bg-white/80 text-sm text-zinc-500">
        Finding an illustration...
      </div>
    )
  }

  if (status === 'failed') {
    return (
      <div className="my-3 rounded-2xl border border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-600">
        Could not load an image for &ldquo;{prompt}&rdquo;.
      </div>
    )
  }

  return (
    <div className="my-3 overflow-hidden rounded-2xl border border-black/10 bg-white/80">
      <img
        src={imageUrl}
        alt={prompt}
        className="w-full object-cover"
        onError={() => setStatus('failed')}
      />
      <p className="px-4 py-2 text-xs text-zinc-500">
        {sourceLabel === 'wikimedia' ? (
          <>
            Source:{' '}
            <a href={imageUrl} target="_blank" rel="noreferrer" className="font-semibold text-zinc-700 underline">
              Wikimedia Commons
            </a>
          </>
        ) : (
          'AI-generated illustration'
        )}
      </p>
    </div>
  )
}

/**
 * Drop-in replacement for rendering plain chat text. Supports:
 *  - Inline math: $E = mc^2$
 *  - Block math:  $$\\int_a^b f(x)\\,dx$$
 *  - AI-generated diagrams via ```diagram or ```mermaid fenced blocks
 *  - AI-requested pictures via ```image fenced blocks
 *  - Standard markdown (lists, bold, code) for readability
 */
export default function ChatMarkdown({ content }) {
  if (!content) return null

  return (
    <div className="chat-markdown whitespace-pre-wrap break-words leading-7">
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="mb-2 list-disc pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="mb-2 list-decimal pl-5">{children}</ol>,
          li: ({ children }) => <li className="mb-1">{children}</li>,
          strong: ({ children }) => <strong className="font-bold">{children}</strong>,
          code({ className, children }) {
            const lang = /language-(\w+)/.exec(className || '')?.[1]
            const codeText = String(children).replace(/\n$/, '')
            const isBlock = Boolean(className)

            if (isBlock && (lang === 'diagram' || lang === 'mermaid')) {
              return <MermaidBlock code={codeText} />
            }

            if (isBlock && lang === 'image') {
              return <ImageBlock prompt={codeText.trim()} />
            }

            if (!isBlock) {
              return (
                <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-[0.9em] text-zinc-800">
                  {children}
                </code>
              )
            }

            return (
              <pre className="my-2 overflow-x-auto rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm">
                <code>{children}</code>
              </pre>
            )
          }
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
