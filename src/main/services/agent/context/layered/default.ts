import { app } from 'electron'
import { LayeredContextIndexer } from './indexer'
import { LayeredContextManager } from './manager'
import { LayeredContextRetriever } from './retriever'
import { LayeredSummaryGenerator, type LlmSummaryProvider } from './summarizer'
import { FileSystemLayeredContextStorage } from './storage'
import { MemuDenseScoreProvider } from './dense-score-provider'

export function createLayeredContextManager(llmProvider?: LlmSummaryProvider): LayeredContextManager {
  const storage = new FileSystemLayeredContextStorage(app.getPath('userData'))
  const summary = new LayeredSummaryGenerator(llmProvider)
  const indexer = new LayeredContextIndexer(storage, summary)
  const denseScoreProvider = new MemuDenseScoreProvider()
  const retriever = new LayeredContextRetriever(storage, denseScoreProvider)
  return new LayeredContextManager(storage, indexer, retriever)
}

export function buildLayeredSessionKey(platform: string, chatId?: string | null): string {
  return `${platform}:${chatId || 'default'}`
}
