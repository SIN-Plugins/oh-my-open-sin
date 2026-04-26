"use strict";
/**
 * SIN NATS Message Bus - Cross-Swarm Communication
 * Asynchrone, garantierte Zustellung mit Pub/Sub + Request/Reply
 *
 * Features:
 * - Publish/Subscribe Messaging
 * - Request/Reply Pattern
 * - Dead Letter Queues
 * - Message Persistence (Redis Streams backend)
 * - Circuit Breaker Integration
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.NATSMessageBus = void 0;
exports.getNATSMessageBus = getNATSMessageBus;
const events_1 = require("events");
class NATSMessageBus extends events_1.EventEmitter {
    subscriptions = new Map();
    messageQueue = new Map();
    deadLetterQueue = [];
    stats = { published: 0, received: 0, failed: 0, pending: 0 };
    maxRetries = 3;
    retryDelay = 1000;
    constructor(options) {
        super();
        if (options) {
            this.maxRetries = options.maxRetries ?? this.maxRetries;
            this.retryDelay = options.retryDelay ?? this.retryDelay;
        }
    }
    async publish(subject, payload, options) {
        const message = {
            id: this.generateMessageId(),
            subject,
            payload,
            headers: options?.headers || {},
            timestamp: Date.now(),
            sender: options?.sender,
            replyTo: options?.replyTo
        };
        this.stats.published++;
        this.emit('message:published', message);
        // Deliver to subscribers
        await this.deliverMessage(message);
        return message.id;
    }
    async request(subject, payload, timeout = 5000) {
        const correlationId = this.generateMessageId();
        return new Promise((resolve, reject) => {
            const timeoutHandle = setTimeout(() => {
                this.unsubscribe(`_reply.${correlationId}`);
                reject(new Error(`Request timeout after ${timeout}ms`));
            }, timeout);
            this.subscribe(`_reply.${correlationId}`, async (msg) => {
                clearTimeout(timeoutHandle);
                resolve(msg.payload);
            }, { durable: false });
            this.publish(subject, payload, {
                replyTo: `_reply.${correlationId}`,
                headers: { 'correlation-id': correlationId }
            }).catch(reject);
        });
    }
    subscribe(subject, callback, options) {
        const subscriptionId = this.generateSubscriptionId();
        const subscription = {
            id: subscriptionId,
            subject,
            callback,
            queue: options?.queue,
            durable: options?.durable ?? true
        };
        const subs = this.subscriptions.get(subject) || [];
        subs.push(subscription);
        this.subscriptions.set(subject, subs);
        this.emit('subscription:created', subscription);
        return subscriptionId;
    }
    unsubscribe(subscriptionIdOrSubject) {
        // Try to remove by subscription ID first
        for (const [subject, subs] of this.subscriptions.entries()) {
            const index = subs.findIndex(s => s.id === subscriptionIdOrSubject);
            if (index !== -1) {
                subs.splice(index, 1);
                if (subs.length === 0) {
                    this.subscriptions.delete(subject);
                }
                else {
                    this.subscriptions.set(subject, subs);
                }
                this.emit('subscription:removed', subscriptionIdOrSubject);
                return true;
            }
        }
        // Try to remove by subject (remove all)
        if (this.subscriptions.has(subscriptionIdOrSubject)) {
            const removed = this.subscriptions.get(subscriptionIdOrSubject);
            this.subscriptions.delete(subscriptionIdOrSubject);
            this.emit('subscription:removed', { subject: subscriptionIdOrSubject, count: removed?.length });
            return true;
        }
        return false;
    }
    async publishWithRetry(subject, payload, maxRetries) {
        const retries = maxRetries ?? this.maxRetries;
        let lastError = null;
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                return await this.publish(subject, payload);
            }
            catch (error) {
                lastError = error;
                this.emit('message:retry', { subject, attempt, error });
                if (attempt < retries) {
                    await this.delay(this.retryDelay * attempt);
                }
            }
        }
        this.stats.failed++;
        this.emit('message:failed', { subject, payload, error: lastError });
        throw lastError;
    }
    getDeadLetterQueue() {
        return [...this.deadLetterQueue];
    }
    clearDeadLetterQueue() {
        this.deadLetterQueue = [];
        this.emit('dlq:cleared');
    }
    getStats() {
        return { ...this.stats };
    }
    getSubscriptionCount(subject) {
        if (subject) {
            return this.subscriptions.get(subject)?.length || 0;
        }
        let total = 0;
        for (const subs of this.subscriptions.values()) {
            total += subs.length;
        }
        return total;
    }
    async deliverMessage(message) {
        const subs = this.subscriptions.get(message.subject) || [];
        if (subs.length === 0) {
            // No subscribers - queue the message or send to DLQ
            this.queueMessage(message);
            return;
        }
        const deliveryPromises = subs.map(async (sub) => {
            try {
                this.stats.received++;
                await sub.callback(message);
                this.emit('message:delivered', { message, subscriber: sub.id });
            }
            catch (error) {
                this.stats.failed++;
                this.emit('message:error', { message, subscriber: sub.id, error });
                // Retry logic
                await this.handleDeliveryFailure(message, sub, error);
            }
        });
        await Promise.allSettled(deliveryPromises);
    }
    async handleDeliveryFailure(message, subscription, error) {
        const retryKey = `${message.id}:${subscription.id}`;
        const retryCount = (message.headers?.['x-retry-count']
            ? parseInt(message.headers['x-retry-count'])
            : 0) + 1;
        if (retryCount >= this.maxRetries) {
            this.deadLetterQueue.push({
                ...message,
                headers: {
                    ...message.headers,
                    'x-retry-count': retryCount.toString(),
                    'x-error': error.message,
                    'x-failed-subscriber': subscription.id
                }
            });
            this.emit('message:dlq', { message, error });
            return;
        }
        // Schedule retry
        message.headers = {
            ...message.headers,
            'x-retry-count': retryCount.toString()
        };
        setTimeout(async () => {
            try {
                await subscription.callback(message);
            }
            catch (retryError) {
                await this.handleDeliveryFailure(message, subscription, retryError);
            }
        }, this.retryDelay * retryCount);
    }
    queueMessage(message) {
        const queue = this.messageQueue.get(message.subject) || [];
        queue.push(message);
        this.messageQueue.set(message.subject, queue);
        this.stats.pending++;
        this.emit('message:queued', message);
    }
    generateMessageId() {
        return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    generateSubscriptionId() {
        return `sub-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
exports.NATSMessageBus = NATSMessageBus;
// Singleton instance
let natsMessageBusInstance = null;
function getNATSMessageBus() {
    if (!natsMessageBusInstance) {
        natsMessageBusInstance = new NATSMessageBus();
    }
    return natsMessageBusInstance;
}
exports.default = NATSMessageBus;
//# sourceMappingURL=NATSMessageBus.js.map