import { useState, useEffect } from 'react'
import type { UpdateInfo, UpdateProgress } from '../types'

interface UpdateModalProps {
  visible: boolean
  updateInfo: UpdateInfo | null
  downloading: boolean
  downloaded: boolean
  progress: UpdateProgress | null
  error: string | null
  onDownload: () => void
  onInstall: () => void
  onClose: () => void
}

export function UpdateModal({
  visible,
  updateInfo,
  downloading,
  downloaded,
  progress,
  error,
  onDownload,
  onInstall,
  onClose,
}: UpdateModalProps) {
  const [linuxFilePath, setLinuxFilePath] = useState<string | null>(null)

  useEffect(() => {
    // Listen for Linux-specific install instructions
    const unsubDeb = window.electronAPI.onLinuxDeb((filePath) => {
      setLinuxFilePath(filePath)
    })
    const unsubAppImage = window.electronAPI.onLinuxAppImage((filePath) => {
      setLinuxFilePath(filePath)
    })

    return () => {
      unsubDeb()
      unsubAppImage()
    }
  }, [])

  if (!visible || !updateInfo) return null

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
  }

  const formatSpeed = (bytesPerSecond: number): string => {
    return `${formatBytes(bytesPerSecond)}/s`
  }

  const isLinux = navigator.platform.toLowerCase().includes('linux')

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && !downloading && onClose()}>
      <div className="modal update-modal">
        {/* Header */}
        <div className="update-modal-header">
          <div className="update-modal-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </div>
          <div className="update-modal-title">
            {downloaded ? 'UPDATE READY' : downloading ? 'DOWNLOADING UPDATE' : 'UPDATE AVAILABLE'}
          </div>
          <div className="update-modal-version">
            v{updateInfo.currentVersion} → <span className="version-new">v{updateInfo.version}</span>
          </div>
        </div>

        {/* Content */}
        <div className="update-modal-content">
          {error && (
            <div className="update-error">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
              </svg>
              {error}
            </div>
          )}

          {downloading && progress && (
            <div className="update-progress-section">
              <div className="update-progress-bar">
                <div
                  className="update-progress-fill"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
              <div className="update-progress-stats">
                <span>{progress.percent}%</span>
                <span>{formatBytes(progress.transferred)} / {formatBytes(progress.total)}</span>
                <span>{formatSpeed(progress.bytesPerSecond)}</span>
              </div>
            </div>
          )}

          {downloaded && !linuxFilePath && !isLinux && (
            <div className="update-ready-message">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <p>Update downloaded successfully!</p>
              <p className="update-ready-hint">Click "Restart & Install" to complete the update.</p>
            </div>
          )}

          {downloaded && linuxFilePath && isLinux && (
            <div className="update-ready-message">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <p>Update downloaded successfully!</p>
              <p className="update-file-path">File saved to: {linuxFilePath}</p>
              {linuxFilePath.endsWith('.deb') && (
                <div className="linux-install-command">
                  <code>sudo dpkg -i {linuxFilePath.split('/').pop()}</code>
                </div>
              )}
            </div>
          )}

          {!downloading && !downloaded && (
            <>
              <div className="update-info-section">
                <div className="update-info-label">Release Date</div>
                <div className="update-info-value">
                  {new Date(updateInfo.releaseDate).toLocaleDateString()}
                </div>
              </div>

              {updateInfo.releaseNotes && (
                <div className="update-notes-preview">
                  <div className="update-info-label">What's New</div>
                  <div className="update-notes-content">
                    {updateInfo.releaseNotes.split('\n').slice(0, 10).map((line, index) => (
                      <div key={index} className={line.startsWith('#') ? 'update-notes-header' : 'update-notes-line'}>
                        {line.replace(/^#+\s*/, '').replace(/^\*\*(.+)\*\*/, '$1')}
                      </div>
                    ))}
                    {updateInfo.releaseNotes.split('\n').length > 10 && (
                      <div className="update-notes-more">...</div>
                    )}
                  </div>
                </div>
              )}

              {updateInfo.mandatory && (
                <div className="update-mandatory-notice">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--warning)">
                    <path d="M12 2L1 21h22L12 2zm0 3.5L19.5 19h-15L12 5.5zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z" />
                  </svg>
                  This is a mandatory update containing critical fixes
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="update-modal-footer">
          {!downloading && !downloaded && (
            <>
              {!updateInfo.mandatory && (
                <button className="btn-secondary" onClick={onClose}>
                  LATER
                </button>
              )}
              <button className="btn-primary" onClick={onDownload}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                DOWNLOAD & INSTALL
              </button>
            </>
          )}

          {downloading && (
            <button className="btn-secondary" onClick={() => window.electronAPI.cancelUpdate()}>
              CANCEL
            </button>
          )}

          {downloaded && !isLinux && (
            <button className="btn-primary" onClick={onInstall}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
              RESTART & INSTALL
            </button>
          )}

          {downloaded && isLinux && (
            <button className="btn-primary" onClick={onClose}>
              CLOSE
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
