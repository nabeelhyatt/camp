import { v4 as uuidv4 } from "uuid";

interface StreamData {
    active: boolean;
    watermark: number;
    pendingUpdate: QueuedUpdate | null;
}

interface QueuedUpdate<T = unknown> {
    priority: number;
    update: () => Promise<T>;
}

export class UpdateQueue {
    private static instance: UpdateQueue;
    private streams: Map<string, StreamData> = new Map();
    private isProcessing = false;
    private shouldContinue = false;

    private constructor() {
        // No interval needed
    }

    /**
     * Get the singleton instance
     */
    public static getInstance(): UpdateQueue {
        if (!UpdateQueue.instance) {
            UpdateQueue.instance = new UpdateQueue();
            // Start processing immediately
            UpdateQueue.instance.startProcessing();
        }
        return UpdateQueue.instance;
    }

    /**
     * Start a new update stream
     * @returns A unique key for the stream
     */
    public startUpdateStream(): string {
        const key = uuidv4();
        this.streams.set(key, {
            active: true,
            watermark: 0,
            pendingUpdate: null,
        });
        return key;
    }

    /**
     * Add an update to the queue, replacing any existing update for this key
     * with lower priority
     * @param key Identifier for the update
     * @param priority Higher number = higher priority
     * @param update Function to execute
     */
    public addUpdate<T = void>(
        key: string,
        priority: number,
        update: () => Promise<T>,
    ): void {
        const stream = this.streams.get(key);

        // Skip if stream doesn't exist or is closed
        if (!stream || !stream.active) return;

        // Update watermark if this is higher priority
        stream.watermark = Math.max(stream.watermark, priority);

        // Only add if no existing update or new priority is higher
        if (!stream.pendingUpdate || priority > stream.pendingUpdate.priority) {
            stream.pendingUpdate = { priority, update };
        }
    }

    /**
     * Close an update stream
     * @param key The stream key to close
     */
    public closeUpdateStream(key: string): void {
        const stream = this.streams.get(key);
        if (!stream) return;

        stream.active = false;
    }

    private startProcessing(): void {
        if (this.isProcessing) return;

        this.isProcessing = true;
        this.shouldContinue = true;
        void this.processingLoop(); // Start the loop
    }

    public stopProcessing(): void {
        this.shouldContinue = false;
    }

    private async processingLoop(): Promise<void> {
        while (this.shouldContinue) {
            let processedAnything = false;
            const keysToRemove: string[] = [];

            // Process one update from each stream in a round-robin fashion
            for (const [key, stream] of this.streams.entries()) {
                // Clean up inactive streams
                if (!stream.active) {
                    stream.pendingUpdate = null;
                    processedAnything = true;
                    keysToRemove.push(key);
                }
                // Check if there's a pending update
                else if (
                    stream.pendingUpdate &&
                    stream.pendingUpdate.priority >= stream.watermark
                ) {
                    // Process this update
                    try {
                        await stream.pendingUpdate.update();
                    } catch (e) {
                        console.error("Error processing update", e);
                    }
                    stream.pendingUpdate = null;
                    processedAnything = true;
                }
            }

            // Clean up completed streams
            for (const key of keysToRemove) {
                this.streams.delete(key);
            }

            // Pause briefly if nothing was processed to avoid tight loop
            if (!processedAnything) {
                await new Promise((resolve) => setTimeout(resolve, 50));
            }
        }

        this.isProcessing = false;
    }
}
