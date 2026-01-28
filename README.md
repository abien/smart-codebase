# smart-codebase

> OpenCode 的任务驱动累积学习插件 - 让 AI 从每一个任务中学习

`smart-codebase` 是 OpenCode 的一个插件，它使 AI 能够从每个完成的任务中学习，并在存储库中直接构建持久的知识库。

## 功能特性

- **自动知识提取**：在每个成功完成的任务后，自动提取关键的学习内容、知识点和架构决策。
- **分布式存储**：将知识存储在相关代码附近的 `.knowledge/` 文件夹中，便于版本控制和共享。
- **上下文注入**：在 AI 读取文件时自动注入相关知识，确保其拥有先前决策的完整上下文。
- **知识链接**：基于关键词和引用重合，自动链接相关的知识片段。
- **用户反馈**：在每个任务之后，向用户提供关于所学内容的清晰反馈。

## 安装

```bash
bun add @opencode-ai/smart-codebase
```

## 配置

### 方式一：通过 npm 包（推荐）

在项目根目录的 `opencode.json` 中添加插件：

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["smart-codebase"]
}
```

### 方式二：本地插件

将构建后的插件文件放入插件目录：

- `.opencode/plugins/` - 项目级插件
- `~/.config/opencode/plugins/` - 全局插件

```bash
# 构建插件
cd smart-codebase
bun run build

# 复制到项目插件目录
cp -r dist/* /path/to/your/project/.opencode/plugins/
```

## 使用方法

安装完成后，插件会在后台自动运行。

### 手动命令

该插件还提供了几个用于手动管理知识的命令：

- `/sc-status`：显示知识库的当前状态，包括知识点和链接的数量。
- `/sc-extract`：手动触发从当前会话中提取知识。
- `/sc-rebuild-index`：重新构建全局知识索引和链接。

## 架构设计

该插件由几个核心模块组成：

- **存储 (Storage)**：
  - `KnowledgeWriter`：负责将提取的知识点写入 `.knowledge/facts.jsonl` 文件。
  - `KnowledgeLoader`：从分布式存储中加载知识点。
  - `IndexBuilder`：维护全局知识索引，以便快速检索和链接。
- **钩子 (Hooks)**：
  - `KnowledgeExtractor`：分析任务结果并提取结构化知识点。
  - `ContextInjector`：将相关知识点注入到文件读取操作中。
- **链接 (Linking)**：
  - `KnowledgeLinker`：分析知识库以发现并创建相关知识点之间的链接。
- **显示 (Display)**：
  - `Feedback`：格式化并向用户显示所学内容。

## 文件结构

知识以分布式方式存储：

```text
src/
  module/
    .knowledge/
      facts.jsonl   # 该模块提取的知识点
    module.ts
.knowledge/
  index.json        # 全局知识索引
  graph.json        # 知识关系图
```

## 开发

### 前置条件

- [Bun](https://bun.sh)
- [TypeScript](https://www.typescriptlang.org/)

### 设置

```bash
cd smart-codebase
bun install
```

### 构建

```bash
bun run build
```

### 类型检查

```bash
bun run typecheck
```

## 开源协议

MIT
