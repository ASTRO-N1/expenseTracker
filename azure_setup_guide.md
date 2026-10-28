# ☁️ Azure Cloud Expense Tracker: $0 Zero-Cost Setup Guide

This guide walks you through every exact click in the Azure Portal to set up **Cosmos DB**, **Blob Storage**, **Azure Functions**, and **Azure Static Web Apps** safely within Azure's Free Tiers without consuming your credits.

---

## 🛡️ Phase 0: Essential Safety & Cost Guardrails (Do This First!)

Before provisioning anything:
1. Log in to [Azure Portal](https://portal.azure.com/).
2. In the top search bar, search for **Cost Management + Billing**.
3. Select your **Subscription** (e.g., Azure for Students or Free Trial).
4. Click **Budgets** under *Cost Management* in the left menu -> Click **+ Add**.
   - **Name**: `ZeroSpendAlert`
   - **Reset Period**: Monthly
   - **Amount**: `1` (or $5)
   - Click **Next** to Alert Conditions:
     - Set alert trigger to **80%** and **100%**.
     - Enter your email address.
   - Click **Create**.
5. Keep **Spending Limit** set to **ON** (default on student/credit subscriptions).

---

## 📦 Phase 1: Create a Unified Resource Group

Grouping all services together makes management and cleanup effortless.

1. Search for **Resource groups** in the top search bar.
2. Click **+ Create**.
3. Configure:
   - **Subscription**: Your active subscription
   - **Resource group**: `rg-expensetracker-prod`
   - **Region**: Choose a region close to you that supports Free Tier (Recommended: `East US` or `Central US` or `Southeast Asia`).
4. Click **Review + create** -> **Create**.

---

## 🗄️ Phase 2: Provision Azure Cosmos DB (NoSQL) - 100% Free Forever

> ⚠️ **CRITICAL WARNING**: You MUST check the Free Tier discount toggle. Azure only allows **one** free Cosmos DB account per subscription (giving 1,000 RU/s and 25 GB free forever).

1. Search for **Azure Cosmos DB** in the top search bar.
2. Click **+ Create** -> Choose **Azure Cosmos DB for NoSQL** (click *Create*).
3. On the **Basics** tab:
   - **Subscription**: Your subscription
   - **Resource Group**: `rg-expensetracker-prod`
   - **Account Name**: `cosmos-expensetracker-[yourinitials]` (must be globally unique, all lowercase)
   - **Location**: Same region as your resource group (e.g., `East US`)
   - **Capacity mode**: Select **Provisioned throughput** (Required for the Free Tier discount!)
   - **Apply Free Tier Discount**: **Apply** (Make sure this toggle is explicitly clicked and selected! You will see a banner confirming the 1000 RU/s and 25 GB free discount).
4. On the **Backup Policy** tab:
   - Choose **Periodic** (Free) with 8-hour retention (default).
5. Click **Review + create** -> **Create**. *(Deployment takes ~3–5 minutes)*.

### Create Database & Container:
1. Once deployed, click **Go to resource**.
2. In the left menu, click **Data Explorer**.
3. Click **New Container**:
   - **Database ID**: Select **Create new** -> Name: `ExpenseTrackerDB`
   - **Database Throughput**: Uncheck "Share throughput across containers"
   - **Container ID**: `Expenses`
   - **Partition key**: `/userId`
   - **Container Throughput**: Select **Autoscale** (max 1000 RU/s) or **Manual** -> set to `400` RU/s (both fall under the 1000 RU/s free allowance).
4. Click **OK**.

### Keys to Copy for Later:
- In the Cosmos DB menu, click **Keys**.
- Copy:
  - **URI**
  - **PRIMARY KEY** (or **PRIMARY CONNECTION STRING**)

---

## 📁 Phase 3: Provision Azure Blob Storage (Receipt Uploads)

1. Search for **Storage accounts** in the top search bar -> Click **+ Create**.
2. On the **Basics** tab:
   - **Resource Group**: `rg-expensetracker-prod`
   - **Storage account name**: `strexpenses[yourinitials]` (only lowercase letters & numbers, 3-24 characters)
   - **Region**: Same region as your resource group
   - **Performance**: **Standard** (Do NOT choose Premium!)
   - **Redundancy**: Select **Locally-redundant storage (LRS)** (Lowest cost & covered under 12-month free tier).
3. On the **Advanced** tab:
   - Allow blob anonymous access: **Enabled** (or keep disabled if generating SAS tokens via API).
4. Click **Review + create** -> **Create**.

### Create Container for Receipts:
1. Go to the newly created Storage Account resource.
2. In the left menu under *Data storage*, click **Containers**.
3. Click **+ Container**:
   - **Name**: `receipts`
   - **Anonymous access level**: **Blob** (read-only for blobs) or **Private** (we'll fetch via secure URLs).
4. Click **Create**.

### Configure CORS (Cross-Origin Resource Sharing):
1. In the left menu under *Settings*, click **Resource Sharing (CORS)**.
2. Select **Blob service**:
   - **Allowed origins**: `*`
   - **Allowed methods**: `GET`, `POST`, `PUT`, `OPTIONS`
   - **Allowed headers**: `*`
   - **Exposed headers**: `*`
   - **Max age**: `3600`
3. Click **Save**.

### Keys to Copy for Later:
- In the left menu under *Security + networking*, click **Access keys**.
- Click **Show** next to `key1` and copy the **Connection string**.

---

## ⚡ Phase 4: Backend API Architecture (Azure Functions)

There are two optimal approaches for Azure Static Web Apps:

### Approach A (Recommended: Integrated Managed Functions):
Azure Static Web Apps has **built-in Managed Azure Functions**.
- You keep the frontend code in the root (or `/frontend`) and backend API in `/api`.
- When GitHub Actions deploys the Static Web App, Azure automatically provisions serverless API endpoints at `/api/...` with **zero extra setup**, zero manual function app provisioning, and zero cost!
- Authentication headers are automatically passed seamlessly between frontend and backend.

### Approach B (Standalone Function App):
If you prefer a standalone Azure Function App:
1. Search for **Function App** -> Click **+ Create**.
2. Select **Consumption** (Serverless).
3. Runtime: **Node.js** (LTS) or **Python**.
4. Region: Same region.
5. In Application Settings, add the Cosmos DB and Storage connection strings.

*(We recommend **Approach A** because it is completely turnkey and requires 0 additional configuration).*

---

## 🌐 Phase 5: Provision Azure Static Web Apps (Frontend + Auth)

1. Search for **Static Web Apps** in the top search bar -> Click **+ Create**.
2. On the **Basics** tab:
   - **Subscription**: Your subscription
   - **Resource Group**: `rg-expensetracker-prod`
   - **Name**: `swa-expensetracker`
   - **Plan type**: **Free** (includes 100 GB bandwidth, free SSL, managed auth).
   - **Region**: Choose a region near you (e.g., `East US 2`, `West US 2`, `Central US`).
   - **Deployment details**: Select **GitHub** (or "Other" if you want to push via GitHub Actions or deployment token).
     - Authorize GitHub and select your repository & branch `main`.
   - **Build Presets**: Custom (or React / Vanilla):
     - **App location**: `/`
     - **Api location**: `api`
     - **Output location**: `.` (or `dist` if building)
3. Click **Review + create** -> **Create**.

---

## 🔐 Phase 6: Environment Variables (Application Settings)

Once the Static Web App is created:
1. Go to your **Static Web App** in the Azure Portal.
2. Under *Settings*, click **Environment variables** (or *Configuration*).
3. Under *Application Settings*, add:
   - `COSMOS_CONNECTION_STRING`: `<Your Cosmos DB Primary Connection String>`
   - `COSMOS_DATABASE_ID`: `ExpenseTrackerDB`
   - `COSMOS_CONTAINER_ID`: `Expenses`
   - `STORAGE_CONNECTION_STRING`: `<Your Blob Storage Connection String>`
   - `STORAGE_CONTAINER_NAME`: `receipts`
4. Click **Apply** / **Save**.

---

## 📋 Credentials Checklist

When you are ready, have these handy:
- [ ] Cosmos DB Connection String / Primary Key
- [ ] Cosmos DB Container Name (`Expenses`)
- [ ] Storage Account Connection String
- [ ] Storage Container Name (`receipts`)
