import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Clipboard, Code2, Copy, Download, Minimize2, Moon, Plus, Sparkles, Sun, Terminal, X } from 'lucide-react'
import { toBlob, toPng } from 'html-to-image'
import { codeToHtml } from 'shiki'
import * as prettier from 'prettier/standalone'
import babelPlugin from 'prettier/plugins/babel'
import estreePlugin from 'prettier/plugins/estree'
import typescriptPlugin from 'prettier/plugins/typescript'

const starter = `type User = {
  id: number;
  name: string;
  email: string;
};

async function fetchUser(id: number): Promise<User> {
  const response = await fetch(\`/api/users/\${id}\`);

  if (!response.ok) {
    throw new Error("User not found");
  }

  return response.json();
}

fetchUser(42).then((user) => {
  console.log(\`Hello, \${user.name}!\`);
});`

const languages = [
  { value: 'typescript', label: 'TypeScript' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'tsx', label: 'React TSX' },
  { value: 'jsx', label: 'React JSX' },
  { value: 'c', label: 'C' },
  { value: 'cpp', label: 'C++' },
  { value: 'python', label: 'Python' },
  { value: 'go', label: 'Go' },
  { value: 'java', label: 'Java' },
  { value: 'rust', label: 'Rust' },
  { value: 'csharp', label: 'C#' },
  { value: 'php', label: 'PHP' },
  { value: 'ruby', label: 'Ruby' },
  { value: 'json', label: 'JSON' },
  { value: 'css', label: 'CSS' },
  { value: 'html', label: 'HTML' },
  { value: 'shellscript', label: 'Shell' },
  { value: 'sql', label: 'SQL' },
  { value: 'yaml', label: 'YAML' },
]

const fonts = [
  { value: 'DM Mono', label: 'DM Mono' },
  { value: 'JetBrains Mono', label: 'JetBrains' },
  { value: 'Fira Code', label: 'Fira Code' },
  { value: 'IBM Plex Mono', label: 'IBM Plex' },
]

const accents = [
  ['#ff8a65', '#7e57c2'],
  ['#47d7ac', '#3a86ff'],
  ['#ffbe0b', '#fb5607'],
  ['#f15bb5', '#9b5de5'],
]

type CodeTab = { id: string; title: string; language: string; code: string }

const firstTab: CodeTab = { id: 'welcome', title: 'fetch-user.ts', language: 'typescript', code: starter }

function loadWorkspace(): { tabs: CodeTab[]; activeId: string } {
  try {
    const saved = JSON.parse(localStorage.getItem('codeframe-workspace') || '')
    if (Array.isArray(saved.tabs) && saved.tabs.length && saved.activeId) return saved
  } catch { /* Start with the sample when stored data is unavailable. */ }
  return { tabs: [firstTab], activeId: firstTab.id }
}

