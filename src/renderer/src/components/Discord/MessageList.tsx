import { User, Bot, FileIcon, Download, Loader2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useMessageList, BaseMessage } from '../../hooks/useMessageList'

interface MessageAttachment {
  id: string
  name: string
  url: string
  contentType?: string
  size: number
  width?: number
  height?: number
}

interface DiscordMessage extends BaseMessage {
  attachments?: MessageAttachment[]
}

/**
 * Format file size for display
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

/**
 * Check if attachment is an image
 */
function isImage(attachment: MessageAttachment): boolean {
  return attachment.contentType?.startsWith('image/') ?? false
}

/**
 * Check if attachment is a video
 */
function isVideo(attachment: MessageAttachment): boolean {
  return attachment.contentType?.startsWith('video/') ?? false
}

/**
 * Discord Message List - Displays messages with Discord purple theme
 */
export function DiscordMessageList(): JSX.Element {
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
    api: window.discord,
    pageSize: 20
  })

  // Cast messages to DiscordMessage for attachments support
  const discordMessages = messages as DiscordMessage[]

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
  const groupedMessages: { date: string; messages: DiscordMessage[] }[] = []
  let currentDate = ''

  for (const msg of discordMessages) {
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

  if (discordMessages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-[#5865F2]/20 flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8 text-[#5865F2]" />
          </div>
          <p className="text-[var(--text-muted)] text-sm">No messages yet</p>
          <p className="text-[var(--text-muted)] text-xs mt-1">
            @mention the bot in your Discord server to start chatting
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
          <Loader2 className="w-5 h-5 text-[#5865F2] animate-spin" />
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
            <div className="flex-1 h-px bg-[#5865F2]/20" />
            <span className="px-3 text-[11px] text-[#5865F2] font-medium">{group.date}</span>
            <div className="flex-1 h-px bg-[#5865F2]/20" />
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
                    className="w-8 h-8 rounded-full flex-shrink-0 object-cover border-2 border-[#5865F2]"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center bg-gradient-to-br from-[#5865F2] to-[#7289DA]">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                )
              ) : (
                // User avatar
                <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center bg-gradient-to-br from-[#9B84EE] to-[#5865F2]">
                  <User className="w-4 h-4 text-white" />
                </div>
              )}

              {/* Message Bubble */}
              <div
                className={`max-w-[70%] overflow-hidden ${
                  msg.isFromBot
                    ? 'bg-[#5865F2]/10 dark:bg-[#5865F2]/20 border border-[#5865F2]/20'
                    : 'bg-[#9B84EE]/10 dark:bg-[#9B84EE]/20 border border-[#9B84EE]/20'
                } rounded-2xl px-4 py-2`}
              >
                {/* Header */}
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`text-[12px] font-semibold ${
                      msg.isFromBot ? 'text-[#5865F2]' : 'text-[#9B84EE]'
                    }`}
                  >
                    {msg.senderName}
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)]">
                    {formatTime(msg.timestamp)}
                  </span>
                </div>

                {/* Attachments */}
                {msg.attachments && msg.attachments.length > 0 && (
                  <div className="mb-2 space-y-2">
                    {msg.attachments.map((att) => (
                      <div key={att.id}>
                        {isImage(att) ? (
                          // Image attachment
                          <a
                            href={att.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block"
                          >
                            <img
                              src={att.url}
                              alt={att.name}
                              className="max-w-full max-h-[300px] rounded-lg object-contain"
                              style={{
                                width: att.width ? Math.min(att.width, 400) : 'auto',
                                height: att.height
                                  ? Math.min(att.height, 300)
                                  : 'auto'
                              }}
                            />
                          </a>
                        ) : isVideo(att) ? (
                          // Video attachment
                          <video
                            src={att.url}
                            controls
                            className="max-w-full max-h-[300px] rounded-lg"
                            style={{
                              width: att.width ? Math.min(att.width, 400) : 'auto'
                            }}
                          />
                        ) : (
                          // Other file attachment
                          <a
                            href={att.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 p-2 rounded-lg bg-[var(--bg-input)] hover:bg-[var(--bg-hover)] transition-colors"
                          >
                            <FileIcon className="w-5 h-5 text-[var(--text-muted)]" />
                            <div className="flex-1 min-w-0">
                              <p className="text-[12px] text-[var(--text-primary)] truncate">
                                {att.name}
                              </p>
                              <p className="text-[10px] text-[var(--text-muted)]">
                                {formatFileSize(att.size)}
                              </p>
                            </div>
                            <Download className="w-4 h-4 text-[var(--text-muted)]" />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Content */}
                {msg.content && (
                  msg.isFromBot ? (
                    <div className="text-[13px] text-[var(--text-primary)] prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-pre:my-2 prose-headings:text-[var(--text-primary)]" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          code: ({ className, children, node, ...props }) => {
                            // Check if this is inside a <pre> tag (code block vs inline code)
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
                                className="px-1 py-0.5 rounded bg-[var(--bg-input)] text-[#5865F2] text-[12px]"
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
