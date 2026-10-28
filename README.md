# SpendWise — Expense Tracker

A cloud-based, serverless expense tracker built on Azure Free Tier.

## 🏗️ Architecture
- **Frontend**: Vanilla HTML/CSS/JS (Azure Static Web Apps — Free Tier)
- **Backend API**: Azure Functions (Managed, Consumption plan — 1M free executions/month)
- **Database**: Azure Cosmos DB NoSQL (Always Free — 1000 RU/s, 25 GB)
- **Receipt Storage**: Azure Blob Storage (12-month free — 5 GB LRS)
- **Auth**: Azure Static Web Apps built-in authentication (GitHub, Microsoft)

## 📁 Project Structure

```
SujCCminip/
├── index.html                    # Main SPA shell
├── index.css                     # Dark glassmorphism design system
├── app.js                        # Frontend application logic
├── staticwebapp.config.json      # SWA routing, auth, security headers
└── api/                          # Azure Functions (Managed)
    ├── package.json
    ├── local.settings.json       # ⚠️ DO NOT COMMIT — secrets go here
    ├── shared/
    │   └── cosmosClient.js       # Shared Cosmos DB client
    ├── get-expenses/             # GET /api/get-expenses?year=&month=
    ├── add-expense/              # POST /api/add-expense
    ├── update-expense/           # PUT /api/update-expense/{id}
    ├── delete-expense/           # DELETE /api/delete-expense/{id}
    └── upload-receipt/           # POST /api/upload-receipt
```

## 🚀 Local Development

### Prerequisites
- Node.js 18+
- [Azure Functions Core Tools v4](https://learn.microsoft.com/en-us/azure/azure-functions/functions-run-local)
- [Azure Static Web Apps CLI](https://azure.github.io/static-web-apps-cli/) (optional, for full auth emulation)

### Setup Steps

1. **Install API dependencies**
   ```bash
   cd api
   npm install
   ```

2. **Set your credentials** — Edit `api/local.settings.json`:
   ```json
   {
     "COSMOS_CONNECTION_STRING": "AccountEndpoint=https://...",
     "STORAGE_CONNECTION_STRING": "DefaultEndpointsProtocol=https;..."
   }
   ```

3. **Run locally** (dev mode bypasses Azure auth):
   - Open your browser to `index.html` directly, OR
   - Use the SWA CLI for full emulation:
     ```bash
     npx @azure/static-web-apps-cli start . --api-location api
     ```

> **Note**: When running on `localhost`, the app automatically enables **offline/dev mode** — all data is stored in localStorage and no Azure credentials are needed for the UI.

## ☁️ Deployment to Azure

1. Push this folder to a **GitHub repository**.
2. In the Azure Portal, create a **Static Web App** (Free tier), link to your GitHub repo.
3. Azure will auto-generate a GitHub Actions workflow that builds and deploys on every push.
4. Add environment variables in Azure Portal → Static Web App → Configuration:
   - `COSMOS_CONNECTION_STRING`
   - `COSMOS_DATABASE_ID` = `ExpenseTrackerDB`
   - `COSMOS_CONTAINER_ID` = `Expenses`
   - `STORAGE_CONNECTION_STRING`
   - `STORAGE_CONTAINER_NAME` = `receipts`

## 🛡️ Security
- All `/api/*` routes require authentication via `staticwebapp.config.json`.
- User data is isolated by `userId` partition key in Cosmos DB.
- Security headers (X-Frame-Options, CSP) are set via global headers.
- `local.settings.json` must be in `.gitignore` — never commit secrets.

## 💸 Cost: $0
This project runs entirely within Azure's free tiers.
