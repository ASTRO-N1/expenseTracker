/**
 * delete-expense/index.js
 * DELETE /api/delete-expense/{id}
 *
 * Permanently deletes an expense document from Cosmos DB.
 */

const { getContainer } = require('../shared/cosmosClient');

module.exports = async function (context, req) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
  };

  if (req.method === 'OPTIONS') {
    context.res = { status: 204, headers };
    return;
  }

  try {
    const container = await getContainer();
    const userId = getUserId(req);
    const id = context.bindingData.id;

    if (!id) {
      context.res = { status: 400, headers, body: JSON.stringify({ error: 'Expense ID is required' }) };
      return;
    }

    // Verify ownership before deleting
    const { resource: existing } = await container.item(id, userId).read();
    if (!existing) {
      context.res = { status: 404, headers, body: JSON.stringify({ error: 'Expense not found' }) };
      return;
    }
    if (existing.userId !== userId) {
      context.res = { status: 403, headers, body: JSON.stringify({ error: 'Forbidden' }) };
      return;
    }

    await container.item(id, userId).delete();
    context.res = { status: 200, headers, body: JSON.stringify({ success: true, id }) };
  } catch (err) {
    context.log.error('delete-expense error:', err);
    context.res = { status: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};

function getUserId(req) {
  try {
    const header = req.headers['x-ms-client-principal'];
    if (header) { return JSON.parse(Buffer.from(header, 'base64').toString('utf-8')).userId; }
  } catch {}
  return 'anonymous';
}
