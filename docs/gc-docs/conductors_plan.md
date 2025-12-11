# Group Chat Conductor Feature Implementation Plan

## Overview

Implement a "conductor" feature that allows AI models to orchestrate conversations in group chats. The conductor can call on other models and manage the flow of conversation until yielding control back to the user.

## Key Architecture Understanding

1. **Messages**: Stored in gc_messages table with fields for chat_id, id, text, model_config_id, thread_root_message_id
2. **Model Invocation**: Currently handled by getRespondingModels function that parses @mentions and multipliers (x2, x3, x4)
3. **State Management**: Uses React state and TanStack Query for real-time updates
4. **Threading**: Supports one level of subthreads with thread_root_message_id

## Database Schema Updates

Create new table to track active conductors:

```sql
CREATE TABLE gc_conductors (
  chat_id TEXT NOT NULL,
  scope_id TEXT, -- NULL for main chat, thread_root_message_id for threads
  conductor_model_id TEXT NOT NULL,
  turn_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (chat_id, scope_id)
);
```

## Implementation Phases

### Phase 1: Database & Backend Functions

1. Add migration in `src-tauri/src/migrations.rs` for gc_conductors table
2. Add to `DB.ts`:
    - `fetchActiveConductor(chatId, scopeId)` - Get current conductor for a scope
    - `setConductor(chatId, scopeId, modelId)` - Set a new conductor
    - `incrementConductorTurn(chatId, scopeId)` - Track turn count
    - `clearConductor(chatId, scopeId)` - Remove conductor

### Phase 2: Command System

1. Implement command parsing that detects commands anywhere in message:
    - `/conduct` - User command to hand over conductor role
    - `/yield` - Model command to return control to user
2. No word boundary enforcement at end (e.g., `/conduct!` is valid)
3. Add validation:
    - Only users can use `/conduct`
    - Only models can use `/yield`

### Phase 3: Core Orchestration (APIGC.ts)

1. Create main orchestration function `orchestrateConductorSession`:

    - Manages entire conductor lifecycle
    - Uses refetchQueries and ensureQueryData for DB sync
    - Handles automatic model invocation when conductor is active
    - Processes commands and state transitions
    - Enforces 10-turn limit
    - Implements cancellation for in-progress responses

2. Modify `useGenerateAIResponses`:
    - Check for active conductor before generating responses
    - If conductor exists and message is from user/other model, invoke conductor
    - Add conductor turn limit checking
    - Support cancellation via AbortController

### Phase 4: UI Integration

1. **GroupChat.tsx** updates:

    - Add conductor state tracking
    - Show conductor indicator: "[Model Name] is conducting. ESC to interrupt."
    - Handle ESC key to interrupt conductor
    - Update handleSend to check for /conduct command
    - Modify model selection logic when conductor is active

2. **GroupChatThread.tsx** updates:

    - Similar updates for thread-scoped conductors
    - Maintain separate conductor state for threads

3. **Conductor Indicator Component**:
    - Display below typing indicator
    - Smooth transitions when conductor changes
    - Clear visual feedback for conductor state

### Phase 5: Edge Case Handling & Polish

1. Error handling:

    - Auto-clear conductor on crash
    - Proper cleanup on component unmount

2. Edge cases:
    - Multiple @mentions with /conduct - first responder becomes conductor
    - No @mentions with /conduct - main/default model becomes conductor
    - Turn limit (10) prevents infinite loops
    - Thread scope isolation maintained

## Conductor Logic Flow

### When /conduct is invoked:

1. Parse message to determine responding models
2. Set first responder as conductor (or default model if no @mentions)
3. Store conductor info in database
4. Future messages automatically invoke conductor

### When conductor responds:

1. Check for /yield command in response
2. Increment turn count
3. If turn limit (10) reached, auto-yield
4. Parse @mentions to invoke other models
5. Cancel previous in-progress response if new message arrives

### When user presses ESC:

