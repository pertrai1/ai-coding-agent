# AI Coding Agent

A TypeScript CLI coding assistant powered by Anthropic's Claude. Streams responses in real time, maintains conversation history, and handles errors gracefully.

## Prerequisites

- Node.js 20+
- An [Anthropic API key](https://console.anthropic.com/)

## Setup

```bash
npm install
```

Create a `.env` file in the project root:

```
ANTHROPIC_API_KEY=sk-ant-...
```

## Usage

Start the interactive chat:

```bash
npm run dev
```

Type a message and press Enter. Responses stream to the terminal as they're generated. Type `exit` or `quit` to leave, or press `Ctrl+C`.

## Development

```bash
npm run typecheck   # Type-check without emitting
npm run build       # Compile to dist/
npm test            # Run unit tests
```
