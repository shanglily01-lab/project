/**
 * useSocket — Socket.io client hook for real-time updates.
 * Connects to the Syphonix backend and dispatches events to the store.
 */

import { useEffect, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { useSyphonixStore } from '@/store/syphonixStore'

export function useSocket() {
  const socketRef = useRef<Socket | null>(null)
  const setConnected = useSyphonixStore((s) => s.setConnected)
  const applySnapshot = useSyphonixStore((s) => s.applySnapshot)
  const setDecisions = useSyphonixStore((s) => s.setDecisions)
  const refresh = useSyphonixStore((s) => s.refresh)
  const bumpInbox = useSyphonixStore((s) => s.bumpInbox)

  useEffect(() => {
    const socket = io('/', { transports: ['websocket', 'polling'] })
    socketRef.current = socket

    socket.on('connect', () => {
      setConnected(true)
    })

    socket.on('disconnect', () => {
      setConnected(false)
    })

    socket.on('refresh', () => {
      void refresh()
    })

    socket.on('inbox-updated', () => {
      bumpInbox()
    })

    socket.on('snapshot', (data: Record<string, unknown>) => {
      applySnapshot(data)
    })

    socket.on('decision', (decisions: unknown) => {
      if (Array.isArray(decisions)) {
        setDecisions(decisions)
      }
    })

    socket.on('notification', (_data: unknown) => {
      // Notification handling (toast etc.) can be added later
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [setConnected, applySnapshot, setDecisions, refresh, bumpInbox])

  return socketRef
}
