import { logger } from './utils/logger';

interface QueueJob {
  id: string;
  phone: string;
  message: string;
  type: 'verification' | 'notification' | 'test';
  priority: number;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  nextAttemptAt: Date;
  lastError?: string;
  callback?: (success: boolean, error?: string) => void;
}

export interface QueueMetrics {
  totalEnqueued: number;
  totalSent: number;
  totalFailed: number;
  totalRetries: number;
  currentQueueLength: number;
  lastSentAt: Date | null;
  lastErrorAt: Date | null;
  lastError: string | null;
  circuitBreakerOpen: boolean;
  messagesPerMinute: number;
}

interface PerRecipientState {
  lastSentAt: Date;
  messageCount: number;
}

const CONFIG = {
  MIN_DELAY_BETWEEN_MESSAGES_MS: 1500,
  PER_RECIPIENT_COOLDOWN_MS: 30000,
  MAX_ATTEMPTS: 3,
  BASE_RETRY_DELAY_MS: 2000,
  MAX_RETRY_DELAY_MS: 60000,
  CIRCUIT_BREAKER_THRESHOLD: 5,
  CIRCUIT_BREAKER_RESET_MS: 60000,
  QUEUE_PROCESS_INTERVAL_MS: 500,
  MAX_MESSAGES_PER_MINUTE: 40,
};

class WhatsAppQueueService {
  private queue: QueueJob[] = [];
  private isProcessing = false;
  private processingInterval: NodeJS.Timeout | null = null;
  private sendFunction: ((phone: string, message: string) => Promise<boolean>) | null = null;
  
  private metrics: QueueMetrics = {
    totalEnqueued: 0,
    totalSent: 0,
    totalFailed: 0,
    totalRetries: 0,
    currentQueueLength: 0,
    lastSentAt: null,
    lastErrorAt: null,
    lastError: null,
    circuitBreakerOpen: false,
    messagesPerMinute: 0,
  };
  
  private consecutiveFailures = 0;
  private circuitBreakerOpenedAt: Date | null = null;
  private lastGlobalSendAt: Date | null = null;
  private recipientStates: Map<string, PerRecipientState> = new Map();
  private recentSendTimestamps: number[] = [];

  constructor() {
    this.startProcessing();
  }

  setSendFunction(fn: (phone: string, message: string) => Promise<boolean>) {
    this.sendFunction = fn;
  }

  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  enqueue(
    phone: string,
    message: string,
    type: 'verification' | 'notification' | 'test' = 'verification',
    callback?: (success: boolean, error?: string) => void
  ): string {
    const priority = type === 'verification' ? 1 : type === 'test' ? 2 : 3;
    
    const job: QueueJob = {
      id: this.generateJobId(),
      phone,
      message,
      type,
      priority,
      attempts: 0,
      maxAttempts: CONFIG.MAX_ATTEMPTS,
      createdAt: new Date(),
      nextAttemptAt: new Date(),
      callback,
    };
    
    this.queue.push(job);
    this.queue.sort((a, b) => a.priority - b.priority || a.createdAt.getTime() - b.createdAt.getTime());
    
    this.metrics.totalEnqueued++;
    this.metrics.currentQueueLength = this.queue.length;
    
    logger.debug(`[WhatsApp Queue] Job ${job.id} enqueued for ${phone} (type: ${type}, queue size: ${this.queue.length})`);
    
    return job.id;
  }

  private startProcessing() {
    if (this.processingInterval) return;
    
    this.processingInterval = setInterval(() => {
      this.processQueue();
    }, CONFIG.QUEUE_PROCESS_INTERVAL_MS);
    
    logger.info('[WhatsApp Queue] Queue processor started');
  }