1. Cancel any in-progress conductor response
2. Clear conductor from database
3. Return control to user
4. Update UI to remove conductor indicator

## Technical Decisions

1. **Scope Management**: Conductor state tracked per scope (main chat or thread) using scope_id
2. **State Storage**: Separate gc_conductors table for clean separation of concerns
3. **Command Detection**: Simple string search for `/conduct` and `/yield` anywhere in text
4. **Cancellation**: AbortController for cancelling in-progress responses
5. **Turn Counting**: Persisted in database, reset on conductor change

## Files to Modify

1. `src-tauri/src/migrations.rs` - Database schema
2. `src/core/chorus/DB.ts` - Database functions
3. `src/core/chorus/APIGC.ts` - Core conductor orchestration
4. `src/ui/components/GroupChat.tsx` - Main chat UI integration
5. `src/ui/components/GroupChatThread.tsx` - Thread support
6. Create: `src/core/chorus/ConductorManager.ts` - Conductor state utilities

## Testing Considerations

1. Conductor handoff between different models
2. ESC interruption reliability
3. 10-turn limit enforcement
4. Thread scope isolation
5. Multiple @mentions with /conduct
6. Conductor crash recovery
7. Concurrent message handling
8. Command parsing edge cases

## Risk Mitigation

1. Clear visual indicators for conductor state
2. Graceful degradation if conductor system fails

## UI/UX Details

-   Conductor indicator positioned below typing indicator
-   Smooth fade in/out transitions
-   ESC key prominently mentioned in indicator
-   Preserve message flow continuity during conductor sessions
-   Clear feedback when conductor changes or yields

## Implementation Details for Future Developers

### How Conductor Mode Works

1. **Activation**: User types `/conduct` anywhere in their message. The first model that would respond (based on @mentions or default) becomes the conductor.

2. **Conductor Instructions**: When a model is conducting, it receives special system instructions via the `isConductor` parameter in `encodeConversation()`. This tells the model:

    - It's orchestrating the conversation
    - It can call other models using @mentions
    - It should use `/yield` to return control
    - It has a 10-turn limit

3. **Turn-Based Execution**: Unlike regular responses, conductor sessions are turn-based:
    - Conductor responds once per user message
    - After conductor responds, if it mentioned other models, they respond
    - Control returns to user for next input
    - Process repeats until /yield or 10-turn limit

### Key Implementation Choices

1. **Single Turn Per Invocation**: The `orchestrateConductorSession` function executes ONE conductor turn, not a loop. This prevents the parallel execution bug where multiple conductor responses were generated simultaneously.

2. **Database State**: Conductor state is persisted in `gc_conductors` table with:

    - `scope_id`: NULL for main chat, thread_root_message_id for threads
    - `turn_count`: Increments with each conductor response
    - `is_active`: Boolean flag for active conductors

3. **Command Detection**: Simple string search for `/conduct` and `/yield` - no regex boundaries. This allows flexible usage like `/conduct!` or `/yield.`

4. **Model Response Coordination**: When conductor mentions models:
    - All mentioned models respond in parallel
    - Responses are awaited before continuing
    - Query invalidation ensures UI updates after each response

### Important Considerations

1. **Scope Isolation**: Conductors are scoped - main chat and each thread can have independent conductors.

2. **Error Handling**: If conductor crashes or errors, it's automatically cleared to prevent stuck states.

3. **ESC Interruption**: Uses window.location.reload() for simplicity. Future improvement could use proper state management.

4. **Debug Logging**: Console logs are intentionally left in for debugging conductor flow. Search for "[Conductor]" in console.

### Potential Future Improvements

1. **Conductor Context**: Add memory of previous conductor actions within same session
2. **Better State Management**: Replace reload() with proper React state updates
3. **Conductor Handoff**: Allow conductor to pass role to another model
4. **Visual Indicators**: Show which models conductor is calling in real-time
5. **Conductor Templates**: Pre-defined conductor behaviors for common tasks
