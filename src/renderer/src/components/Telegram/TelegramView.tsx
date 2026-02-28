import { MessageList } from './MessageList'

export function TelegramView(): JSX.Element {
  return (
    <div className="flex-1 flex flex-col">
      <MessageList />
    </div>
  )
}
