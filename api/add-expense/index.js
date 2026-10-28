/**
 * add-expense/index.js
 * POST /api/add-expense
 *
 * Body: { amount, date, description, category, paymentMethod, notes, receiptUrl }
 * Creates a new expense document in Cosmos DB.
 */

const { container } = require('../shared/cosmosClient');
const { v4: uuidv4 } = require('uuid');

module.exports = async function (context, req) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (req.method === 'OPTIONS') {
    context.res = { status: 204, headers };
    return;
  }

  try {
    const userId = getUserId(req);
    const body = req.body;

    // Input validation
    if (!body.amount || !body.date || !body.description || !body.category) {
      context.res = {
        status: 400, headers,
        body: JSON.stringify({ error: 'Missing required fields: amount, date, description, category' }),
      };
      return;
    }
    if (isNaN(parseFloat(body.amount)) || parseFloat(body.amount) <= 0) {
      context.res = { status: 400, headers, body: JSON.stringify({ error: 'Amount must be a positive number' }) };
      return;
    }

    const newExpense = {
      id:            uuidv4(),
      userId:        userId,
      amount:        parseFloat(body.amount),
      date:          body.date,
      description:   body.description.trim(),
      category:      body.category,
      paymentMethod: body.paymentMethod || 'Card',
      notes:         body.notes || '',
      receiptUrl:    body.receiptUrl || null,
      createdAt:     new Date().toISOString(),
      updatedAt:     new Date().toISOString(),
    };

    const { resource } = await container.items.create(newExpense);

    context.res = { status: 201, headers, body: JSON.stringify(resource) };
  } catch (err) {
    context.log.error('add-expense error:', err);
    context.res = { status: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};

function getUserId(req) {
  try {
    const header = req.headers['x-ms-client-principal'];
    if (header) {
      const decoded = Buffer.from(header, 'base64').toString('utf-8');
      return JSON.parse(decoded).userId;
    }
  } catch {}
  return 'anonymous';
}
