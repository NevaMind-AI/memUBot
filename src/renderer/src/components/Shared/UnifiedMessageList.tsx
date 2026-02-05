import { Loader2 } from 'lucide-react'
import { useMessageList, BaseMessage } from '../../hooks/useMessageList'
import { MessageBubble, ThemeColors, MessageAttachment } from './MessageBubble'
import { ComponentType, SVGProps } from 'react'

interface MessageApi {
  getMessages: (limit?: number) => Promise<{ success: boolean; data?: BaseMessage[] }>
  getStatus: () => Promise<{ success: boolean; data?: { avatarUrl?: string } }>
  onNewMessage: (callback: (message: BaseMessage) => void) => () => void
  onStatusChanged: (callback: (status: { avatarUrl?: string }) => void) => () => void
  onMessagesRefresh?: (callback: () => void) => () => void
}

interface UnifiedMessageListProps {
  api: MessageApi
  colors: ThemeColors
  emptyIcon: ComponentType<SVGProps<SVGSVGElement>>
  emptyTitle: string
  emptyDescription: string
  pageSize?: number
  platform?: 'telegram' | 'discord' | 'slack' | 'whatsapp' | 'line'
}

/**
 * Format date for display
 */
function formatDate(date: Date): string {
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

interface MessageWithAttachments extends BaseMessage {
  attachments?: MessageAttachment[]
}

/**
 * Unified Message List Component - Discord style
 * Shared across all platforms (Telegram, Discord, Slack, WhatsApp, Line)
 */
export function UnifiedMessageList({
  api,
  colors,
  emptyIcon: EmptyIcon,
  emptyTitle,
  emptyDescription,
  pageSize = 20,
  platform
}: UnifiedMessageListProps): JSX.Element {
  const {
    messages,
    loading,
    loadingMore,
    hasMore,
    botAvatarUrl,
    userAvatars,
    containerRef,
    messagesEndRef,
    handleScroll
  } = useMessageList({
    api,
    pageSize,
    platform
  })

  // Cast messages to include attachments
  const messagesWithAttachments = messages as MessageWithAttachments[]

  // Group messages by date
  const groupedMessages: { date: string; messages: MessageWithAttachments[] }[] = []
  let currentDate = ''

  for (const msg of messagesWithAttachments) {
    const msgDate = formatDate(msg.timestamp)
    if (msgDate !== currentDate) {
      currentDate = msgDate
      groupedMessages.push({ date: msgDate, messages: [msg] })
    } else {
      groupedMessages[groupedMessages.length - 1].messages.push(msg)
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-[var(--text-muted)]">Loading messages...</div>
      </div>
    )
  }

  // Empty state
  if (messagesWithAttachments.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: `color-mix(in srgb, ${colors.primary} 20%, transparent)` }}
          >
            <EmptyIcon
              className="w-8 h-8"
              style={{ color: colors.primaryDark || colors.primary }}
            />
          </div>
          <p className="text-[var(--text-muted)] text-sm">{emptyTitle}</p>
          <p className="text-[var(--text-muted)] text-xs mt-1">
            {emptyDescription}
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
          <Loader2
            className="w-5 h-5 animate-spin"
            style={{ color: colors.primaryDark || colors.primary }}
          />
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
            <div
              className="flex-1 h-px"
              style={{ backgroundColor: `color-mix(in srgb, ${colors.primary} 20%, transparent)` }}
            />
            <span
              className="px-3 text-[11px] font-medium"
              style={{ color: colors.primaryDark || colors.primary }}
            >
              {group.date}
            </span>
            <div
              className="flex-1 h-px"
              style={{ backgroundColor: `color-mix(in srgb, ${colors.primary} 20%, transparent)` }}
            />
          </div>

          {/* Messages */}
          {group.messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={{
                id: msg.id,
                senderId: msg.senderId,
                senderName: msg.senderName,
                content: msg.content,
                timestamp: msg.timestamp,
                isFromBot: msg.isFromBot,
                attachments: msg.attachments
              }}
              botAvatarUrl={botAvatarUrl}
              userAvatarUrl={msg.senderId ? userAvatars[msg.senderId] : undefined}
              colors={colors}
            />
          ))}
        </div>
      ))}
      <div ref={messagesEndRef} />
    </div>
  )
}
