## ADDED Requirements

### Requirement: Token usage tracking
The system SHALL track prompt (input) and completion (output) token usage from each Anthropic API response and maintain a running session total.

#### Scenario: Input tokens are tracked
- **WHEN** the Anthropic API returns a `message_start` event with `usage.input_tokens: 150`
- **THEN** the system SHALL add 150 to the session's cumulative input token count

#### Scenario: Output tokens are tracked
- **WHEN** the Anthropic API returns a `message_delta` event with `usage.output_tokens: 75`
- **THEN** the system SHALL add 75 to the session's cumulative output token count

#### Scenario: Token totals persist across turns
- **WHEN** three messages have been exchanged with token usages [(100, 50), (200, 100), (150, 75)]
- **THEN** the session total SHALL show 450 input tokens and 225 output tokens

### Requirement: Compression threshold detection
The system SHALL detect when the conversation approaches the model's context window limit and trigger automatic compression.

#### Scenario: Compression triggers at threshold
- **WHEN** cumulative token usage reaches 80% of the model's context window (160,000 tokens for 200K limit)
- **THEN** the system SHALL trigger conversation compression before the next API call

#### Scenario: No compression below threshold
- **WHEN** cumulative token usage is below 80% of the context window
- **THEN** the system SHALL NOT trigger compression

#### Scenario: Multiple compression cycles
- **WHEN** a long session causes the context to reach the threshold multiple times
- **THEN** the system SHALL compress the conversation each time the threshold is reached

### Requirement: Hybrid conversation compression
The system SHALL compress conversation history using a hybrid approach: keep recent turns verbatim, summarize middle turns, and drop oldest turns.

#### Scenario: Recent turns preserved verbatim
- **WHEN** compression is triggered on a conversation with 20 turns
- **THEN** the most recent 6 turns (3 user + 3 assistant pairs) SHALL be preserved without modification

#### Scenario: Middle turns summarized
- **WHEN** compression is triggered on a conversation with turns older than the recent 6
- **THEN** the system SHALL send those older turns to the Anthropic API with a summarization prompt

#### Scenario: Summary replaces old turns
- **WHEN** the summarization API call completes successfully
- **THEN** the old turns SHALL be replaced by a single summary message with `role: "user"` containing the summary text

#### Scenario: Summary preserves key information
- **WHEN** the summarized turns contained decisions about using TypeScript strict mode
- **THEN** the summary SHALL mention the TypeScript strict mode decision

### Requirement: Silent compression operation
The system SHALL perform compression operations without displaying output to the user during normal operation.

#### Scenario: No user output during compression
- **WHEN** compression is triggered and completes successfully
- **THEN** no message SHALL be displayed to the user in the REPL

#### Scenario: Compression errors are reported
- **WHEN** the summarization API call fails
- **THEN** the system SHALL display an error message and continue with truncated history

### Requirement: Compression failure handling
The system SHALL handle summarization failures gracefully by falling back to truncation.

#### Scenario: Summarization API error
- **WHEN** the summarization API call returns an error
- **THEN** the system SHALL fall back to dropping the oldest turns without summarization

#### Scenario: Summarization timeout
- **WHEN** the summarization API call times out after 30 seconds
- **THEN** the system SHALL fall back to dropping the oldest turns and log a warning

### Requirement: Token tracker query interface
The system SHALL provide an interface to query current token usage statistics.

#### Scenario: Get current token totals
- **WHEN** the token tracker is queried for current usage
- **THEN** it SHALL return total input tokens, total output tokens, and combined total

#### Scenario: Get usage percentage
- **WHEN** the token tracker is queried for usage percentage
- **THEN** it SHALL return the percentage of context window consumed (e.g., 45.2)

#### Scenario: Get message count
- **WHEN** the token tracker is queried for message count
- **THEN** it SHALL return the number of message turns in the conversation
