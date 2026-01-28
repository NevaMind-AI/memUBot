import { DiscordMessageList } from './MessageList'

/**
 * Discord View - Main view for Discord chat
 */
export function DiscordView(): JSX.Element {
  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gradient-to-b from-[#5865F2]/5 to-transparent">
      <DiscordMessageList />
    </div>
  )
}
