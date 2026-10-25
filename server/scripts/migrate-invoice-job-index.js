import 'dotenv/config';
import mongoose from 'mongoose';

async function migrate() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI must be configured before running the invoice index migration.');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const collections = await db.listCollections({ name: 'invoices' }).toArray();
  if (collections.length === 0) {
    await db.createCollection('invoices');
  }

  const invoices = db.collection('invoices');
  const indexes = await invoices.indexes();
  for (const index of indexes) {
    const keys = Object.keys(index.key || {});
    const isJobCardIndex = keys.length === 1 && index.key.jobCard === 1;
    const isTargetIndex =
      index.name === 'active_invoice_per_job' &&
      index.unique === true &&
      index.partialFilterExpression?.isVoided === false;

    if (isJobCardIndex && !isTargetIndex) {
      await invoices.dropIndex(index.name);
    }
  }

  await invoices.createIndex(
    { jobCard: 1 },
    {
      unique: true,
      partialFilterExpression: { isVoided: false },
      name: 'active_invoice_per_job',
    }
  );

  console.log('Invoice index migration complete. Voided invoices can now be reissued against the same job.');
}

migrate()
  .catch((err) => {
    console.error('Invoice index migration failed:', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
