/**
 * Centralized tracker for model thinking states
 * This emits events when models start/stop generating responses
 */

import { EventEmitter } from "events";

// Removed unused interface - keeping for future use if needed

class ModelThinkingTracker extends EventEmitter {
    // Track thinking models per scope
    // Key format: `${chatId}:${scopeId || 'main'}`
    private thinkingModelsByScope: Map<string, Map<string, number>> = new Map();

    /**
     * Create a scope key from chatId and optional scopeId
     */
    private makeScopeKey(chatId: string, scopeId?: string): string {
        return `${chatId}:${scopeId || "main"}`;
    }

    /**
     * Mark a model as starting to think in a specific scope
     */
    startThinking(modelId: string, chatId: string, scopeId?: string): void {
        const scopeKey = this.makeScopeKey(chatId, scopeId);

        // Get or create the map for this scope
        if (!this.thinkingModelsByScope.has(scopeKey)) {
            this.thinkingModelsByScope.set(scopeKey, new Map());
        }

        const scopeModels = this.thinkingModelsByScope.get(scopeKey)!;
        const currentCount = scopeModels.get(modelId) || 0;
        scopeModels.set(modelId, currentCount + 1);

        // Emit scope-specific events
        this.emit(`modelStartThinking:${scopeKey}`, modelId);
        this.emit(
            `thinkingStateChanged:${scopeKey}`,
            this.getThinkingModels(chatId, scopeId),
        );

        // Also emit legacy global event for backward compatibility (will be removed later)
        this.emit("thinkingStateChanged", this.getAllThinkingModels());
    }

    /**
     * Mark a model as done thinking in a specific scope
     */
    stopThinking(modelId: string, chatId: string, scopeId?: string): void {
        const scopeKey = this.makeScopeKey(chatId, scopeId);
        const scopeModels = this.thinkingModelsByScope.get(scopeKey);

        if (!scopeModels) return;

        const currentCount = scopeModels.get(modelId) || 0;
        if (currentCount > 1) {
            scopeModels.set(modelId, currentCount - 1);
        } else {
            scopeModels.delete(modelId);

            // Clean up empty scopes
            if (scopeModels.size === 0) {
                this.thinkingModelsByScope.delete(scopeKey);
            }
        }

        // Emit scope-specific events
        this.emit(`modelStopThinking:${scopeKey}`, modelId);
        this.emit(
            `thinkingStateChanged:${scopeKey}`,
            this.getThinkingModels(chatId, scopeId),
        );

        // Also emit legacy global event for backward compatibility (will be removed later)
        this.emit("thinkingStateChanged", this.getAllThinkingModels());
    }

    /**
     * Get current thinking models for a specific scope
     */
    getThinkingModels(chatId: string, scopeId?: string): Map<string, number> {
        const scopeKey = this.makeScopeKey(chatId, scopeId);
        const scopeModels = this.thinkingModelsByScope.get(scopeKey);
        return scopeModels ? new Map(scopeModels) : new Map<string, number>();
    }

    /**
     * Get all thinking models across all scopes (for backward compatibility)
     */
    private getAllThinkingModels(): Map<string, number> {
        const allModels = new Map<string, number>();

        for (const scopeModels of this.thinkingModelsByScope.values()) {
            for (const [modelId, count] of scopeModels) {
                const currentCount = allModels.get(modelId) || 0;
                allModels.set(modelId, currentCount + count);
            }
        }

        return allModels;
    }

    /**
     * Clear all thinking states for a specific scope
     */
    clearScope(chatId: string, scopeId?: string): void {
        const scopeKey = this.makeScopeKey(chatId, scopeId);
        this.thinkingModelsByScope.delete(scopeKey);
        this.emit(`thinkingStateChanged:${scopeKey}`, new Map());
    }

    /**
     * Clear all thinking states (e.g., on interruption)
     */
    clearAll(): void {
        this.thinkingModelsByScope.clear();
        this.emit("thinkingStateChanged", new Map());
    }

    /**
     * Check if a specific model is thinking in a specific scope
     */
    isThinking(modelId: string, chatId: string, scopeId?: string): boolean {
        const scopeKey = this.makeScopeKey(chatId, scopeId);
        const scopeModels = this.thinkingModelsByScope.get(scopeKey);
        return scopeModels ? scopeModels.has(modelId) : false;
    }
}

// Export singleton instance
export const modelThinkingTracker = new ModelThinkingTracker();
