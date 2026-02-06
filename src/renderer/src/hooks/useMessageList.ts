import { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react'

export interface BaseMessage {
  id: string
  platform: string
  chatId?: string
  senderId?: string
  senderName: string
  content: string
  timestamp: Date
  isFromBot: boolean
  replyToId?: string
  attachments?: unknown[]
}

export interface BotStatus {
  platform: string
  isConnected: boolean
  username?: string
  botName?: string
  avatarUrl?: string
}

// Map of senderId -> avatarUrl
export type UserAvatarMap = Record<string, string>

export interface MessageApi {
  getMessages: (limit?: number) => Promise<{ success: boolean; data?: BaseMessage[] }>
  getStatus: () => Promise<{ success: boolean; data?: BotStatus }>
  onNewMessage: (callback: (message: BaseMessage) => void) => () => void
  onStatusChanged: (callback: (status: BotStatus) => void) => () => void
  onMessagesRefresh?: (callback: () => void) => () => void
}

interface UseMessageListOptions {
  api: MessageApi
  pageSize?: number
  platform?: 'telegram' | 'discord' | 'slack' | 'whatsapp' | 'line'
}

interface UseMessageListReturn {
  messages: BaseMessage[]
  loading: boolean
  loadingMore: boolean
  hasMore: boolean
  botAvatarUrl: string | null
  userAvatars: UserAvatarMap
  containerRef: React.RefObject<HTMLDivElement>
  messagesEndRef: React.RefObject<HTMLDivElement>
  handleScroll: () => void
}

const DEFAULT_PAGE_SIZE = 20

/**
 * Custom hook for message list with pagination and auto-scroll
 */
export function useMessageList({ api, pageSize = DEFAULT_PAGE_SIZE, platform }: UseMessageListOptions): UseMessageListReturn {
  const [messages, setMessages] = useState<BaseMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [botAvatarUrl, setBotAvatarUrl] = useState<string | null>(null)
  const [userAvatars, setUserAvatars] = useState<UserAvatarMap>({})
  
  const containerRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const isInitialLoad = useRef(true)
  const allMessagesRef = useRef<BaseMessage[]>([]) // Store all fetched messages for pagination
  const currentOffset = useRef(0)
  
  // For scroll position preservation when loading older messages
  const scrollRestoreRef = useRef<{
    previousScrollHeight: number
    shouldRestore: boolean
  }>({ previousScrollHeight: 0, shouldRestore: false })

  // Load initial messages (latest N)
  const loadInitialMessages = useCallback(async () => {
    setLoading(true)
    try {
      const result = await api.getMessages(200) // Fetch all, but only show latest pageSize
      if (result.success && result.data) {
        const allMsgs = result.data.map((m) => ({
          ...m,
          timestamp: new Date(m.timestamp)
        }))
        allMessagesRef.current = allMsgs
        
        // Show only the latest pageSize messages initially
        const initialMessages = allMsgs.slice(-pageSize)
        setMessages(initialMessages)
        currentOffset.current = Math.max(0, allMsgs.length - pageSize)
        setHasMore(currentOffset.current > 0)
      }
    } catch (error) {
      console.error('Failed to load messages:', error)
    }
    setLoading(false)
  }, [api, pageSize])

  // Load more messages (older ones)
  const loadMoreMessages = useCallback(() => {
    if (loadingMore || !hasMore || currentOffset.current <= 0) return

    setLoadingMore(true)
    
    // Calculate new offset
    const newOffset = Math.max(0, currentOffset.current - pageSize)
    const additionalMessages = allMessagesRef.current.slice(newOffset, currentOffset.current)
    
    if (additionalMessages.length > 0) {
      // Save current scroll height BEFORE updating messages
      const container = containerRef.current
      if (container) {
        scrollRestoreRef.current = {
          previousScrollHeight: container.scrollHeight,
          shouldRestore: true
        }
      }
      
      setMessages((prev) => [...additionalMessages, ...prev])
      currentOffset.current = newOffset
      setHasMore(newOffset > 0)
    }
    
    setLoadingMore(false)
  }, [loadingMore, hasMore, pageSize])
  
  // Restore scroll position after DOM update (useLayoutEffect runs synchronously after DOM mutations)
  useLayoutEffect(() => {
    const container = containerRef.current
    const { previousScrollHeight, shouldRestore } = scrollRestoreRef.current
    
    if (container && shouldRestore && previousScrollHeight > 0) {
      // Calculate how much content was added at the top
      const newScrollHeight = container.scrollHeight
      const scrollDelta = newScrollHeight - previousScrollHeight
      
      // Restore scroll position to keep the same content visible
      container.scrollTop = scrollDelta
      
      // Reset the flag
      scrollRestoreRef.current = { previousScrollHeight: 0, shouldRestore: false }
    }
  }, [messages])

  // Load bot status
  const loadBotStatus = useCallback(async () => {
    try {
      const result = await api.getStatus()
      if (result.success && result.data) {
        setBotAvatarUrl(result.data.avatarUrl || null)
      }
    } catch (error) {
      console.error('Failed to load bot status:', error)
    }
  }, [api])

  // Load bound users' avatars
  const loadUserAvatars = useCallback(async () => {
    if (!platform) return
    try {
      const result = await window.security.getBoundUsers(platform)
      if (result.success && result.data) {
        const avatarMap: UserAvatarMap = {}
        for (const user of result.data) {
          if (user.avatarUrl) {
            // Use uniqueId as key (matches senderId in messages)
            avatarMap[user.uniqueId] = user.avatarUrl
            // Also add by numeric userId for backwards compatibility
            if (user.userId) {
              avatarMap[String(user.userId)] = user.avatarUrl
            }
          }
        }
        setUserAvatars(avatarMap)
      }
    } catch (error) {
      console.error('Failed to load user avatars:', error)
    }
  }, [platform])

  // Handle scroll event
  const handleScroll = useCallback(() => {
    const container = containerRef.current
    if (!container) return
    
    // Load more when scrolled near the top
    if (container.scrollTop < 100 && hasMore && !loadingMore) {
      loadMoreMessages()
    }
  }, [hasMore, loadingMore, loadMoreMessages])

  // Initial load
  useEffect(() => {
    loadInitialMessages()
    loadBotStatus()
    loadUserAvatars()
  }, [loadInitialMessages, loadBotStatus, loadUserAvatars])

  // Subscribe to new messages, status changes, and refresh events
  useEffect(() => {
    const unsubscribeMessages = api.onNewMessage((message: BaseMessage) => {
      const newMsg = { ...message, timestamp: new Date(message.timestamp) }
      
      // Add to all messages ref
      allMessagesRef.current = [...allMessagesRef.current, newMsg]
      
      // Add to displayed messages (checking for duplicates)
      setMessages((prev) => {
        const exists = prev.some((m) => m.id === message.id)
        if (exists) return prev
        return [...prev, newMsg]
      })
    })

    const unsubscribeStatus = api.onStatusChanged((status: BotStatus) => {
      setBotAvatarUrl(status.avatarUrl || null)
    })

    // Subscribe to messages refresh event (triggered after chat history deletion)
    const unsubscribeRefresh = api.onMessagesRefresh?.(() => {
      console.log('[useMessageList] Messages refresh event received, reloading...')
      loadInitialMessages()
    })

    return () => {
      unsubscribeMessages()
      unsubscribeStatus()
      unsubscribeRefresh?.()
    }
  }, [api, loadInitialMessages])

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messages.length === 0) return
    
    // Only auto-scroll for new messages (not when loading older ones)
    // Check if the new message was added at the end
    const lastMessage = messages[messages.length - 1]
    const allMessages = allMessagesRef.current
    const isNewMessage = allMessages.length > 0 && 
      allMessages[allMessages.length - 1]?.id === lastMessage?.id

    if (isInitialLoad.current) {
      // Instant scroll on initial load
      messagesEndRef.current?.scrollIntoView({ behavior: 'instant' })
      isInitialLoad.current = false
    } else if (isNewMessage) {
      // Smooth scroll for new messages
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  return {
    messages,
    loading,
    loadingMore,
    hasMore,
    botAvatarUrl,
    userAvatars,
    containerRef,
    messagesEndRef,
    handleScroll
  }
}
