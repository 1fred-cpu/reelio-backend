// src/modules/queues/redis-queue.module.ts
import { Module, Global } from "@nestjs/common";
import { RedisQueueService } from "./redis-queue.service";

@Global()
@Module({
    providers: [RedisQueueService],
    exports: [RedisQueueService]
})
export class RedisQueueModule {}
