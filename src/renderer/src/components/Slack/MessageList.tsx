import { User, Bot, MessageSquare, Loader2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { useMessageList } from '../../hooks/useMessageList'

/**
 * Slack Message List - Displays messages with Slack purple theme
 */
export function SlackMessageList(): JSX.Element {
  const {
    messages,
    loading,
    loadingMore,
    hasMore,
    botAvatarUrl,
    containerRef,
    messagesEndRef,
    handleScroll
  } = useMessageList({
    api: window.slack,
    pageSize: 20
  })

  const formatTime = (date: Date) => {
    const d = new Date(date)
    return d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatDate = (date: Date) => {
    const d = new Date(date)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (d.toDateString() === today.toDateString()) {
      return 'Today'
    } else if (d.toDateString() === yesterday.toDateString()) {
      return 'Yesterday'
    }
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
    })
  }

  // Group messages by date
  const groupedMessages: { date: string; messages: typeof messages }[] = []
  let currentDate = ''

  for (const msg of messages) {
    const msgDate = formatDate(msg.timestamp)
    if (msgDate !== currentDate) {
      currentDate = msgDate
      groupedMessages.push({ date: msgDate, messages: [msg] })
    } else {
      groupedMessages[groupedMessages.length - 1].messages.push(msg)
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-[var(--text-muted)]">Loading messages...</div>
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-[#611f69]/20 flex items-center justify-center mx-auto mb-4">
            <MessageSquare className="w-8 h-8 text-[#611f69]" />
          </div>
          <p className="text-[var(--text-muted)] text-sm">No messages yet</p>
          <p className="text-[var(--text-muted)] text-xs mt-1">
            Message the bot in Slack to start chatting
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto px-4 py-3"
      onScroll={handleScroll}
    >
      {/* Loading more indicator */}
      {loadingMore && (
        <div className="flex justify-center py-2">
          <Loader2 className="w-5 h-5 text-[#611f69] animate-spin" />
        </div>
      )}
      
      {/* Load more hint */}
      {hasMore && !loadingMore && (
        <div className="flex justify-center py-2">
          <span className="text-[11px] text-[var(--text-muted)]">Scroll up to load more</span>
        </div>
      )}

      {groupedMessages.map((group) => (
        <div key={group.date}>
          {/* Date Separator */}
          <div className="flex items-center justify-center my-4">
            <div className="flex-1 h-px bg-[#611f69]/20" />
            <span className="px-3 text-[11px] text-[#611f69] font-medium">{group.date}</span>
            <div className="flex-1 h-px bg-[#611f69]/20" />
          </div>

          {/* Messages */}
          {group.messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 mb-3 ${msg.isFromBot ? 'flex-row-reverse' : 'flex-row'}`}
            >
              {/* Avatar */}
              {msg.isFromBot ? (
                // Bot avatar - use actual avatar if available
                botAvatarUrl ? (
                  <img
                    src={botAvatarUrl}
                    alt="Bot"
                    className="w-8 h-8 rounded-lg flex-shrink-0 object-cover border-2 border-[#611f69]"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center bg-gradient-to-br from-[#611f69] to-[#8b4f99]">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                )
              ) : (
                // User avatar
                <div className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center bg-gradient-to-br from-[#8b4f99] to-[#611f69]">
                  <User className="w-4 h-4 text-white" />
                </div>
              )}

              {/* Message Bubble */}
              <div
                className={`max-w-[70%] overflow-hidden ${
                  msg.isFromBot
                    ? 'bg-[#611f69]/10 dark:bg-[#611f69]/20 border border-[#611f69]/20'
                    : 'bg-[#8b4f99]/10 dark:bg-[#8b4f99]/20 border border-[#8b4f99]/20'
                } rounded-2xl px-4 py-2`}
              >
                {/* Header */}
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`text-[12px] font-semibold ${
                      msg.isFromBot ? 'text-[#611f69]' : 'text-[#8b4f99]'
                    }`}
                  >
                    {msg.senderName}
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)]">
                    {formatTime(msg.timestamp)}
                  </span>
                </div>

                {/* Content */}
                {msg.content && (
                  msg.isFromBot ? (
                    <div className="text-[13px] text-[var(--text-primary)] prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-pre:my-2 prose-headings:text-[var(--text-primary)]" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                      <ReactMarkdown
                        components={{
                          code: ({ className, children, node, ...props }) => {
                            const isBlock = node?.position && className?.includes('language-')
                            return isBlock ? (
                              <code
                                className={`${className || ''} block p-2 rounded bg-slate-800 dark:bg-slate-900 text-slate-100 text-[12px]`}
                                style={{ 
                                  whiteSpace: 'pre-wrap',
                                  wordBreak: 'break-all',
                                  overflowWrap: 'anywhere'
                                }}
                                {...props}
                              >
                                {children}
                              </code>
                            ) : (
                              <code
                                className="px-1 py-0.5 rounded bg-[var(--bg-input)] text-[#611f69] text-[12px]"
                                style={{ 
                                  wordBreak: 'break-all',
                                  overflowWrap: 'anywhere'
                                }}
                                {...props}
                              >
                                {children}
                              </code>
                            )
                          },
                          pre: ({ children }) => (
                            <pre 
                              className="my-2 rounded-lg overflow-hidden"
                              style={{ 
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-all'
                              }}
                            >
                              {children}
                            </pre>
                          )
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-[13px] text-[var(--text-primary)]" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                      {msg.content}
                    </p>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      ))}
      <div ref={messagesEndRef} />
    </div>
  )
}
