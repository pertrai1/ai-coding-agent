## Purpose

Define persistent session transcript storage, lightweight session summaries, and resume behavior.

## Requirements

### Requirement: Session transcripts are persisted for resume
The system SHALL persist each completed REPL session as a transcript file under `<project-root>/.ai-agent/sessions/<sessionId>.json`. The saved transcript SHALL include the session identifier, timestamps, selected model, full message history, and token usage totals needed for resume.

#### Scenario: Completed session is saved
- **WHEN** a REPL session ends after one or more chat turns
- **THEN** the system SHALL write a transcript file for that session
- **AND** the transcript SHALL include the full conversation history and token totals

#### Scenario: Empty session still gets an identifier
- **WHEN** the user starts a new session and exits without sending any messages
- **THEN** the system SHALL still have assigned a session identifier
- **AND** MAY skip transcript persistence if no conversation history was created

### Requirement: Session summaries are stored separately from transcripts
The system SHALL persist a lightweight summary for each completed session under `<project-root>/.ai-agent/sessions/<sessionId>.summary.json`. The summary SHALL be suitable for future fresh-session context loading without requiring the full transcript.

#### Scenario: Summary file is written for a completed session
- **WHEN** a session transcript is successfully saved
- **THEN** the system SHALL also write a summary artifact for that session
- **AND** the summary SHALL contain concise text describing the session's important outcomes

#### Scenario: Summary generation failure does not block transcript persistence
- **WHEN** the system cannot generate a full session summary
- **THEN** the transcript SHALL still be saved
- **AND** the system SHALL fall back to a minimal summary artifact derived from available metadata

### Requirement: Session resume restores conversation continuity
The system SHALL support resuming a saved session by session identifier. Resuming SHALL restore the saved message history and token usage totals so the conversation can continue as the same session.

#### Scenario: Resume loads a saved transcript
- **WHEN** a saved session exists for `session_abc`
- **AND** the CLI starts with `--resume session_abc`
- **THEN** the system SHALL load the saved transcript for `session_abc`
- **AND** initialize the REPL with that conversation history and token totals

#### Scenario: Missing session id fails startup cleanly
- **WHEN** the CLI starts with `--resume session_missing`
- **AND** no transcript exists for that identifier
- **THEN** the system SHALL print an error message
- **AND** exit without entering the REPL

### Requirement: Fresh sessions load prior summaries, not prior transcripts
When the user starts a fresh session, the system SHALL load recent session summaries for lightweight bootstrap context. The system SHALL NOT restore full prior transcripts unless the user explicitly requests `--resume`.

#### Scenario: Fresh session reads summaries only
- **WHEN** three prior session transcript files and three prior summary files exist
- **AND** the user starts a new session without `--resume`
- **THEN** the system SHALL read the recent summary files for bootstrap context
- **AND** SHALL NOT load the prior full transcript message histories into the active conversation

#### Scenario: Resumed session does not rely on summary-only bootstrap
- **WHEN** the user starts with `--resume session_abc`
- **THEN** the system SHALL use the saved transcript for continuity
- **AND** SHALL NOT replace that transcript with summary-only context
