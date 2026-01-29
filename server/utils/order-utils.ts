import { db } from "../db.js";
import { marketplaceOrders } from "../../shared/schema.js";
import { desc, sql } from "drizzle-orm";
import { logger } from "./logger";

/**
 * Ensures the order number sequence exists in the database.
 * This should be called once during application initialization.
 * Automatically adjusts sequence to MAX(order_number) + 1 to prevent duplicates.
 */
export async function initializeOrderNumberSequence(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE SEQUENCE IF NOT EXISTS marketplace_order_number_seq START WITH 1000;
    `);
    
    const maxResult = await db.execute(sql`
      SELECT COALESCE(MAX(order_number), 999) as max_order_number 
      FROM marketplace_orders
    `);
    const maxOrderNumber = Number(maxResult.rows[0]?.max_order_number || 999);
    
    await db.execute(sql`
      SELECT setval('marketplace_order_number_seq', ${maxOrderNumber}, true)
    `);
    
    logger.info(`[Order Utils] Order number sequence initialized and set to ${maxOrderNumber + 1}`);
  } catch (error) {
    logger.error('[Order Utils] Error initializing sequence:', error);
  }
}

/**
 * Generates the next sequential order number using database sequence.
 * This approach ensures atomicity and prevents race conditions.
 * Starts from 1000 for a professional look.
 * Retries on duplicate errors to handle rare race conditions.
 */
export async function generateOrderNumber(retries = 3): Promise<number> {
  try {
    const result = await db.execute(sql`
      SELECT nextval('marketplace_order_number_seq') as next_number;
    `);
    
    const orderNumber = Number(result.rows[0]?.next_number);
    
    if (!orderNumber || isNaN(orderNumber)) {
      logger.error('[Order Utils] Invalid order number from sequence:', result.rows[0]);
      throw new Error('Failed to generate valid order number from sequence');
    }
    
    return orderNumber;
  } catch (error: any) {
    if (error.message?.includes('does not exist')) {
      logger.warn('[Order Utils] Sequence not found, initializing...');
      await initializeOrderNumberSequence();
      return generateOrderNumber(retries);
    }
    
    if (error.code === '23505' && retries > 0) {
      logger.warn(`[Order Utils] Duplicate order number detected, retrying... (${retries} attempts left)`);
      return generateOrderNumber(retries - 1);
    }
    
    logger.error('[Order Utils] Error generating order number:', error);
    throw new Error('Failed to generate order number');
  }
}

/**
 * Generates a human-readable order description for payment gateways
 * Format: "Pedido #1234 - Product Name"
 * Truncates product name to keep description clean and under length limits
 */
export function generateOrderDescription(orderNumber: number, productName: string): string {
  const maxProductNameLength = 40;
  let cleanProductName = productName.trim();
  
  if (cleanProductName.length > maxProductNameLength) {
    cleanProductName = cleanProductName.substring(0, maxProductNameLength - 3) + '...';
  }
  
  return `Pedido #${orderNumber} - ${cleanProductName}`;
}
