## Purpose

Define project-scoped durable memory storage and the internal remember/recall/forget operations.

## Requirements

### Requirement: Project memory storage layout
The system SHALL store durable project memories under `<project-root>/.ai-agent/memory/`. That directory SHALL contain an `index.json` file for lookup metadata and an `entries/` directory containing one JSON file per memory entry.

#### Scenario: Memory storage is initialized on first use
- **WHEN** a user invokes a memory operation in a project with no existing `.ai-agent/memory/` directory
- **THEN** the system SHALL create the memory directory structure
- **AND** initialize an empty `index.json`

#### Scenario: Existing memory storage is reused
- **WHEN** `.ai-agent/memory/index.json` and one or more memory entry files already exist
- **THEN** the system SHALL reuse those files without resetting them

### Requirement: Remember operation persists durable facts
The system SHALL support an internal `remember` operation that stores a user-supplied durable fact as a memory entry file and records its lookup metadata in the memory index.

#### Scenario: Remember creates a new memory entry
- **WHEN** the user runs `/remember Preferred package manager is npm`
- **THEN** the system SHALL create a new memory entry file containing that fact
- **AND** add a corresponding index record with an id, timestamps, and lookup metadata
- **AND** display the new memory id to the user

#### Scenario: Remember rejects empty content
- **WHEN** the user runs `/remember` without any fact text
- **THEN** the system SHALL display an error message
- **AND** SHALL NOT create a memory entry or update the index

### Requirement: Recall operation retrieves indexed memories
The system SHALL support an internal `recall` operation that reads the memory index and returns active memories. With a query, the system SHALL rank memories by normalized token overlap. Without a query, the system SHALL list active memories in stable order.

#### Scenario: Recall with query returns ranked matches
- **WHEN** the memory store contains entries for `"Use npm"` and `"Primary model is claude-sonnet"`
- **AND** the user runs `/recall model`
- **THEN** the `"Primary model is claude-sonnet"` memory SHALL appear before `"Use npm"`

#### Scenario: Recall without query lists memories
- **WHEN** the memory store contains three active entries
- **AND** the user runs `/recall`
- **THEN** the system SHALL list those three entries with their ids and text

#### Scenario: Recall with no matches reports empty result
- **WHEN** the user runs `/recall deployment`
- **AND** no memory matches the query
- **THEN** the system SHALL report that no memories matched

### Requirement: Forget operation removes selected memories
The system SHALL support an internal `forget` operation that removes a selected memory entry from both the filesystem entry store and the memory index.

#### Scenario: Forget removes an existing memory
- **WHEN** the user runs `/forget mem_123`
- **AND** `mem_123` exists
- **THEN** the system SHALL delete the corresponding entry file
- **AND** remove `mem_123` from `index.json`
- **AND** confirm removal to the user

#### Scenario: Forget of unknown id is non-destructive
- **WHEN** the user runs `/forget mem_missing`
- **AND** no such memory exists
- **THEN** the system SHALL report that the memory id was not found
- **AND** SHALL NOT modify any other memory entries

### Requirement: Memory index is available for session bootstrap
When a fresh session starts, the system SHALL load the memory index so active durable memories can be formatted into bootstrap context without restoring prior chat turns.

#### Scenario: Fresh session loads stored memories
- **WHEN** two memories exist in `.ai-agent/memory/index.json`
- **AND** the CLI starts a new session
- **THEN** those memory records SHALL be available to the startup bootstrap flow

#### Scenario: Fresh session with no memory store continues normally
- **WHEN** no memory directory exists yet
- **AND** the CLI starts a new session
- **THEN** the system SHALL continue without startup failure
- **AND** bootstrap with no durable memory context