  stopProcessing() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
      logger.info('[WhatsApp Queue] Queue processor stopped');
    }
  }

  private async processQueue() {
    if (this.isProcessing) return;
    if (this.queue.length === 0) return;
    if (!this.sendFunction) return;
    
    if (this.isCircuitBreakerOpen()) {
      return;
    }
    
    if (!this.canSendGlobally()) {
      return;
    }
    
    const job = this.getNextJob();
    if (!job) return;
    
    this.isProcessing = true;
    
    try {
      await this.processJob(job);
    } finally {
      this.isProcessing = false;
    }
  }

  private getNextJob(): QueueJob | null {
    const now = new Date();
    
    for (let i = 0; i < this.queue.length; i++) {
      const job = this.queue[i];
      
      if (job.nextAttemptAt > now) continue;
      
      if (!this.canSendToRecipient(job.phone)) continue;
      
      this.queue.splice(i, 1);
      this.metrics.currentQueueLength = this.queue.length;
      return job;
    }
    
    return null;
  }

  private canSendGlobally(): boolean {
    if (!this.lastGlobalSendAt) return true;
    
    const timeSinceLastSend = Date.now() - this.lastGlobalSendAt.getTime();
    return timeSinceLastSend >= CONFIG.MIN_DELAY_BETWEEN_MESSAGES_MS;
  }

  private canSendToRecipient(phone: string): boolean {
    const state = this.recipientStates.get(phone);
    if (!state) return true;
    
    const timeSinceLastSend = Date.now() - state.lastSentAt.getTime();
    return timeSinceLastSend >= CONFIG.PER_RECIPIENT_COOLDOWN_MS;
  }

  private isCircuitBreakerOpen(): boolean {
    if (!this.metrics.circuitBreakerOpen) return false;
    
    if (this.circuitBreakerOpenedAt) {
      const elapsed = Date.now() - this.circuitBreakerOpenedAt.getTime();
      if (elapsed >= CONFIG.CIRCUIT_BREAKER_RESET_MS) {
        this.closeCircuitBreaker();
        return false;
      }
    }
    
    return true;
  }

  private openCircuitBreaker(reason: string) {
    this.metrics.circuitBreakerOpen = true;
    this.circuitBreakerOpenedAt = new Date();
    logger.warn(`[WhatsApp Queue] Circuit breaker OPENED: ${reason}`);
  }

  private closeCircuitBreaker() {
    this.metrics.circuitBreakerOpen = false;
    this.circuitBreakerOpenedAt = null;
    this.consecutiveFailures = 0;
    logger.info('[WhatsApp Queue] Circuit breaker CLOSED');
  }

  private async processJob(job: QueueJob) {
    job.attempts++;
    
    logger.debug(`[WhatsApp Queue] Processing job ${job.id} (attempt ${job.attempts}/${job.maxAttempts})`);
    
    try {
      await this.sendFunction!(job.phone, job.message);
      
      this.onJobSuccess(job);
    } catch (error: any) {
      this.onJobFailure(job, error);
    }
  }

  private onJobSuccess(job: QueueJob) {
    const now = new Date();
    
    this.lastGlobalSendAt = now;
    this.consecutiveFailures = 0;
    
    if (this.metrics.circuitBreakerOpen) {
      this.closeCircuitBreaker();
    }
    
    const recipientState = this.recipientStates.get(job.phone) || { lastSentAt: now, messageCount: 0 };
    recipientState.lastSentAt = now;
    recipientState.messageCount++;
    this.recipientStates.set(job.phone, recipientState);
    
    this.recentSendTimestamps.push(now.getTime());
    this.updateMessagesPerMinute();
    
    this.metrics.totalSent++;
    this.metrics.lastSentAt = now;
    
    logger.info(`[WhatsApp Queue] Job ${job.id} sent successfully to ${job.phone}`);
    
    if (job.callback) {
      job.callback(true);
    }
  }

  private onJobFailure(job: QueueJob, error: any) {
    const errorMessage = error.message || 'Unknown error';
    job.lastError = errorMessage;
    
    this.consecutiveFailures++;
    this.metrics.lastErrorAt = new Date();
    this.metrics.lastError = errorMessage;
    
    logger.error(`[WhatsApp Queue] Job ${job.id} failed (attempt ${job.attempts}): ${errorMessage}`);
    
    if (this.consecutiveFailures >= CONFIG.CIRCUIT_BREAKER_THRESHOLD) {
      this.openCircuitBreaker(`${this.consecutiveFailures} consecutive failures`);
    }
    
    if (job.attempts < job.maxAttempts) {
      const delay = Math.min(
        CONFIG.BASE_RETRY_DELAY_MS * Math.pow(2, job.attempts - 1),
        CONFIG.MAX_RETRY_DELAY_MS
      );
      job.nextAttemptAt = new Date(Date.now() + delay);
      
      this.queue.push(job);
      this.queue.sort((a, b) => a.priority - b.priority || a.createdAt.getTime() - b.createdAt.getTime());
      this.metrics.currentQueueLength = this.queue.length;
      this.metrics.totalRetries++;
      
      logger.debug(`[WhatsApp Queue] Job ${job.id} requeued, next attempt in ${delay}ms`);
    } else {
      this.metrics.totalFailed++;
      
      logger.error(`[WhatsApp Queue] Job ${job.id} exhausted all attempts, dropping`);
      
      if (job.callback) {
        job.callback(false, errorMessage);
      }
    }
  }

  private updateMessagesPerMinute() {
    const oneMinuteAgo = Date.now() - 60000;
    this.recentSendTimestamps = this.recentSendTimestamps.filter(ts => ts > oneMinuteAgo);
    this.metrics.messagesPerMinute = this.recentSendTimestamps.length;
  }

  getMetrics(): QueueMetrics {
    this.updateMessagesPerMinute();
    return { ...this.metrics };
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  clearQueue() {
    const dropped = this.queue.length;
    this.queue = [];
    this.metrics.currentQueueLength = 0;
    logger.warn(`[WhatsApp Queue] Queue cleared, ${dropped} jobs dropped`);
  }

  forceCloseCircuitBreaker() {
    this.closeCircuitBreaker();
  }
}

export const whatsappQueue = new WhatsAppQueueService();
