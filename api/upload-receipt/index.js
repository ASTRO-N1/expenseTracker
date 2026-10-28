/**
 * upload-receipt/index.js
 * POST /api/upload-receipt
 *
 * Receives base64 image data in JSON body and uploads to Azure Blob Storage.
 * Returns the blob URL.
 */

const { BlobServiceClient } = require('@azure/storage-blob');
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
    const connectionString = process.env.STORAGE_CONNECTION_STRING;
    const containerName = process.env.STORAGE_CONTAINER_NAME || 'receipts';

    if (!connectionString) {
      context.res = {
        status: 500,
        headers,
        body: JSON.stringify({ error: 'STORAGE_CONNECTION_STRING environment variable is missing in Azure Static Web App settings.' }),
      };
      return;
    }

    const { filename, contentType, data, expenseId } = req.body || {};
    if (!data) {
      context.res = {
        status: 400,
        headers,
        body: JSON.stringify({ error: 'No file data received. Expected JSON with base64 data.' }),
      };
      return;
    }

    const fileBuffer = Buffer.from(data, 'base64');
    const safeContentType = contentType || 'image/jpeg';
    const ext = filename ? ('.' + filename.split('.').pop()) : '.jpg';
    const blobName = `receipts/${expenseId || uuidv4()}/${uuidv4()}${ext}`;

    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobServiceClient.getContainerClient(containerName);

    // Create container if it doesn't exist (without access='blob' to prevent PublicAccessNotPermitted errors)
    await containerClient.createIfNotExists();

    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    await blockBlobClient.upload(fileBuffer, fileBuffer.length, {
      blobHTTPHeaders: { blobContentType: safeContentType },
    });

    const url = blockBlobClient.url;
    context.res = { status: 200, headers, body: JSON.stringify({ url, blobName }) };
  } catch (err) {
    context.log.error('upload-receipt error:', err);
    context.res = { status: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
