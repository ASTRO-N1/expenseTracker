/**
 * cosmosClient.js — Shared Cosmos DB client instance
 * Used by all Azure Function handlers
 */

const { CosmosClient } = require('@azure/cosmos');

const client = new CosmosClient(process.env.COSMOS_CONNECTION_STRING);
const database = client.database(process.env.COSMOS_DATABASE_ID || 'ExpenseTrackerDB');
const container = database.container(process.env.COSMOS_CONTAINER_ID || 'Expenses');

module.exports = { client, database, container };
