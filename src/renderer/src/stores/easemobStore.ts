import { create } from 'zustand'

interface EasemobStore {
  connected: boolean
  connecting: boolean
  error: string | null
  setStatus: (status: Partial<Omit<EasemobStore, 'setStatus'>>) => void
}

export const useEasemobStore = create<EasemobStore>((set) => ({
  connected: false,
  connecting: false,
  error: null,
  setStatus: (status) => set(status)
}))

export function setEasemobStatus(status: Partial<Omit<EasemobStore, 'setStatus'>>): void {
  useEasemobStore.setState(status)
}
