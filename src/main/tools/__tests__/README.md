# Tools 单元测试文档

## 概述

本目录包含 `src/main/tools/` 层的单元测试。该层是 AI Agent 的工具接口，负责将 Claude 的 tool-use 协议与实际系统操作（文件读写、IM 消息收发、计算机控制、记忆检索、后台服务等）桥接起来。

**测试框架**：[Vitest](https://vitest.dev/)  
**测试文件数**：10  
**断言总数**：706  
**运行命令**：`npm test`（单次运行） / `npm run test:watch`（监听模式）

---

## 架构设计

### 三层测试策略

测试按照项目的依赖特征，划分为三个层次：

| 层级 | 测试内容 | Mock 程度 | 对应文件 |
|------|---------|----------|---------|
| **第一层** — Schema 与纯函数 | Tool 定义（Anthropic schema 校验）、纯工具函数 | 无需 Mock | `definitions.test.ts`、`computer-definitions.test.ts`、`common-utils.test.ts`、`common-pure-functions.test.ts` |
| **第二层** — Mock 集成测试 | Executor 函数，所有外部依赖均被 Mock | 完整 Mock（服务、存储、API、文件系统） | `file-executor.test.ts`、`yumi-utils.test.ts`、`memu-executor.test.ts`、`im-executors.test.ts`、`service-executor.test.ts`、`bash-editor.test.ts` |
| **第三层** — E2E / 手动测试 | 平台原生操作（macOS AppleScript、Windows nut.js） | 需要真实操作系统 + 图形界面 | 不做自动化（设计如此） |

### 核心设计决策：Electron Mock

本项目是 Electron 应用，源代码中会 import `electron` 模块（如 `app.getPath()`、`screen.getPrimaryDisplay()`）。由于测试运行在纯 Node.js 环境中，我们提供了 Electron Mock：

```
src/main/__mocks__/electron.ts    # app、screen、nativeImage 等的桩实现
vitest.config.ts                  # 将 'electron' 别名指向该 Mock 文件
```

这使得所有工具模块可以在不依赖 Electron 运行时的情况下被导入和测试。

---

## 测试文件详解

### 1. `definitions.test.ts` — Schema 校验（555 个测试）

**目的**：验证全部 13 组工具定义均符合 [Anthropic Tool schema](https://docs.anthropic.com/en/docs/tool-use) 规范。

**检查项**：
- 每个工具包含 `name`、`description`、`input_schema` 字段
- `input_schema.type` 为 `'object'`
- 所有属性均有描述信息
- 所有 `required` 字段在 `properties` 中存在
- 工具名使用 `snake_case` 格式
- 工具名全局唯一（跨组无重复）
- 各平台工具使用正确前缀（`slack_`、`telegram_`、`macos_` 等）
- 每个消息平台包含 `delete_chat_history` 工具
- 各组工具数量与预期一致

**覆盖工具组**（共 13 组）：
`file`、`computer`、`memu`、`service`、`yumi`、`slack`、`telegram`、`discord`、`whatsapp`、`line`、`feishu`、`macos`、`macos_visual`

---

### 2. `computer-definitions.test.ts` — 计算机工具详细校验（16 个测试）

**目的**：对 `computer.definitions.ts` 进行深度校验。

**检查项**：
- `computerTool` 支持所有预期动作（screenshot、mouse_move、left_click 等）
- `bashTool`、`textEditorTool`、`downloadFileTool`、`webSearchTool` 的 schema 细节
- 导出的 `computerUseTools` 数组包含正确的工具集合

---

### 3. `common-utils.test.ts` — 通用工具函数（10 个测试）

**目的**：测试 `computer/common.ts` 中导出的纯函数。

**覆盖函数**：
- `truncateOutput(output, maxLength?)` — 截断时保留头尾内容、添加截断提示、边界情况（空字符串、刚好不超长、自定义最大长度）
- `getScaleFactor()` — 返回正数（依赖 Electron `screen` API 的 Mock）

---

### 4. `common-pure-functions.test.ts` — 算法验证（18 个测试）

**目的**：测试 `computer/common.ts` 中未导出但包含重要逻辑的内部算法。测试通过复刻算法来验证其正确性。

**覆盖算法**：

#### `extractFilename(url, contentDisposition?)`
- 从 `Content-Disposition` 头提取文件名（双引号、单引号、无引号）
- 从 URL 路径提取文件名（带/不带查询参数）
- URL 无文件扩展名或为根路径时的回退逻辑
- `Content-Disposition` 优先于 URL 路径

#### `calculateScaleFactor(width, height)`
- 小图不缩放（两个约束均在范围内）
- 长边约束（ANTHROPIC_MAX_LONG_EDGE = 1568）
- 总像素约束（ANTHROPIC_MAX_PIXELS = 1,150,000）
- 双约束同时生效时取更小（更激进）的缩放因子
- 多种真实分辨率：Retina Mac (2880x1800)、4K (3840x2160)、5K (5120x2880)
- 竖屏与横屏方向
- 1:1 比例

---

### 5. `file-executor.test.ts` — 文件操作（14 个测试）

**目的**：测试 `executor.ts`（文件工具）的执行逻辑，Mock 了 `fileService` 和 `fs`。

**覆盖操作**：
| 工具 | 测试场景 |
|------|---------|
| `file_read` | 读取文件内容、文件不存在错误 |
| `file_write` | 写入内容到文件 |
| `file_list` | 列出目录内容 |
| `file_delete` | 删除文件、文件不存在错误 |
| `file_create` | 创建新文件 |
| `file_get_info` | 获取文件元信息（大小、时间、权限） |
| 路由 | 未知工具返回错误 |

---

### 6. `yumi-utils.test.ts` — Yumi IM 执行器（23 个测试）

**目的**：测试 `yumi.executor.ts`，Mock 了 `yumiBotService`、`yumiStorage` 和 `appEvents`。

**覆盖操作**：
| 工具 | 测试场景 |
|------|---------|
| `yumi_send_text` | 成功路径、无活跃聊天守卫、服务调用失败 |
| `yumi_send_image` | 带 caption 成功、不带 caption 成功 |
| `yumi_send_file` | 带文件名成功 |
| `yumi_delete_chat_history` | 模式：`count`（成功 + 无效计数）、`time_range`（成功 + 缺少参数 + 无效日期）、`all`、`"now"` 作为结束时间、未知模式 |

---

### 7. `memu-executor.test.ts` — 记忆检索（6 个测试）

**目的**：测试 `memu.executor.ts`，Mock 了 `loadSettings`、`getAuthService` 和全局 `fetch`。

**覆盖操作**：
- 记忆检索成功（验证 fetch URL、请求头、请求体）
- API 错误处理（非 OK 响应）
- 网络故障处理
- 缺少 API Key 错误
- 请求体结构验证

---

### 8. `im-executors.test.ts` — 6 大 IM 平台执行器（34 个测试）

**目的**：在一个文件中测试全部 6 个第三方 IM 平台的执行器层，因为它们共享相同的架构模式。

**每个平台测试的通用模式**：
1. 发送文本 → 成功路径
2. 无活跃聊天守卫 → 返回描述性错误
3. 平台特色功能（embed、sticker、location、card 等）
4. 删除全部历史 → 正确计数、触发 UI 刷新事件
5. 未知工具路由 → 返回错误

**各平台详情**：

| 平台 | Mock 的服务 | 测试的特色功能 |
|------|-----------|-------------|
| **Slack** | `slackBotService`、`slackStorage` | 发送文本、按数量删除、全部删除、未知工具 |
| **Telegram** | `telegramBotService`、`telegramStorage` | 发送文本、发送位置、发送聊天动作、按时间范围删除、全部删除 |
| **Discord** | `discordBotService`、`discordStorage` | 发送文本、发送 Embed、输入状态指示、全部删除 |
| **WhatsApp** | `whatsappBotService`、`whatsappStorage` | 发送文本、发送位置、全部删除 |
| **Line** | `lineBotService`、`lineStorage` | 发送文本、发送贴图、全部删除 |
| **Feishu** | `feishuBotService`、`feishuStorage` | 发送文本、发送卡片、全部删除 |

---

### 9. `service-executor.test.ts` — 后台服务管理（12 个测试）

**目的**：测试 `service.executor.ts`，Mock 了 `serviceManager` 和 `child_process`。

**覆盖操作**：
| 工具 | 测试场景 |
|------|---------|
| `service_list` | 返回服务列表及数量 |
| `service_start` | 传递 `enableAutoStart: true`、失败传播 |
| `service_stop` | 传递 `disableAutoStart: true` |
| `service_delete` | 按 ID 删除 |
| `service_get_info` | 返回服务信息、处理"未找到" |
| `service_dry_run` | 4 种诊断结果：`OK`（有结构化输出）、`TIMEOUT`、`CRASH`（非零退出码）、`NO_OUTPUT`（空 stdout） |
| 路由 | 未知工具返回错误 |

---

### 10. `bash-editor.test.ts` — Bash 与文本编辑器工具（18 个测试）

**目的**：测试 `computer/common.ts` 中的 `executeBashTool` 和 `executeTextEditorTool`，Mock 了 `child_process` 和 `fs/promises`。

**覆盖操作**：

#### `executeBashTool`
| 场景 | 验证内容 |
|------|---------|
| 执行成功 | stdout 作为 data 返回 |
| 有 stderr 输出 | 以 "STDERR:" 前缀拼接 |
| 默认超时 | 30000ms 传递给 exec |
| 自定义超时 | 用户指定值被传递 |
| 命令失败（有 stderr） | 错误信息包含 stderr 内容 |
| 命令失败（无 stderr） | 错误信息包含异常消息 |
| 字符串输出 | 兼容非 Buffer 的 exec 输出 |

#### `executeTextEditorTool`
| 命令 | 测试场景 |
|------|---------|
| `view` | 全文带行号、行范围查看、文件不存在错误 |
| `create` | 创建文件及目录、缺少 `file_text` 错误 |
| `str_replace` | 替换成功、`old_str` 未找到、缺少参数 |
| `insert` | 在正确行插入（验证写入内容）、缺少参数 |
| 未知命令 | 返回描述性错误 |

---

## Mock 策略

### 被 Mock 的外部依赖

| 依赖 | Mock 方式 | 使用场景 |
|------|----------|---------|
| `electron`（app、screen、nativeImage） | `vitest.config.ts` 中模块别名 → `__mocks__/electron.ts` | 所有工具 |
| `child_process` / `util.promisify` | `vi.mock` + `vi.hoisted` | bash-editor、service |
| `fs/promises` | `vi.mock` + hoisted 函数引用 | bash-editor |
| `fs`（同步 API） | `vi.mock` | file-executor、IM 执行器 |
| 全局 `fetch` | `vi.stubGlobal('fetch', mockFetch)` | memu-executor |
| Bot 服务（`*BotService`） | `vi.mock('../apps/*/bot.service')` | 全部 IM 执行器 |
| 存储模块（`*Storage`） | `vi.mock('../apps/*/storage')` | 全部 IM 执行器 |
| `appEvents` | `vi.mock('../../events')` | 全部 IM 执行器 |
| `serviceManager` | `vi.mock('../../services/back-service')` | service-executor |
| `screenshot-desktop` | `vi.mock('screenshot-desktop')` | bash-editor |
| `loadSettings` / `getAuthService` | `vi.mock` | memu-executor |

### ESM 兼容性处理

Vitest 以 ESM 模式运行，这意味着 `vi.spyOn(module, 'export')` 对 ES 模块导出无效（属性不可配置）。采用的解决方案：

```typescript
// 不能使用 vi.spyOn(fsPromises, 'readFile')
// 改用 vi.hoisted + vi.mock 方式：
const mockReadFile = vi.hoisted(() => vi.fn())
vi.mock('fs/promises', async () => {
  const actual = await vi.importActual('fs/promises')
  return { ...actual, readFile: mockReadFile }
})
```

---

## 未测试的部分（及原因）

| 文件 | 原因 |
|------|------|
| `computer/macos.ts` | 调用 `cliclick` 和 `python3 + Quartz` — 需要 macOS 图形界面 |
| `computer/windows.ts` | 使用 `@nut-tree-fork/nut-js` — 需要 Windows 及显示器 |
| `macos/executor.ts` | 100% 通过 `osascript` 执行 AppleScript — 仅限 macOS |
| `macos/visual.executor.ts` | 100% 通过 `osascript` 执行 AppleScript — 仅限 macOS |

这 4 个文件属于**平台原生操作系统驱动**，直接调用系统命令或原生 API。它们归属第三层（E2E / 在目标操作系统上手动测试），无法在 CI 环境中进行有意义的单元测试。

---

## 配置文件

### `vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
    alias: {
      electron: new URL('./src/main/__mocks__/electron.ts', import.meta.url).pathname
    }
  }
})
```

### `package.json` 脚本

```json
{
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage"
}
```

---

## 运行测试

```bash
# 单次运行
npm test

# 监听模式（文件变更自动重跑）
npm run test:watch

# 生成覆盖率报告
npm run test:coverage
```
