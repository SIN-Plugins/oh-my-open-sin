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
import { EventEmitter } from 'events';
export interface Message {
    id: string;
    subject: string;
    payload: any;
    headers?: Record<string, string>;
    timestamp: number;
    sender?: string;
    correlationId?: string;
    replyTo?: string;
}
export interface Subscription {
    id: string;
    subject: string;
    callback: (msg: Message) => void | Promise<void>;
    queue?: string;
    durable?: boolean;
}
export interface MessageStats {
    published: number;
    received: number;
    failed: number;
    pending: number;
}
export declare class NATSMessageBus extends EventEmitter {
    private subscriptions;
    private messageQueue;
    private deadLetterQueue;
    private stats;
    private maxRetries;
    private retryDelay;
    constructor(options?: {
        maxRetries?: number;
        retryDelay?: number;
    });
    publish(subject: string, payload: any, options?: {
        headers?: Record<string, string>;
        sender?: string;
        replyTo?: string;
    }): Promise<string>;
    request(subject: string, payload: any, timeout?: number): Promise<any>;
    subscribe(subject: string, callback: (msg: Message) => void | Promise<void>, options?: {
        queue?: string;
        durable?: boolean;
    }): string;
    unsubscribe(subscriptionIdOrSubject: string): boolean;
    publishWithRetry(subject: string, payload: any, maxRetries?: number): Promise<string>;
    getDeadLetterQueue(): Message[];
    clearDeadLetterQueue(): void;
    getStats(): MessageStats;
    getSubscriptionCount(subject?: string): number;
    private deliverMessage;
    private handleDeliveryFailure;
    private queueMessage;
    private generateMessageId;
    private generateSubscriptionId;
    private delay;
}
export declare function getNATSMessageBus(): NATSMessageBus;
export default NATSMessageBus;
//# sourceMappingURL=NATSMessageBus.d.ts.map