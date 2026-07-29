import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import Sidebar from './components/Sidebar'
import Dashboard from './components/Dashboard'
import MarkdownViewer from './components/MarkdownViewer'
import MonthView from './components/MonthView'
import Header from './components/Header'
import DailyTracker from './components/DailyTracker'
import StarField from './components/StarField'
import SearchModal from './components/SearchModal'
import PomodoroTimer from './components/PomodoroTimer'
import Login from './components/Login'
import TodoReminder from './components/TodoReminder'
import ReminderAlarm from './components/ReminderAlarm'
import ThemePicker from './components/ThemePicker'
import { buildFileTree } from './utils/parseFiles'
import { useProgress } from './hooks/useProgress'
import { useTheme } from './hooks/useTheme'
import { useNotes } from './hooks/useNotes'
import { useProblems } from './hooks/useProblems'
import { useAuth } from './hooks/useAuth'

const rawFiles = import.meta.glob(
  ['../desgin.md', '../FAANG-Preparation/**/*.md'],
  { query: '?raw', import: 'default', eager: true }
)

function AppShell() {
  const [selectedFile, setSelectedFile] = useState(null)
  const [selectedMonth, setSelectedMonth] = useState(null)
  const [sidebarOpen,  setSidebarOpen]  = useState(true)
  const [dailyOpen,    setDailyOpen]    = useState(false)
  const [searchOpen,   setSearchOpen]   = useState(false)
  const [noteOpen,     setNoteOpen]     = useState(false)
  const [todoOpen,        setTodoOpen]        = useState(false)
  const [themePickerOpen, setThemePickerOpen] = useState(false)

  const { user, logout } = useAuth()
  const fileTree = useMemo(() => buildFileTree(rawFiles), [])
  const progress = useProgress()
  const streak   = progress.getStreak()
  const { theme, setTheme } = useTheme()
  const { notes, getNote, saveNote, deleteNote } = useNotes()
  const problems = useProblems()

  const sidebarTimerRef = useRef(null)
  const resetSidebarTimer = useCallback(() => {
    clearTimeout(sidebarTimerRef.current)
    sidebarTimerRef.current = setTimeout(() => setSidebarOpen(false), 10000)
  }, [])

  useEffect(() => {
    if (sidebarOpen) resetSidebarTimer()
    else clearTimeout(sidebarTimerRef.current)
    return () => clearTimeout(sidebarTimerRef.current)
  }, [sidebarOpen, resetSidebarTimer])

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(o => !o)
      }
    }
    globalThis.addEventListener('keydown', handler)
    return () => globalThis.removeEventListener('keydown', handler)
  }, [])

  const handleLock = useCallback(async () => {
    await logout()
    setSelectedFile(null)
    setSelectedMonth(null)
    setNoteOpen(false)
    setTodoOpen(false)
    setSidebarOpen(true)
  }, [logout])

  const handleSelectFile = (file) => {
    setSelectedFile(file)
    setNoteOpen(false)
    if (window.innerWidth < 768) setSidebarOpen(false)
  }

  const handleSelectMonth = (month) => {
    setSelectedMonth(month)
    setSelectedFile(null)
    setNoteOpen(false)
  }

  const handleBack = () => {
    if (selectedFile && selectedMonth) {
      setSelectedFile(null)
      setNoteOpen(false)
    } else {
      setSelectedFile(null)
      setSelectedMonth(null)
      setNoteOpen(false)
    }
  }

  return (
    <div className="app">
      <StarField theme={theme} />

      {!sidebarOpen && (
        <div className="sidebar-edge-hover" aria-hidden="true" onMouseEnter={() => setSidebarOpen(true)} />
      )}

      <Sidebar
        fileTree={fileTree}
        selectedFile={selectedFile}
        onSelectFile={handleSelectFile}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        progress={progress}
        notes={notes}
        onMouseActivity={resetSidebarTimer}
      />

      <div className={`main-layout ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <Header
          selectedFile={selectedFile}
          selectedMonth={selectedMonth}
          onBack={handleBack}
          onToggleSidebar={() => setSidebarOpen(o => !o)}
          onOpenDaily={() => setDailyOpen(true)}
          onOpenSearch={() => setSearchOpen(true)}
          onToggleNotes={() => setNoteOpen(o => !o)}
          noteOpen={noteOpen}
          hasNote={!!(selectedFile && getNote(selectedFile.id)?.text)}
          streak={streak}
          theme={theme}
          onToggleTheme={null}
          onOpenThemePicker={() => setThemePickerOpen(true)}
          onLock={handleLock}
          onOpenTodo={() => setTodoOpen(true)}
          user={user}
        />

        <main className="main-content">
          {(() => {
            if (selectedFile) return (
              <MarkdownViewer
                key={selectedFile.id}
                file={selectedFile}
                isStudied={progress.isStudied(selectedFile.id)}
                onMarkStudied={progress.markStudied}
                onUnmark={() => progress.unmarkStudied(selectedFile.id)}
                note={getNote(selectedFile.id)}
                onNoteChange={saveNote}
                problems={problems}
                noteOpen={noteOpen}
                onToggleNotes={() => setNoteOpen(o => !o)}
              />
            )
            if (selectedMonth) return (
              <MonthView
                key={selectedMonth.key}
                month={selectedMonth}
                progress={progress}
                problems={problems}
                onSelectFile={handleSelectFile}
              />
            )
            return (
              <Dashboard
                fileTree={fileTree}
                onSelectFile={handleSelectFile}
                onSelectMonth={handleSelectMonth}
                progress={progress}
                problems={problems}
                theme={theme}
                notes={notes}
                onDeleteNote={deleteNote}
                onEditNote={(file) => { handleSelectFile(file); setNoteOpen(true) }}
                onOpenTodo={() => setTodoOpen(true)}
                onOpenDaily={() => setDailyOpen(true)}
              />
            )
          })()}
        </main>
      </div>

      <DailyTracker
        isOpen={dailyOpen}
        onClose={() => setDailyOpen(false)}
        progress={progress}
        fileTree={fileTree}
      />

      <SearchModal
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        fileTree={fileTree}
        onSelectFile={(f) => { handleSelectFile(f); setSearchOpen(false) }}
      />

      <PomodoroTimer onSessionComplete={progress.logPomodoro} />

      <TodoReminder isOpen={todoOpen} onClose={() => setTodoOpen(false)} />
      <ReminderAlarm />
      <ThemePicker
        isOpen={themePickerOpen}
        onClose={() => setThemePickerOpen(false)}
        currentTheme={theme}
        onSetTheme={setTheme}
      />
    </div>
  )
}

export default function App() {
  const { isAuthenticated, loading, syncing, syncReady, user, guest } = useAuth()

  if (loading || (isAuthenticated && user && (syncing || !syncReady))) {
    return (
      <div className="login-bg login-boot">
        <div className="login-orb login-orb-1" />
        <div className="login-orb login-orb-2" />
        <div className="login-boot-card">
          <span className="login-spinner" />
          <p>{syncing ? 'Syncing your progress…' : 'Loading…'}</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) return <Login />

  const syncKey = user?.uid || (guest ? 'guest' : 'anon')
  return <AppShell key={syncKey} />
}
