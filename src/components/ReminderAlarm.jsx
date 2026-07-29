import { useAlarm } from '../hooks/useAlarm'

export default function ReminderAlarm() {
  const { firedReminder, snooze, complete, dismiss } = useAlarm()

  if (!firedReminder) return null

  const timeStr = new Date(firedReminder.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="alarm-overlay">
      <div className="alarm-popup">
        <div className="alarm-pulse-ring" />
        <div className="alarm-icon-wrap">
          <span className="alarm-icon">⏰</span>
        </div>
        <div className="alarm-label">Reminder</div>
        <div className="alarm-time">{timeStr}</div>
        <div className="alarm-text">{firedReminder.text}</div>

        <div className="alarm-snooze-row">
          <span className="alarm-snooze-label">Snooze for</span>
          {[5, 10, 15].map(m => (
            <button
              key={m}
              className="alarm-snooze-btn"
              onClick={() => snooze(firedReminder.id, m)}
            >
              {m}m
            </button>
          ))}
        </div>

        <div className="alarm-action-row">
          <button className="alarm-done-btn" onClick={() => complete(firedReminder.id)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Done
          </button>
          <button className="alarm-delete-btn" onClick={() => dismiss(firedReminder.id)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}