export default function App() {
  const [workspace, setWorkspace] = useState(loadWorkspace)
  const [highlighted, setHighlighted] = useState('')
  const [accent, setAccent] = useState(0)
  const [copied, setCopied] = useState(false)
  const [imageCopyStatus, setImageCopyStatus] = useState<'idle' | 'copying' | 'copied' | 'error'>('idle')
  const [exporting, setExporting] = useState(false)
  const [mode, setMode] = useState<'dark' | 'light'>('dark')
  const [frameStyle, setFrameStyle] = useState<'code' | 'terminal'>('code')
  const [font, setFont] = useState('DM Mono')
  const [transparent, setTransparent] = useState(false)
  const [showLines, setShowLines] = useState(true)
  const [showChrome, setShowChrome] = useState(true)
  const previewRef = useRef<HTMLDivElement>(null)
  const codeWindowRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<HTMLTextAreaElement>(null)
  const activeTab = workspace.tabs.find((tab) => tab.id === workspace.activeId) ?? workspace.tabs[0]
  const { code, language, title } = activeTab
  const displayLines = showLines && frameStyle === 'code'

  function updateActive(changes: Partial<CodeTab>) {
    setWorkspace((current) => ({ ...current, tabs: current.tabs.map((tab) => tab.id === current.activeId ? { ...tab, ...changes } : tab) }))
  }
  const setCode = (value: string) => updateActive({ code: value })
  const setLanguage = (value: string) => updateActive({ language: value })
  const setTitle = (value: string) => updateActive({ title: value })

  useEffect(() => {
    localStorage.setItem('codeframe-workspace', JSON.stringify(workspace))
  }, [workspace])

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(async () => {
      try {
        const html = await codeToHtml(code || ' ', { lang: language, theme: mode === 'dark' ? 'vesper' : 'github-light' })
        if (active) setHighlighted(html)
      } catch {
        if (active) setHighlighted(`<pre><code>${escapeHtml(code)}</code></pre>`)
      }
    }, 80)
    return () => { active = false; window.clearTimeout(timer) }
  }, [code, language, mode])

  async function formatCode() {
    if (!['typescript', 'javascript', 'tsx', 'jsx', 'json'].includes(language)) return
    const parser = language === 'typescript' || language === 'tsx' ? 'typescript' : language === 'json' ? 'json' : 'babel'
    try {
      const formatted = await prettier.format(code, {
        parser,
        plugins: [babelPlugin, estreePlugin, typescriptPlugin],
        semi: true,
        singleQuote: true,
        trailingComma: 'all',
      })
      setCode(formatted.trimEnd())
    } catch {
      // Keep the user's code untouched when it is incomplete or invalid.
    }
  }

  async function copyCode() {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  function createExportTarget() {
    const preview = previewRef.current
    const codeWindow = codeWindowRef.current
    const editor = editorRef.current
    if (!preview || !codeWindow || !editor) throw new Error('Could not find the image preview')

    const source = transparent ? codeWindow : preview
    const exportNode = source.cloneNode(true) as HTMLElement
    const exportWindow = exportNode.matches('.code-window') ? exportNode : exportNode.querySelector<HTMLElement>('.code-window')
    const exportEditor = exportWindow?.querySelector<HTMLTextAreaElement>('textarea')
    if (!exportWindow || !exportEditor) throw new Error('Could not prepare the image preview')

    const windowBounds = codeWindow.getBoundingClientRect()
    const extraWidth = Math.max(0, editor.scrollWidth - editor.clientWidth)
    const extraHeight = Math.max(0, editor.scrollHeight - editor.clientHeight)
    const exportWindowWidth = Math.ceil(windowBounds.width + extraWidth)
    const exportWindowHeight = Math.ceil(windowBounds.height + extraHeight)

    Object.assign(exportWindow.style, {
      width: `${exportWindowWidth}px`,
      height: `${exportWindowHeight}px`,
      maxWidth: 'none',
      maxHeight: 'none',
      resize: 'none',
    })
    exportEditor.value = editor.value
    exportEditor.scrollTop = 0
    exportEditor.scrollLeft = 0
    exportEditor.style.overflow = 'hidden'
    const exportHighlight = exportWindow.querySelector<HTMLElement>('.highlight')
    const exportLines = exportWindow.querySelector<HTMLElement>('.line-numbers')
    if (exportHighlight) exportHighlight.style.overflow = 'hidden'
    if (exportLines) exportLines.style.overflow = 'hidden'

    if (!transparent) {
      const previewBounds = preview.getBoundingClientRect()
      const previewStyle = getComputedStyle(preview)
      const horizontalPadding = parseFloat(previewStyle.paddingLeft) + parseFloat(previewStyle.paddingRight)
      const verticalPadding = parseFloat(previewStyle.paddingTop) + parseFloat(previewStyle.paddingBottom)
      Object.assign(exportNode.style, {
        width: `${Math.max(previewBounds.width, exportWindowWidth + horizontalPadding)}px`,
        height: `${Math.max(previewBounds.height, exportWindowHeight + verticalPadding)}px`,
        minHeight: '0',
      })
    }

    const staging = document.createElement('div')
    staging.className = `app-shell ${mode}`
    staging.setAttribute('aria-hidden', 'true')
    Object.assign(staging.style, {
      position: 'fixed',
      left: '-100000px',
      top: '0',
      pointerEvents: 'none',
    })
    staging.appendChild(exportNode)
    document.body.appendChild(staging)

    return { exportNode, cleanup: () => staging.remove() }
  }

  function fitWindowToContent() {
    const preview = previewRef.current
    const codeWindow = codeWindowRef.current
    const editor = editorRef.current
    if (!preview || !codeWindow || !editor) return

    const editorStyle = getComputedStyle(editor)
    const previewStyle = getComputedStyle(preview)
    const fontSize = parseFloat(editorStyle.fontSize)
    const lineHeight = parseFloat(editorStyle.lineHeight) || fontSize * 1.85
    const editorPaddingX = parseFloat(editorStyle.paddingLeft) + parseFloat(editorStyle.paddingRight)
    const editorPaddingY = parseFloat(editorStyle.paddingTop) + parseFloat(editorStyle.paddingBottom)
    const previewPaddingX = parseFloat(previewStyle.paddingLeft) + parseFloat(previewStyle.paddingRight)
    const lines = code.split('\n')

    const measuringCanvas = document.createElement('canvas')
    const context = measuringCanvas.getContext('2d')
    if (context) context.font = `${editorStyle.fontWeight} ${editorStyle.fontSize} ${editorStyle.fontFamily}`
    const contentWidth = Math.max(...lines.map((line) => context?.measureText(line || ' ').width ?? line.length * fontSize * 0.6))
    const gutterWidth = displayLines ? 52 : 0
    const titleWidth = showChrome ? Math.min(440, (title || 'untitled').length * 7 + 130) : 0
    const desiredWidth = Math.max(220, contentWidth + editorPaddingX + gutterWidth + 2, titleWidth)
    const availableWidth = Math.max(220, preview.clientWidth - previewPaddingX)
    const desiredHeight = lines.length * lineHeight + editorPaddingY + (showChrome ? 43 : 0) + 2

    codeWindow.style.width = `${Math.ceil(Math.min(desiredWidth, availableWidth))}px`
    codeWindow.style.height = `${Math.ceil(Math.min(Math.max(96, desiredHeight), 700))}px`
  }

  function addTab() {
    const id = crypto.randomUUID()
    const tab: CodeTab = { id, title: `untitled-${workspace.tabs.length + 1}.ts`, language: 'typescript', code: '// Start typing…' }
    setWorkspace((current) => ({ tabs: [...current.tabs, tab], activeId: id }))
    requestAnimationFrame(() => editorRef.current?.focus())
  }

  function closeTab(id: string) {
    setWorkspace((current) => {
      if (current.tabs.length === 1) {
        const id = crypto.randomUUID()
        return { tabs: [{ ...firstTab, id, title: 'untitled.ts', code: '' }], activeId: id }
      }
      const index = current.tabs.findIndex((tab) => tab.id === id)
      const tabs = current.tabs.filter((tab) => tab.id !== id)
      const activeId = current.activeId === id ? tabs[Math.min(index, tabs.length - 1)].id : current.activeId
      return { tabs, activeId }
    })
  }

  async function downloadImage() {
    if (!previewRef.current) return
    setExporting(true)
    let cleanup: (() => void) | undefined
    try {
      await document.fonts.ready
      const target = createExportTarget()
      cleanup = target.cleanup
      const dataUrl = await toPng(target.exportNode, { pixelRatio: 2.5, cacheBust: true, backgroundColor: transparent ? undefined : accents[accent][0] })
      const link = document.createElement('a')
      link.download = `${title.replace(/\.[^.]+$/, '') || 'codeframe'}.png`
      link.href = dataUrl
      link.click()
    } finally {
      cleanup?.()
      setExporting(false)
    }
  }

  async function copyImage() {
    if (!previewRef.current) return
    if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
      setImageCopyStatus('error')
      window.setTimeout(() => setImageCopyStatus('idle'), 2200)
      return
    }

    setImageCopyStatus('copying')
    try {
      const blobPromise = document.fonts.ready.then(async () => {
        const { exportNode, cleanup } = createExportTarget()
        try {
          const blob = await toBlob(exportNode, {
            pixelRatio: 2.5,
            cacheBust: true,
            backgroundColor: transparent ? undefined : accents[accent][0],
          })
          if (!blob) throw new Error('Could not render the image')
          return blob
        } finally {
          cleanup()
        }
      })

      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blobPromise })])
      setImageCopyStatus('copied')
      window.setTimeout(() => setImageCopyStatus('idle'), 1600)
    } catch {
      setImageCopyStatus('error')
      window.setTimeout(() => setImageCopyStatus('idle'), 2200)
    }
  }

  function handleEditorKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Tab') return
    event.preventDefault()

    const editor = event.currentTarget
    const start = editor.selectionStart
    const end = editor.selectionEnd
    const lineStart = code.lastIndexOf('\n', start - 1) + 1
    const selectedBlock = code.slice(lineStart, end)

    if (event.shiftKey) {
      const lines = selectedBlock.split('\n')
      let removedBeforeStart = 0
      let removedTotal = 0
      const dedented = lines.map((line, index) => {
        const match = line.match(/^( {1,2}|\t)/)
        const removed = match?.[0].length ?? 0
        if (index === 0) removedBeforeStart = Math.min(removed, start - lineStart)
        removedTotal += removed
        return line.slice(removed)
      }).join('\n')
      setCode(code.slice(0, lineStart) + dedented + code.slice(end))
      requestAnimationFrame(() => {
        editorRef.current?.setSelectionRange(start - removedBeforeStart, end - removedTotal)
      })
      return
    }

    if (start === end) {
      setCode(code.slice(0, start) + '  ' + code.slice(end))
      requestAnimationFrame(() => editorRef.current?.setSelectionRange(start + 2, start + 2))
      return
    }

    const indented = selectedBlock.split('\n').map((line) => `  ${line}`).join('\n')
    const added = indented.length - selectedBlock.length
    setCode(code.slice(0, lineStart) + indented + code.slice(end))
    requestAnimationFrame(() => editorRef.current?.setSelectionRange(start + 2, end + added))
  }

  const gradient = `linear-gradient(135deg, ${accents[accent][0]}, ${accents[accent][1]})`
  const canFormat = ['typescript', 'javascript', 'tsx', 'jsx', 'json'].includes(language)

  return (
    <div className={`app-shell ${mode}`}>
      <header>
        <a className="brand" href="#"><span className="brand-mark"><Code2 size={19} /></span>codeframe</a>
        <div className="header-note"><span /> Your code stays in your browser</div>
      </header>

      <main>
        <section className="intro">
          <p className="eyebrow"><Sparkles size={14} /> MAKE IT SHARABLE</p>
          <h1>Turn code into<br /><em>something beautiful.</em></h1>
          <p className="subtitle">Paste, polish, and export a picture-perfect snippet in seconds.</p>
        </section>

        <section className="workspace">
          <div className="controls">
            <label className="select-wrap">
              <span>LANGUAGE</span>
              <select value={language} onChange={(e) => setLanguage(e.target.value)}>
                {languages.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
              <ChevronDown size={15} />
            </label>
            <label className="filename">
              <span>FILENAME</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Filename" />
            </label>
            <div className="themes">
              <span>BACKGROUND</span>
              <div>{accents.map((colors, i) => (
                <button key={colors[0]} className={accent === i ? 'swatch active' : 'swatch'} style={{ background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})` }} onClick={() => setAccent(i)} aria-label={`Background ${i + 1}`} />
              ))}</div>
            </div>
            <label className="select-wrap font-select">
              <span>FONT</span>
              <select value={font} onChange={(e) => setFont(e.target.value)}>
                {fonts.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
              <ChevronDown size={15} />
            </label>
            <button className="format-button" onClick={formatCode} disabled={!canFormat} title={canFormat ? 'Format with Prettier' : 'Syntax highlighting only for this language'}><Sparkles size={16} /> {canFormat ? 'Format code' : 'Highlight only'}</button>
          </div>

          <div className="tab-bar" role="tablist" aria-label="Code files">
            <div className="tab-list">
              {workspace.tabs.map((tab) => <button key={tab.id} role="tab" aria-selected={tab.id === workspace.activeId} className={tab.id === workspace.activeId ? 'code-tab active' : 'code-tab'} onClick={() => setWorkspace((current) => ({ ...current, activeId: tab.id }))}>
                <span className={`language-dot lang-${tab.language}`} />
                <span>{tab.title || 'untitled'}</span>
                <i onClick={(event) => { event.stopPropagation(); closeTab(tab.id) }} aria-label={`Close ${tab.title}`}><X size={12} /></i>
              </button>)}
            </div>
            <button className="add-tab" onClick={addTab} aria-label="New editor" title="New editor"><Plus size={15} /></button>
          </div>

          <div className="customize-bar">
            <span>APPEARANCE</span>
            <div className="mode-switch frame-switch" aria-label="Frame style">
              <button className={frameStyle === 'code' ? 'active' : ''} onClick={() => setFrameStyle('code')}><Code2 size={13} /> Code</button>
              <button className={frameStyle === 'terminal' ? 'active' : ''} onClick={() => setFrameStyle('terminal')}><Terminal size={13} /> Terminal</button>
            </div>
            <div className="mode-switch" aria-label="Color theme">
              <button className={mode === 'dark' ? 'active' : ''} onClick={() => setMode('dark')}><Moon size={13} /> Dark</button>
              <button className={mode === 'light' ? 'active' : ''} onClick={() => setMode('light')}><Sun size={13} /> Light</button>
            </div>
            <Toggle label="Transparent background" checked={transparent} onChange={setTransparent} />
            {frameStyle === 'code' && <Toggle label="Line numbers" checked={showLines} onChange={setShowLines} />}
            <Toggle label="Window bar" checked={showChrome} onChange={setShowChrome} />
            <button className="fit-button" onClick={fitWindowToContent} title="Resize the window to fit its content"><Minimize2 size={13} /> Fit content</button>
          </div>

          <div className="canvas-wrap">
            <div ref={previewRef} className={`export-canvas ${transparent ? 'is-transparent' : ''}`} style={{ background: transparent ? 'transparent' : gradient }}>
              {!transparent && <><div className="glow glow-one" /><div className="glow glow-two" /></>}
              <div ref={codeWindowRef} className={`code-window ${frameStyle === 'terminal' ? 'terminal-window' : ''} ${!showChrome ? 'no-chrome' : ''} ${!displayLines ? 'no-lines' : ''}`} style={{ '--editor-font': `'${font}', monospace` } as React.CSSProperties}>
                {showChrome && <div className="window-bar">
                  <div className="lights"><i /><i /><i /></div>
                  <span>{frameStyle === 'terminal' && <Terminal size={12} />}{title || (frameStyle === 'terminal' ? 'terminal' : 'untitled')}</span>
                  <div className="window-spacer" />
                </div>}
                <div className="code-area">
                  {displayLines && <div className="line-numbers" aria-hidden="true">{code.split('\n').map((_, i) => <span key={i}>{i + 1}</span>)}</div>}
                  {frameStyle === 'terminal' && <span className="terminal-prompt" aria-hidden="true">❯</span>}
                  <div className="highlight" dangerouslySetInnerHTML={{ __html: highlighted }} />
                  <textarea ref={editorRef} value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={handleEditorKeyDown} spellCheck={false} aria-label="Code editor" onScroll={(e) => {
                    const target = e.currentTarget
                    const layer = target.parentElement?.querySelector('.highlight') as HTMLElement | null
                    const lines = target.parentElement?.querySelector('.line-numbers') as HTMLElement | null
                    if (layer) { layer.scrollTop = target.scrollTop; layer.scrollLeft = target.scrollLeft }
                    if (lines) lines.scrollTop = target.scrollTop
                  }} />
                </div>
              </div>
            </div>
          </div>

          <div className="actions">
            <p><span>TIP</span> Drag the corner to resize · Tab / Shift+Tab to indent</p>
            <div>
              <button className="copy-button" onClick={copyCode}>{copied ? <Check size={17} /> : <Copy size={17} />}{copied ? 'Copied' : 'Copy code'}</button>
              <button className="copy-button" onClick={copyImage} disabled={imageCopyStatus === 'copying'} title={imageCopyStatus === 'error' ? 'Your browser blocked or does not support copying images' : 'Copy the generated PNG to your clipboard'}>
                {imageCopyStatus === 'copied' ? <Check size={17} /> : <Clipboard size={17} />}
                {imageCopyStatus === 'copying' ? 'Copying…' : imageCopyStatus === 'copied' ? 'Copied image' : imageCopyStatus === 'error' ? 'Copy failed' : 'Copy image'}
              </button>
              <button className="download-button" onClick={downloadImage} disabled={exporting}><Download size={18} />{exporting ? 'Rendering…' : 'Download PNG'}</button>
            </div>
          </div>
        </section>
      </main>

      <footer>Made for developers who care about the details. <span>⌁</span></footer>
    </div>
  )
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char]!)
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="toggle"><button role="switch" aria-checked={checked} className={checked ? 'on' : ''} onClick={() => onChange(!checked)}><i /></button><span>{label}</span></label>
}
