import { db } from "@db";
import { marketplaceProducts, marketplaceOrders } from "@shared/schema";
import { generateUniqueSlug } from "../utils/slug-utils";
import { eq, isNull, sql } from "drizzle-orm";

/**
 * Migration script to generate slugs for existing products
 * Run this once to populate slugs for all products that don't have one
 */
async function migrateProductSlugs() {
  try {
    console.log('[Slug Migration] Starting migration...');

    const productsWithoutSlug = await db
      .select()
      .from(marketplaceProducts)
      .where(isNull(marketplaceProducts.slug));

    console.log(`[Slug Migration] Found ${productsWithoutSlug.length} products without slugs`);

    if (productsWithoutSlug.length === 0) {
      console.log('[Slug Migration] All products already have slugs. Migration complete!');
      return;
    }

    const checkSlugExists = async (slug: string) => {
      const existing = await db
        .select()
        .from(marketplaceProducts)
        .where(eq(marketplaceProducts.slug, slug))
        .limit(1);
      return existing.length > 0;
    };

    let successCount = 0;
    let errorCount = 0;

    for (const product of productsWithoutSlug) {
      try {
        const slug = await generateUniqueSlug(product.title, checkSlugExists);
        
        await db
          .update(marketplaceProducts)
          .set({ slug })
          .where(eq(marketplaceProducts.id, product.id));

        successCount++;
        console.log(`[Slug Migration] ✓ Generated slug "${slug}" for product "${product.title}"`);
      } catch (error) {
        errorCount++;
        console.error(`[Slug Migration] ✗ Error generating slug for product "${product.title}":`, error);
      }
    }

    console.log(`[Slug Migration] Migration complete!`);
    console.log(`[Slug Migration] Success: ${successCount}, Errors: ${errorCount}`);
  } catch (error) {
    console.error('[Slug Migration] Fatal error during migration:', error);
    throw error;
  }
}

/**
 * IMPORTANT: This migration should be run during maintenance mode (server offline)
 * to prevent race conditions with concurrent checkouts creating new orders.
 * If run while server is online, new checkouts may create duplicate order numbers.
 */
async function migrateOrderNumbers() {
  try {
    console.log('[Order Number Migration] ⚠️  IMPORTANT: Run this during maintenance mode (server offline)');
    console.log('[Order Number Migration] Starting migration...');

    const ordersWithoutNumber = await db
      .select()
      .from(marketplaceOrders)
      .where(isNull(marketplaceOrders.orderNumber));

    console.log(`[Order Number Migration] Found ${ordersWithoutNumber.length} orders without numbers`);

    if (ordersWithoutNumber.length === 0) {
      console.log('[Order Number Migration] All orders already have numbers. Checking sequence...');
      
      const maxResult = await db.execute(sql`
        SELECT COALESCE(MAX(order_number), 999) as max_order_number 
        FROM marketplace_orders
      `);
      const maxOrderNumber = Number((maxResult.rows[0] as any)?.max_order_number || 999);
      
      await db.execute(sql`
        SELECT setval('marketplace_order_number_seq', ${maxOrderNumber}, true)
      `);
      
      console.log(`[Order Number Migration] Sequence adjusted to start at ${maxOrderNumber + 1}`);
      return;
    }

    await db.transaction(async (tx) => {
      const maxResult = await tx.execute(sql`
        SELECT COALESCE(MAX(order_number), 999) as max_order_number 
        FROM marketplace_orders 
        FOR UPDATE
      `);
      
      let nextOrderNumber = Number((maxResult.rows[0] as any)?.max_order_number || 999) + 1;
      let successCount = 0;

      for (const order of ordersWithoutNumber) {
        await tx
          .update(marketplaceOrders)
          .set({ orderNumber: nextOrderNumber })
          .where(eq(marketplaceOrders.id, order.id));

        successCount++;
        console.log(`[Order Number Migration] ✓ Assigned order number ${nextOrderNumber} to order ${order.id}`);
        nextOrderNumber++;
      }

      await tx.execute(sql`
        SELECT setval('marketplace_order_number_seq', ${nextOrderNumber - 1}, true)
      `);
      
      console.log(`[Order Number Migration] Sequence updated to start at ${nextOrderNumber}`);
      console.log(`[Order Number Migration] Migration complete! Success: ${successCount}`);
    });
  } catch (error) {
    console.error('[Order Number Migration] Error during migration:', error);
    throw error;
  }
}

if (require.main === module) {
  Promise.all([
    migrateProductSlugs(),
    migrateOrderNumbers()
  ])
    .then(() => {
      console.log('[Migration] All migrations complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('[Migration] Migration failed:', error);
      process.exit(1);
    });
}

export { migrateProductSlugs, migrateOrderNumbers };
