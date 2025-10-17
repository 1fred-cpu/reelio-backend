// src/modules/queues/redis-queue.service.ts
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis, { Redis as RedisClient } from 'ioredis';

export type RedisHandler = (payload: any) => Promise<void> | void;

@Injectable()
export class RedisQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisQueueService.name);

  // single client for commands, separate client for subscription (recommended)
  private client: RedisClient;
  private subscriber: RedisClient;

  // keep handlers per channel
  private handlers = new Map<string, RedisHandler[]>();

  constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
    this.client = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      retryStrategy(times) {
        // exponential backoff
        return Math.min(times * 50, 2000);
      },
    });

    this.subscriber = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      retryStrategy(times) {
        return Math.min(times * 50, 2000);
      },
    });

    // log connection events (optional)
    this.client.on('error', (err) => this.logger.error('Redis client error', err));
    this.client.on('connect', () => this.logger.log('Redis client connected'));
    this.subscriber.on('error', (err) => this.logger.error('Redis subscriber error', err));
    this.subscriber.on('connect', () => this.logger.log('Redis subscriber connected'));
  }

  async onModuleInit() {
    // subscribe to all channels that have handlers registered later
    // we'll subscribe lazily when subscribe() is called.
  }

  async onModuleDestroy() {
    try {
      await this.subscriber.quit();
      await this.client.quit();
    } catch (err) {
      this.logger.error('Error on Redis shutdown', err);
    }
  }

  /**
   * Publish a job/message to a channel (string payload or object).
   * Lightweight: uses pub/sub (fast, ephemeral). For guaranteed persistence, use a job queue (BullMQ).
   */
  async publish(channel: string, payload: any): Promise<void> {
    try {
      const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
      await this.client.publish(channel, payloadStr);
      // optional: also push into a list for near-persistent queue (LPUSH)
      // await this.client.lpush(`queue:${channel}`, payloadStr);
    } catch (err) {
      this.logger.error(`Failed to publish to ${channel}`, err);
      throw err;
    }
  }

  /**
   * Subscribe to a channel. Handler will be called for every message.
   * Multiple handlers per channel are supported.
   */
  async subscribe(channel: string, handler: RedisHandler) {
    // add handler
    if (!this.handlers.has(channel)) this.handlers.set(channel, []);
    this.handlers.get(channel)!.push(handler);

    // if first time subscribing, attach the redis subscriber
    const subs = await this.subscriber.pubsub('channels', channel);
    const alreadySubscribed = subs && subs.length > 0;

    if (!alreadySubscribed) {
      // subscribe and set up message listener
      await this.subscriber.subscribe(channel);
      this.subscriber.on('message', async (ch: string, message: string) => {
        if (ch !== channel) return;

        let parsed: any = message;
        try {
          parsed = JSON.parse(message);
        } catch {
          // keep message as string if not JSON
        }

        const handlers = this.handlers.get(channel) || [];
        for (const h of handlers) {
          try {
            await Promise.resolve(h(parsed));
          } catch (err) {
            this.logger.error(`Handler error for channel ${channel}`, err);
            // do not rethrow — continue processing other handlers
          }
        }
      });
    }
  }

  /**
   * Unsubscribe a specific handler from a channel, or remove all handlers for a channel if no handler provided.
   */
  async unsubscribe(channel: string, handler?: RedisHandler) {
    if (!this.handlers.has(channel)) return;
    if (!handler) {
      this.handlers.delete(channel);
      await this.subscriber.unsubscribe(channel);
      return;
    }

    const arr = this.handlers.get(channel)!.filter(h => h !== handler);
    if (arr.length === 0) {
      this.handlers.delete(channel);
      await this.subscriber.unsubscribe(channel);
    } else {
      this.handlers.set(channel, arr);
    }
  }
}