/**
 * Syphonix Zustand Store — state management for all ops data.
 * Uses Immer for immutable updates.
 */

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { get, post } from '@/api/client'
import type {
  TaskState, PersonState, ProjectState, Change,
  Decision, Alert, AgentResult,
} from '@/types'

export interface SyphonixState {
  // Data
  tasks: TaskState[]
  persons: PersonState[]
  projects: ProjectState[]
  changes: Change[]
  decisions: Decision[]
  alerts: Alert[]
  agentResults: AgentResult[]
  isConnected: boolean
  lastRefresh: string | null
  inboxVersion: number // bumped on socket 'inbox-updated' → panels refetch

  // Loading
  loading: boolean
  error: string | null

  // Actions
  refresh: () => Promise<void>
  approveDecision: (id: string, by: string) => Promise<void>
  rejectDecision: (id: string, by: string, reason?: string) => Promise<void>
  setConnected: (v: boolean) => void
  bumpInbox: () => void
  setTasks: (tasks: TaskState[]) => void
  setPersons: (persons: PersonState[]) => void
  setProjects: (projects: ProjectState[]) => void
  setChanges: (changes: Change[]) => void
  setDecisions: (decisions: Decision[]) => void
  setAlerts: (alerts: Alert[]) => void
  setAgentResults: (results: AgentResult[]) => void
  applySnapshot: (snapshot: Record<string, unknown>) => void
}

export const useSyphonixStore = create<SyphonixState>()(
  immer((set) => ({
    tasks: [],
    persons: [],
    projects: [],
    changes: [],
    decisions: [],
    alerts: [],
    agentResults: [],
    isConnected: false,
    lastRefresh: null,
    inboxVersion: 0,

    loading: false,
    error: null,

    refresh: async () => {
      set((d) => { d.loading = true; d.error = null })
      try {
        const [tasks, persons, projects, changes, decisions] = await Promise.all([
          get<TaskState[]>('/data/tasks'),
          get<PersonState[]>('/data/persons'),
          get<ProjectState[]>('/data/projects'),
          get<Change[]>('/data/changes'),
          get<Decision[]>('/decisions'),
        ])
        set((d) => {
          d.tasks = tasks
          d.persons = persons
          d.projects = projects
          d.changes = changes
          d.decisions = decisions
          d.loading = false
          d.lastRefresh = new Date().toISOString()
        })
      } catch (e) {
        set((d) => { d.loading = false; d.error = (e as Error).message })
      }
    },

    approveDecision: async (id, by) => {
      await post(`/decisions/${id}/approve`, { by })
      set((d) => {
        const dec = d.decisions.find((x) => x.id === id)
        if (dec) {
          dec.status = 'APPROVED'
          dec.respondedBy = by
          dec.respondedAt = new Date().toISOString()
        }
      })
    },

    rejectDecision: async (id, by, reason) => {
      await post(`/decisions/${id}/reject`, { by, reason })
      set((d) => {
        const dec = d.decisions.find((x) => x.id === id)
        if (dec) {
          dec.status = 'REJECTED'
          dec.respondedBy = by
          dec.rejectReason = reason
          dec.respondedAt = new Date().toISOString()
        }
      })
    },

    setConnected: (v) => { set((d) => { d.isConnected = v }) },
    bumpInbox: () => { set((d) => { d.inboxVersion++ }) },
    setTasks: (tasks) => { set((d) => { d.tasks = tasks }) },
    setPersons: (persons) => { set((d) => { d.persons = persons }) },
    setProjects: (projects) => { set((d) => { d.projects = projects }) },
    setChanges: (changes) => { set((d) => { d.changes = changes }) },
    setDecisions: (decisions) => { set((d) => { d.decisions = decisions }) },
    setAlerts: (alerts) => { set((d) => { d.alerts = alerts }) },
    setAgentResults: (results) => { set((d) => { d.agentResults = results }) },

    applySnapshot: (snapshot) => {
      set((d) => {
        if (snapshot.tasks) d.tasks = snapshot.tasks as TaskState[]
        if (snapshot.persons) d.persons = snapshot.persons as PersonState[]
        if (snapshot.projects) d.projects = snapshot.projects as ProjectState[]
        if (snapshot.changes) d.changes = snapshot.changes as Change[]
        if (snapshot.decisions) d.decisions = snapshot.decisions as Decision[]
        if (snapshot.alerts) d.alerts = snapshot.alerts as Alert[]
        d.lastRefresh = new Date().toISOString()
      })
    },
  })),
)
