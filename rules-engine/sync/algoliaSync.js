import algoliasearch from "algoliasearch";
import sql from "mssql";
import dbConfig from "../config/dbConfig.json" with { type: "json" };
import dotenv from "dotenv";

dotenv.config();

// ⚙️ Setup Algolia
const client = algoliasearch(
  process.env.ALGOLIA_APP_ID,
  process.env.ALGOLIA_API_KEY
);
const index = client.initIndex(process.env.ALGOLIA_INDEX_NAME);

// ⚙️ Connect to SQL
async function connectDB() {
  return await sql.connect(dbConfig);
}

// 🧾 Fetch new/updated rules
async function fetchRules() {
  const pool = await connectDB();
  const result = await pool.request()
    .query(`SELECT RuleID, ProductKeyword, RuleType, ActionDetails, ConfidenceScore, Priority, ApprovedBy, UpdatedAt FROM Rules_Item`);
  return result.recordset;
}

// 🔁 Sync to Algolia
async function syncToAlgolia() {
  console.log("🔄 Starting Algolia Sync...");
  const records = await fetchRules();

  // Format objects for Algolia
  const objects = records.map(r => ({
    objectID: r.RuleID,
    keyword: r.ProductKeyword,
    type: r.RuleType,
    details: JSON.parse(r.ActionDetails),
    confidence: r.ConfidenceScore,
    priority: r.Priority,
    approvedBy: r.ApprovedBy,
    updatedAt: r.UpdatedAt
  }));

  await index.saveObjects(objects);
  console.log(`✅ Synced ${objects.length} rules to Algolia`);
}

// Run directly
syncToAlgolia()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("❌ Sync failed:", err);
    process.exit(1);
  });
