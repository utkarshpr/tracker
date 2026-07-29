const TOPIC_META = {
  'desgin': { icon: '📋', color: '#94a3b8' },
  'Daily-Routine': { icon: '📅', color: '#f59e0b' },
  'DSA': { icon: '🧮', color: '#6366f1' },
  'DB-Fundamentals': { icon: '🗄️', color: '#3b82f6' },
  'Java-Core': { icon: '☕', color: '#f97316' },
  'Python-Core': { icon: '🐍', color: '#3b82f6' },
  'Redis-Basics': { icon: '🔴', color: '#ef4444' },
  'Docker-Basics': { icon: '🐳', color: '#0ea5e9' },
  'GoLang-Core': { icon: '🔷', color: '#06b6d4' },
  'LLD-Basics': { icon: '🏗️', color: '#8b5cf6' },
  'Advanced-DSA': { icon: '⚡', color: '#a855f7' },
  'Advanced-LLD': { icon: '🔧', color: '#d946ef' },
  'Cloud-Engineering': { icon: '☁️', color: '#38bdf8' },
  'Concurrency': { icon: '⚙️', color: '#10b981' },
  'DSA-Traps': { icon: '⚠️', color: '#f59e0b' },
  'Distributed-Systems': { icon: '🌐', color: '#6366f1' },
  'HLD-Core': { icon: '🏛️', color: '#8b5cf6' },
  'Kafka-Internals': { icon: '📨', color: '#ec4899' },
  'CDN-MessageQueue': { icon: '📡', color: '#f59e0b' },
  'Behavioral': { icon: '🤝', color: '#22d3ee' },
  'FAANG-System-Design': { icon: '🏢', color: '#34d399' },
  'Leadership': { icon: '👑', color: '#fbbf24' },
  'Mock-Interviews': { icon: '🎯', color: '#f87171' },
  'Production-Engineering': { icon: '🚀', color: '#818cf8' },
  'Revision': { icon: '📝', color: '#a3e635' },
  'Scalability': { icon: '📈', color: '#2dd4bf' },
  'SDE3-More-Tech-Questions': { icon: '💡', color: '#fb923c' },
  'SDE3-Real-Interview-Questions': { icon: '🎙️', color: '#c084fc' },
  'LLM-Agentic-AI': { icon: '🤖', color: '#a78bfa' },
  'System-Design-Handbook': { icon: '📚', color: '#34d399' },
}

const SECTION_META = {
  'Overview': { label: 'Overview', subtitle: 'Master Plan', color: '#94a3b8', order: 0 },
  'Daily-Schedule': { label: 'Daily Schedule', subtitle: 'Routine', color: '#f59e0b', order: 1 },
  'Month-1': { label: 'Month 1', subtitle: 'Fundamentals', color: '#6366f1', order: 2 },
  'Month-2': { label: 'Month 2', subtitle: 'Advanced Topics', color: '#a855f7', order: 3 },
  'Month-3': { label: 'Month 3', subtitle: 'Interview Prep', color: '#22d3ee', order: 4 },
}

export function formatName(filename) {
  return filename
    .replace(/\.md$/, '')
    .replaceAll('-', ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

export function buildFileTree(rawFiles) {
  const sections = {}
  const allFiles = []

  for (const [path, content] of Object.entries(rawFiles)) {
    const cleanPath = path.replace(/^\.\.\//, '').replace(/^\.\//, '')
    const parts = cleanPath.split('/')
    const filename = parts.at(-1)
    const base = filename.replace(/\.md$/, '')
    const meta = TOPIC_META[base] || { icon: '📄', color: '#94a3b8' }

    const text = typeof content === 'string' ? content : ''
    const words = text.split(/\s+/).filter(Boolean).length
    const readTime = Math.max(1, Math.ceil(words / 220))

    let description = ''
    const lines = text.split('\n')
    for (let i = 1; i < Math.min(lines.length, 15); i++) {
      const line = lines[i].trim()
      if (line && !line.startsWith('#') && !line.startsWith('---') && !line.startsWith('```') && line.length > 30) {
        description = line.replace(/[*_`>-]/g, '').trim().slice(0, 120)
        break
      }
    }

    const file = {
      id: cleanPath,
      name: formatName(filename),
      filename,
      path: cleanPath,
      content: text,
      icon: meta.icon,
      color: meta.color,
      readTime,
      wordCount: words,
      description: description || 'Study materials for FAANG preparation',
    }

    allFiles.push(file)

    let sectionKey
    if (parts.length === 1) sectionKey = 'Overview'
    else if (parts.length === 2) sectionKey = 'Daily-Schedule'
    else sectionKey = parts.at(-2)

    if (!sections[sectionKey]) {
      const sm = SECTION_META[sectionKey] || {
        label: formatName(sectionKey),
        subtitle: '',
        color: '#94a3b8',
        order: 99,
      }
      sections[sectionKey] = { key: sectionKey, ...sm, files: [] }
    }
    sections[sectionKey].files.push(file)
  }

  const sorted = Object.values(sections).sort((a, b) => a.order - b.order)
  sorted.forEach(s => s.files.sort((a, b) => a.filename.localeCompare(b.filename)))

  return { sections: sorted, allFiles }
}

export function extractTOC(content) {
  const headings = []
  let inCode = false
  for (const line of content.split('\n')) {
    if (line.startsWith('```')) { inCode = !inCode; continue }
    if (inCode) continue
    const m = line.match(/^(#{1,4})\s+(.+)/)
    if (m) {
      const level = m[1].length
      const text = m[2].replace(/[*_`[\]]/g, '').trim()
      const id = text.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-').replace(/^-|-$/g, '')
      headings.push({ level, text, id })
    }
  }
  return headings
}

export function extractTasksFromMd(content) {
  const tasks = []
  for (const line of content.split('\n')) {
    const m = line.match(/^[-*+]\s+\[([x ])\]\s+(.+)/i)
    if (m) tasks.push({ checked: m[1].toLowerCase() === 'x', text: m[2].trim() })
  }
  return tasks
}
