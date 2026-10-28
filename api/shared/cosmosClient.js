/**
 * cosmosClient.js — Shared Cosmos DB client instance
 * Used by all Azure Function handlers
 */

const { CosmosClient } = require('@azure/cosmos');

let client = null;
let container = null;

async function getContainer() {
  if (container) return container;

  const connStr = process.env.COSMOS_CONNECTION_STRING;
  if (!connStr) {
    throw new Error('COSMOS_CONNECTION_STRING is missing in Azure Static Web App environment variables.');
  }

  if (!client) {
    client = new CosmosClient(connStr);
  }

  const dbId = process.env.COSMOS_DATABASE_ID || 'ExpenseTrackerDB';
  const containerId = process.env.COSMOS_CONTAINER_ID || 'Expenses';

  const database = client.database(dbId);
  container = database.container(containerId);

  return container;
}

module.exports = { getContainer };
