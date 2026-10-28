/**
 * get-expenses/index.js
 * GET /api/get-expenses?year=2026&month=10
 *
 * Returns all expenses for the authenticated user
 * in the specified month and year.
 */

const { container } = require('../shared/cosmosClient');

module.exports = async function (context, req) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };

  if (req.method === 'OPTIONS') {
    context.res = { status: 204, headers };
    return;
  }

  try {
    // Get authenticated user from SWA auth headers
    const userId = getUserId(req);

    const year  = parseInt(req.query.year  || new Date().getFullYear());
    const month = parseInt(req.query.month || new Date().getMonth() + 1);

    // Build date range for the given month
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate   = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`;

    const querySpec = {
      query: `SELECT * FROM c
              WHERE c.userId = @userId
                AND c.date >= @startDate
                AND c.date <= @endDate
              ORDER BY c.date DESC`,
      parameters: [
        { name: '@userId',    value: userId },
        { name: '@startDate', value: startDate },
        { name: '@endDate',   value: endDate },
      ],
    };

    const { resources } = await container.items.query(querySpec).fetchAll();

    context.res = {
      status: 200,
      headers,
      body: JSON.stringify(resources),
    };
  } catch (err) {
    context.log.error('get-expenses error:', err);
    context.res = {
      status: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};

function getUserId(req) {
  try {
    const header = req.headers['x-ms-client-principal'];
    if (header) {
      const decoded = Buffer.from(header, 'base64').toString('utf-8');
      const principal = JSON.parse(decoded);
      return principal.userId;
    }
  } catch {}
  return req.query.userId || 'anonymous';
}
