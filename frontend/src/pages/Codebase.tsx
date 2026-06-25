/**
 * Codebase — Placeholder for git integration.
 */

import { GitBranch } from 'lucide-react'

export default function Codebase() {
  return (
    <div className="page">
      <div className="page-title">
        Codebase
        <span className="subtitle">Repository and code analysis</span>
      </div>

      <div className="card" style={{ maxWidth: 500 }}>
        <div className="card-body" style={{ padding: 40, textAlign: 'center' }}>
          <GitBranch size={48} style={{ color: 'var(--accent)', marginBottom: 16 }} />
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
            Git Integration Coming Soon
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 20, lineHeight: 1.5 }}>
            Connect your repositories to track commits, branches, and code changes
            alongside your project management data.
          </div>
          <button className="btn btn-accent">
            <GitBranch size={14} />
            Add Repository
          </button>
        </div>
      </div>
    </div>
  )
}
