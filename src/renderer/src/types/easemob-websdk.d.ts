/**
 * Type declarations for easemob-websdk
 *
 * This is a simplified type declaration for the Easemob Web SDK.
 * Full types can be found at: https://www.easemob.com/apidoc/Web/modules.html
 */

declare module 'easemob-websdk' {
  interface ConnectionOptions {
    appKey: string
    url?: string
    apiUrl?: string
  }

  interface OpenOptions {
    user: string
    accessToken: string
    agoraToken?: string
  }

  interface MessageBase {
    id: string
    from: string
    to: string
    time: number
    chatType?: 'singleChat' | 'groupChat' | 'chatRoom'
  }

  interface TextMsgBody extends MessageBase {
    type: 'txt'
    msg: string
  }

  interface ImgMsgBody extends MessageBase {
    type: 'img'
    url: string
    width?: number
    height?: number
    filename?: string
  }

  interface AudioMsgBody extends MessageBase {
    type: 'audio'
    url: string
    length?: number
    filename?: string
  }

  interface VideoMsgBody extends MessageBase {
    type: 'video'
    url: string
    width?: number
    height?: number
    length?: number
    filename?: string
  }

  interface FileMsgBody extends MessageBase {
    type: 'file'
    url: string
    filename?: string
    size?: number
  }

  interface CustomMsgBody extends MessageBase {
    type: 'custom'
    customEvent: string
    customExts: Record<string, unknown>
  }

  interface CreateTextMessageOptions {
    type: 'txt'
    chatType: 'singleChat' | 'groupChat' | 'chatRoom'
    to: string
    msg: string
  }

  interface CreateCustomMessageOptions {
    type: 'custom'
    chatType: 'singleChat' | 'groupChat' | 'chatRoom'
    to: string
    customEvent: string
    customExts: Record<string, unknown>
  }

  interface SendResult {
    serverMsgId: string
    localMsgId?: string
  }

  interface ConnectionEventHandlers {
    onConnected?: () => void
    onDisconnected?: () => void
    onReconnecting?: () => void
    onError?: (error: { message: string; type?: string }) => void
  }

  interface MessageEventHandlers {
    onTextMessage?: (message: TextMsgBody) => void
    onImageMessage?: (message: ImgMsgBody) => void
    onAudioMessage?: (message: AudioMsgBody) => void
    onVideoMessage?: (message: VideoMsgBody) => void
    onFileMessage?: (message: FileMsgBody) => void
    onCustomMessage?: (message: CustomMsgBody) => void
  }

  class connection {
    constructor(options: ConnectionOptions)
    open(options: OpenOptions): Promise<void>
    close(): Promise<void>
    addEventHandler(
      id: string,
      handlers: ConnectionEventHandlers | MessageEventHandlers
    ): void
    removeEventHandler(id: string): void
    send(message: unknown): Promise<SendResult>
  }

  namespace message {
    function create(
      options: CreateTextMessageOptions | CreateCustomMessageOptions
    ): unknown
  }

  export { connection, message }
  export type {
    ConnectionOptions,
    OpenOptions,
    TextMsgBody,
    ImgMsgBody,
    AudioMsgBody,
    VideoMsgBody,
    FileMsgBody,
    CustomMsgBody,
    SendResult
  }
}
