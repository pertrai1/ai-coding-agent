// ---------------------------------------------------------------------------
// SSE Stream Parser - Extracted from anthropic.ts for modularity
// ---------------------------------------------------------------------------

export type SSEEvent = {
  event: string | null;
  data: string;
};

function processLine(
  line: string,
  state: { currentEvent: string | null; dataLines: string[] },
): void {
  if (line === "") {
    return;
  }

  if (line.startsWith(":")) {
    return;
  }

  const colonIndex = line.indexOf(":");
  if (colonIndex === -1) {
    return;
  }

  const field = line.slice(0, colonIndex);
  let value = line.slice(colonIndex + 1);
  if (value.startsWith(" ")) {
    value = value.slice(1);
  }

  if (field === "event") {
    state.currentEvent = value;
  } else if (field === "data") {
    state.dataLines.push(value);
  }
}

function finalizeEvent(state: { currentEvent: string | null; dataLines: string[] }): SSEEvent | null {
  if (state.currentEvent !== null || state.dataLines.length > 0) {
    const event: SSEEvent = {
      event: state.currentEvent,
      data: state.dataLines.join("\n"),
    };
    state.currentEvent = null;
    state.dataLines = [];
    return event;
  }
  return null;
}

export async function* parseSSEStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<SSEEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const state = { currentEvent: null as string | null, dataLines: [] as string[] };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const rawLine of lines) {
        const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;

        if (line === "") {
          const event = finalizeEvent(state);
          if (event) yield event;
          continue;
        }

        processLine(line, state);
      }
    }

    // Handle remaining buffer
    if (buffer.length > 0) {
      const line = buffer.endsWith("\r") ? buffer.slice(0, -1) : buffer;
      if (line !== "" && !line.startsWith(":")) {
        processLine(line, state);
      }
    }

    const finalEvent = finalizeEvent(state);
    if (finalEvent) yield finalEvent;
  } finally {
    reader.releaseLock();
  }
}
