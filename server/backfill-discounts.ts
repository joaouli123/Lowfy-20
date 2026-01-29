import { db } from './db';
import { marketplaceOrders, sellerTransactions } from '@shared/schema';
import { isNull, sql } from 'drizzle-orm';
import { logger } from './utils/logger';

async function backfillDiscountFields() {
  logger.info('🔄 Starting backfill for discount fields...');

  try {
    logger.info('\n📦 Updating marketplace_orders...');
    
    const ordersResult = await db
      .update(marketplaceOrders)
      .set({
        originalPriceCents: sql`amount`,
        discountCents: 0,
        grossAmountCents: sql`amount`,
      })
      .where(isNull(marketplaceOrders.originalPriceCents));

    logger.info(`✅ Updated ${ordersResult.rowCount || 0} marketplace_orders records`);

    logger.info('\n💰 Updating seller_transactions...');
    
    const transactionsResult = await db
      .update(sellerTransactions)
      .set({
        originalPriceCents: sql`amount`,
        discountCents: 0,
        grossAmountCents: sql`amount`,
      })
      .where(isNull(sellerTransactions.originalPriceCents));

    logger.info(`✅ Updated ${transactionsResult.rowCount || 0} seller_transactions records`);

    logger.info('\n🔍 Verifying backfill results...');
    
    const ordersWithNull = await db
      .select({ count: sql<number>`count(*)` })
      .from(marketplaceOrders)
      .where(isNull(marketplaceOrders.originalPriceCents));

    const transactionsWithNull = await db
      .select({ count: sql<number>`count(*)` })
      .from(sellerTransactions)
      .where(isNull(sellerTransactions.originalPriceCents));

    logger.info(`📊 Remaining NULL records in marketplace_orders: ${ordersWithNull[0]?.count || 0}`);
    logger.info(`📊 Remaining NULL records in seller_transactions: ${transactionsWithNull[0]?.count || 0}`);

    if ((ordersWithNull[0]?.count || 0) === 0 && (transactionsWithNull[0]?.count || 0) === 0) {
      logger.info('\n✅ Backfill completed successfully! All records updated.');
    } else {
      logger.warn('\n⚠️ Some records still have NULL values. Please review.');
    }

  } catch (error) {
    logger.error('❌ Error during backfill:', error);
    throw error;
  }
}

backfillDiscountFields()
  .then(() => {
    logger.info('\n✅ Backfill script finished successfully');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('\n❌ Backfill script failed:', error);
    process.exit(1);
  });
