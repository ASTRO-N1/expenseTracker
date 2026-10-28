/**
 * update-expense/index.js
 * PUT /api/update-expense/{id}
 *
 * Updates an existing expense document in Cosmos DB.
 */

const { container } = require('../shared/cosmosClient');

module.exports = async function (context, req) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (req.method === 'OPTIONS') {
    context.res = { status: 204, headers };
    return;
  }

  try {
    const userId = getUserId(req);
    const id = context.bindingData.id;
    const body = req.body;

    if (!id) {
      context.res = { status: 400, headers, body: JSON.stringify({ error: 'Expense ID is required' }) };
      return;
    }

    // Read existing item first (partition key = userId)
    const { resource: existing } = await container.item(id, userId).read();
    if (!existing) {
      context.res = { status: 404, headers, body: JSON.stringify({ error: 'Expense not found' }) };
      return;
    }

    // Ensure user owns this item
    if (existing.userId !== userId) {
      context.res = { status: 403, headers, body: JSON.stringify({ error: 'Forbidden' }) };
      return;
    }

    const updated = {
      ...existing,
      amount:        body.amount !== undefined ? parseFloat(body.amount) : existing.amount,
      date:          body.date          || existing.date,
      description:   body.description   ? body.description.trim() : existing.description,
      category:      body.category      || existing.category,
      paymentMethod: body.paymentMethod || existing.paymentMethod,
      notes:         body.notes !== undefined ? body.notes : existing.notes,
      receiptUrl:    body.receiptUrl !== undefined ? body.receiptUrl : existing.receiptUrl,
      updatedAt:     new Date().toISOString(),
    };

    const { resource } = await container.item(id, userId).replace(updated);
    context.res = { status: 200, headers, body: JSON.stringify(resource) };
  } catch (err) {
    context.log.error('update-expense error:', err);
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
