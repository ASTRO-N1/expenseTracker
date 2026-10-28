/**
 * upload-receipt/index.js
 * POST /api/upload-receipt
 *
 * Receives a multipart form-data file upload and stores
 * it in Azure Blob Storage. Returns the blob URL.
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
      context.res = { status: 500, headers, body: JSON.stringify({ error: 'Storage not configured' }) };
      return;
    }

    // Parse multipart body — Azure Functions v4 provides req.body as Buffer
    // For binary upload, we expect the file in req.body when Content-Type is image/*
    const fileBuffer = req.body;
    if (!fileBuffer || fileBuffer.length === 0) {
      context.res = { status: 400, headers, body: JSON.stringify({ error: 'No file data received' }) };
      return;
    }

    const expenseId = req.query.expenseId || uuidv4();
    const contentType = req.headers['content-type'] || 'application/octet-stream';
    const ext = contentType.includes('jpeg') || contentType.includes('jpg') ? '.jpg'
      : contentType.includes('png') ? '.png'
      : contentType.includes('pdf') ? '.pdf'
      : '.bin';

    const blobName = `receipts/${expenseId}/${uuidv4()}${ext}`;

    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobServiceClient.getContainerClient(containerName);
    await containerClient.createIfNotExists({ access: 'blob' });

    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    await blockBlobClient.upload(fileBuffer, fileBuffer.length, {
      blobHTTPHeaders: { blobContentType: contentType },
    });

    const url = blockBlobClient.url;
    context.res = { status: 200, headers, body: JSON.stringify({ url, blobName }) };
  } catch (err) {
    context.log.error('upload-receipt error:', err);
    context.res = { status: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
