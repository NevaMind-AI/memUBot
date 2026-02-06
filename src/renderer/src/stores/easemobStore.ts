import { create } from 'zustand'
import type { KickReason } from '../services/easemob/types'

interface EasemobStore {
  connected: boolean
  connecting: boolean
  error: string | null
  kickReason: KickReason | null // Reason if user was kicked offline
  setStatus: (status: Partial<Omit<EasemobStore, 'setStatus'>>) => void
}

export const useEasemobStore = create<EasemobStore>((set) => ({
  connected: false,
  connecting: false,
  error: null,
  kickReason: null,
  setStatus: (status) => set(status)
}))

export function setEasemobStatus(status: Partial<Omit<EasemobStore, 'setStatus'>>): void {
  useEasemobStore.setState(status)
}
