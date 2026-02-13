import { useState, useEffect } from 'react'
import type { ChangelogData } from '../types'
import { APP_VERSION } from '../version'

interface ChangelogModalProps {
  visible: boolean
  version?: string
  onClose: () => void
}

export function ChangelogModal({ visible, version = APP_VERSION, onClose }: ChangelogModalProps) {
  const [changelog, setChangelog] = useState<ChangelogData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (visible) {
      fetchChangelog()
    }
  }, [visible, version])

  const fetchChangelog = async () => {
    setLoading(true)
    setError(null)

    try {
      // Use IPC to fetch from main process (bypasses CORS)
      const data = await window.electronAPI.fetchChangelogFromMain(version)
      setChangelog(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load changelog')
    } finally {
      setLoading(false)
    }
  }

  const sections = [
    { key: 'added', title: 'ADDED', icon: '▲', items: changelog?.sections.added || [], color: '#00ff88' },
    { key: 'changed', title: 'CHANGED', icon: '◈', items: changelog?.sections.changed || [], color: '#00d4ff' },
    { key: 'fixed', title: 'FIXED', icon: '◆', items: changelog?.sections.fixed || [], color: '#ffaa00' },
    { key: 'removed', title: 'REMOVED', icon: '✕', items: changelog?.sections.removed || [], color: '#ff3366' },
  ] as const

  if (!visible) return null

  return (
    <div className="changelog-brutal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="changelog-brutal-container">
        {/* Scanline overlay */}
        <div className="changelog-scanlines" />

        {/* Header bar */}
        <div className="changelog-brutal-header">
          <div className="changelog-header-left">
            <span className="changelog-brutal-icon">◈</span>
            <span className="changelog-brutal-title">CHANGELOG</span>
          </div>
          <div className="changelog-header-right">
            <span className="changelog-brutal-version">v{version}</span>
            <span className="changelog-brutal-status">RELEASE NOTES</span>
          </div>
        </div>

        {/* Decorative line */}
        <div className="changelog-brutal-divider">
          <div className="divider-accent" />
          <div className="divider-main" />
        </div>

        {/* Content area */}
        <div className="changelog-brutal-content">
          {loading && (
            <div className="changelog-brutal-loading">
              <div className="loading-terminal">
                <span className="loading-prompt">{'>'}</span>
                <span className="loading-text">FETCHING_RELEASE_NOTES</span>
                <span className="loading-cursor">█</span>
              </div>
              <div className="loading-bar">
                <div className="loading-bar-fill" />
              </div>
            </div>
          )}

          {error && (
            <div className="changelog-brutal-error">
              <div className="error-header">
                <span className="error-icon">[!]</span>
                <span className="error-label">ERROR</span>
              </div>
              <div className="error-message">{error}</div>
              <button className="error-retry" onClick={fetchChangelog}>
                [ RETRY ]
              </button>
            </div>
          )}

          {!loading && !error && changelog && (
            <div className="changelog-brutal-sections">
              {sections.map((section) => (
                section.items.length > 0 && (
                  <div key={section.key} className="changelog-brutal-section">
                    <div className="section-header">
                      <span className="section-icon" style={{ color: section.color }}>{section.icon}</span>
                      <span className="section-title" style={{ color: section.color }}>{section.title}</span>
                      <span className="section-count">{section.items.length}</span>
                    </div>
                    <div className="section-items">
                      {section.items.map((item, index) => (
                        <div key={index} className="section-item">
                          <span className="item-bullet" style={{ color: section.color }}>—</span>
                          <span className="item-text">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              ))}

              {sections.every(s => s.items.length === 0) && (
                <div className="changelog-brutal-empty">
                  <span className="empty-icon">[ ]</span>
                  <span className="empty-text">NO_CHANGELOG_ENTRIES_FOUND</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="changelog-brutal-footer">
          <div className="footer-left">
            <span className="footer-label">VIDGRAB</span>
            <span className="footer-sep">//</span>
            <span className="footer-version">{version}</span>
          </div>
          <button className="changelog-brutal-btn" onClick={onClose}>
            <span className="btn-bracket">[</span>
            <span className="btn-text">CONTINUE</span>
            <span className="btn-bracket">]</span>
          </button>
        </div>
      </div>
    </div>
  )
}
