import { useState, useEffect, useRef } from 'react'
import { Bot, User, Hash } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

interface AppMessage {
  id: string
  platform: string
  chatId: string
  senderId: string
  senderName: string
  content: string
  timestamp: Date
  isFromBot: boolean
}

interface BotStatus {
  platform: string
  isConnected: boolean
  username?: string
  botName?: string
  avatarUrl?: string
}

export function SlackMessageList(): JSX.Element {
  const [messages, setMessages] = useState<AppMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [botAvatarUrl, setBotAvatarUrl] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadMessages()
    loadBotStatus()
  }, [])

  useEffect(() => {
    const unsubscribeMessages = window.slack.onNewMessage((message: AppMessage) => {
      setMessages((prev) => {
        const exists = prev.some((m) => m.id === message.id)
        if (exists) return prev
        return [...prev, { ...message, timestamp: new Date(message.timestamp) }]
      })
    })

    const unsubscribeStatus = window.slack.onStatusChanged((status: BotStatus) => {
      setBotAvatarUrl(status.avatarUrl || null)
    })

    return () => {
      unsubscribeMessages()
      unsubscribeStatus()
    }
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const loadMessages = async () => {
    setLoading(true)
    try {
      const result = await window.slack.getMessages(200)
      if (result.success && result.data) {
        const msgs = result.data.map((m) => ({
          ...m,
          timestamp: new Date(m.timestamp)
        }))
        setMessages(msgs)
      }
    } catch (error) {
      console.error('Failed to load messages:', error)
    }
    setLoading(false)
  }

  const loadBotStatus = async () => {
    try {
      const result = await window.slack.getStatus()
      if (result.success && result.data) {
        setBotAvatarUrl(result.data.avatarUrl || null)
      }
    } catch (error) {
      console.error('Failed to load bot status:', error)
    }
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const formatDate = (date: Date) => {
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (date.toDateString() === today.toDateString()) {
      return 'Today'
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday'
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#4A154B]/50 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#4A154B]/10 border border-[#4A154B]/20 shadow-lg flex items-center justify-center">
            <Hash className="w-7 h-7 text-[#4A154B]" />
          </div>
          <h2 className="text-[15px] font-semibold text-[var(--text-primary)] mb-1">
            No Messages Yet
          </h2>
          <p className="text-[13px] text-[var(--text-muted)] max-w-[220px]">
            Connect your Slack bot to start chatting.
          </p>
        </div>
      </div>
    )
  }

  // Group messages by date
  const groupedMessages: { date: string; messages: AppMessage[] }[] = []
  let currentDate = ''

  for (const msg of messages) {
    const msgDate = formatDate(msg.timestamp)
    if (msgDate !== currentDate) {
      currentDate = msgDate
      groupedMessages.push({ date: msgDate, messages: [] })
    }
    groupedMessages[groupedMessages.length - 1].messages.push(msg)
  }

  return (
    <div className="flex-1 overflow-y-auto px-5 py-4">
      <div className="max-w-xl mx-auto space-y-5">
        {groupedMessages.map((group, groupIndex) => (
          <div key={groupIndex}>
            {/* Date Separator */}
            <div className="flex items-center justify-center mb-4">
              <div className="px-3 py-1.5 rounded-full bg-[#4A154B]/10 border border-[#4A154B]/20 shadow-sm text-[11px] text-[#4A154B] font-medium">
                {group.date}
              </div>
            </div>

            {/* Messages */}
            <div className="space-y-3">
              {group.messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-2.5 ${msg.isFromBot ? 'flex-row-reverse' : ''}`}
                >
                  {/* Avatar */}
                  {msg.isFromBot ? (
                    botAvatarUrl ? (
                      <img
                        src={botAvatarUrl}
                        alt="Bot"
                        className="w-8 h-8 rounded-lg flex-shrink-0 object-cover border-2 border-[#4A154B] shadow-md"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center shadow-md bg-gradient-to-br from-[#4A154B] to-[#611F69]">
                        <Bot className="w-4 h-4 text-white" />
                      </div>
                    )
                  ) : (
                    <div className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center shadow-md bg-[var(--bg-card)] backdrop-blur-sm border border-[var(--glass-border)]">
                      <User className="w-4 h-4 text-[var(--text-muted)]" />
                    </div>
                  )}

                  {/* Message Bubble */}
                  <div className={`max-w-[70%] ${msg.isFromBot ? 'items-end' : 'items-start'}`}>
                    {!msg.isFromBot && (
                      <p className="text-[10px] text-[var(--text-muted)] mb-1 px-1">
                        {msg.senderName}
                      </p>
                    )}
                    <div
                      className={`px-4 py-2.5 rounded-lg shadow-sm ${
                        msg.isFromBot
                          ? 'bg-gradient-to-br from-[#4A154B]/20 to-[#611F69]/20 backdrop-blur-sm border border-[#4A154B]/30 rounded-tr-sm'
                          : 'bg-[var(--bg-card)] backdrop-blur-sm border border-[var(--glass-border)] rounded-tl-sm'
                      }`}
                    >
                      {msg.isFromBot ? (
                        <div className="markdown-content text-[13px] leading-relaxed text-[var(--text-primary)]">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <p className="text-[13px] whitespace-pre-wrap break-words leading-relaxed text-[var(--text-primary)]">
                          {msg.content}
                        </p>
                      )}
                    </div>
                    <p
                      className={`text-[10px] text-[var(--text-muted)] mt-1 px-1 ${msg.isFromBot ? 'text-right' : ''}`}
                    >
                      {formatTime(msg.timestamp)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div ref={messagesEndRef} />
    </div>
  )
}
