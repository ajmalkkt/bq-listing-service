# bq-listing-service

A multi-vertical listing microservice for the [BrowseQatar](https://browseqatar.com) platform. Provides a unified REST API for managing listings across all verticals — **Vehicles**, **Accommodations**, **Services**, **Classifieds**, **Jobs**, and **Restaurant Offers** — along with restaurant management, bulk operations, enquiries, and user authentication.

## Table of Contents

- [Overview](#overview)
- [Verticals Supported](#verticals-supported)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [API Reference](#api-reference)
  - [Listings](#listings)
  - [Restaurant Offers](#restaurant-offers)
  - [Restaurants](#restaurants)
  - [Enquiries](#enquiries)
  - [Authentication](#authentication)
  - [Bulk Operations](#bulk-operations)
- [Data Models](#data-models)
- [Scripts](#scripts)
- [Deployment (GCP)](#deployment-gcp)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

`bq-listing-service` is the backend Node.js/Express service that powers the BrowseQatar multi-vertical marketplace. It exposes a JSON REST API, connects to MongoDB Atlas, uses Firebase Admin for authentication, and integrates with Google Cloud Storage for image uploads.

The service supports in-memory caching with automatic invalidation via MongoDB change streams, keeping response times fast without stale data.

---

## Verticals Supported

| Vertical ID      | Description                    |
|-----------------|-------------------------------|
| `vehicles`       | Buy & sell cars and bikes      |
| `accommodations` | Apartments, villas, rooms      |
| `services`       | Cleaning, repairs, IT, etc.    |
| `classifieds`    | General buy & sell items       |
| `jobs`           | Job listings                   |
| `restaurants`    | Restaurant offers & promotions |

---

## Tech Stack

- **Runtime:** Node.js (ESM)
- **Framework:** Express.js
- **Database:** MongoDB via Mongoose
- **Auth:** Firebase Admin SDK (JWT verification)
- **Storage:** Google Cloud Storage (image uploads)
- **Caching:** node-cache (in-memory, TTL-based)
- **Email:** SendGrid / Nodemailer
- **File Uploads:** Multer

---

## Getting Started

### Prerequisites

- Node.js 18+
- A MongoDB Atlas connection string
- A Firebase service account JSON
- (Optional) A Google Cloud Storage bucket for image uploads

### Installation

```bash
git clone https://github.com/ajmalkkt/bq-listing-service.git
cd bq-listing-service
npm install
```

### Run in Development

```bash
npm run dev
```

### Run in Production

```bash
npm start
```

The server starts on `http://localhost:5000` by default (configurable via `PORT`).

---

## Configuration

Create a `.env` file in the project root based on the variables below:

```env
# Server
PORT=5000
NODE_ENV=development
PROTOCOL=https

# MongoDB
MONGO_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/bq-listing

# Firebase Admin
FIREBASE_SERVICE_ACCOUNT_KEY=./serviceAccountKey.json

# Google Cloud Storage
GCS_BUCKET_NAME=your-bucket-name

# SendGrid (email)
SENDGRID_API_KEY=SG.xxxxx

# API Security
API_TOKEN=your-internal-api-token
```

> **Note:** Never commit `.env` or `serviceAccountKey.json` to version control. Both are listed in `.gitignore`.

---

## API Reference

All routes are prefixed with `/api`. Authentication uses Firebase Bearer tokens unless marked **Public**.

### Listings

Base path: `/api/listings`

| Method | Endpoint              | Auth     | Description                              |
|--------|-----------------------|----------|------------------------------------------|
| GET    | `/`                   | Public   | Get all listings (filtered)              |
| GET    | `/:id`                | Public   | Get a single listing by ID               |
| GET    | `/verticals`          | Public   | Get all enabled verticals                |
| POST   | `/`                   | Admin    | Create a new listing                     |
| PUT    | `/:id`                | Admin    | Update a listing                         |

#### Query Parameters — `GET /api/listings`

| Param      | Type   | Description                                      |
|------------|--------|--------------------------------------------------|
| `vertical` | string | Filter by vertical (e.g. `vehicles`, `jobs`)     |
| `category` | string | Filter by category                               |
| `city`     | string | Filter by city                                   |
| `search`   | string | Text search on title & description               |
| `status`   | string | `active` (default) or `inactive`                |

#### Example

```bash
# Get all active vehicle listings
curl http://localhost:5000/api/listings?vertical=vehicles

# Get a single listing
curl http://localhost:5000/api/listings/101
```

---

### Restaurant Offers

Base path: `/api/offers`

| Method | Endpoint                    | Auth     | Description                          |
|--------|-----------------------------|----------|--------------------------------------|
| GET    | `/`                         | Public   | Get all offers (filtered)            |
| GET    | `/:id`                      | Public   | Get offer by ID                      |
| GET    | `/:id/image`                | Public   | Get offer image                      |
| POST   | `/`                         | Admin    | Create offer (multipart/form-data)   |
| PUT    | `/:id`                      | Admin    | Update offer                         |
| DELETE | `/:id`                      | Admin    | Delete offer                         |
| PATCH  | `/inactivate`               | Admin    | Bulk inactivate offers               |
| PATCH  | `/bulk-activate`            | Admin    | Bulk activate offers                 |

#### Query Parameters — `GET /api/offers`

| Param        | Type   | Description                        |
|--------------|--------|------------------------------------|
| `restaurant` | string | Filter by restaurant ID            |
| `cuisine`    | string | Filter by cuisine type             |
| `city`       | string | Filter by city                     |
| `search`     | string | Text search on title/description   |

---

### Restaurants

Base path: `/api/restaurants`

| Method | Endpoint   | Auth     | Description              |
|--------|------------|----------|--------------------------|
| GET    | `/`        | Public   | Get all restaurants      |
| GET    | `/:id`     | Public   | Get restaurant by ID     |
| POST   | `/`        | Admin    | Create restaurant        |
| PUT    | `/:id`     | Admin    | Update restaurant        |
| DELETE | `/:id`     | Admin    | Delete restaurant        |

---

### Enquiries

Base path: `/api/enquiry`

| Method | Endpoint | Auth   | Description           |
|--------|----------|--------|-----------------------|
| POST   | `/`      | Public | Submit an enquiry     |
| GET    | `/`      | Admin  | Get all enquiries     |

---

### Authentication

Base path: `/api/auth`

| Method | Endpoint    | Auth   | Description              |
|--------|-------------|--------|--------------------------|
| POST   | `/register` | Public | Register a new user      |
| POST   | `/login`    | Public | Login (returns token)    |
| GET    | `/me`       | Token  | Get current user profile |

---

### Bulk Operations

Base path: `/api/bulk`

| Method | Endpoint  | Auth  | Description                          |
|--------|-----------|-------|--------------------------------------|
| POST   | `/upload` | Admin | Bulk upload listings via Excel/CSV   |

---

## Data Models

### Listing

```js
{
  id: Number,               // Auto-incremented sequence ID
  verticalId: String,       // e.g. 'vehicles', 'jobs'
  providerId: Number,
  title: String,
  description: String,
  category: String,
  subcategory: String,
  attributes: Mixed,        // Vertical-specific fields (make, model, bedrooms, etc.)
  pricing: {
    originalPrice: Number,
    discountedPrice: Number,
    currency: String,       // Default: 'QAR'
    unit: String            // e.g. 'night', 'day', 'session'
  },
  validity: {
    from: Date,
    to: Date
  },
  location: {
    city: String,
    country: String,
    address: String
  },
  imageUrl: String,
  galleryUrls: [String],
  status: String,           // 'active' | 'inactive' | 'pending' | 'archived'
  active: Boolean,
  rating: Number,
  reviewsCount: Number,
  ownerLogin: String,
  createdAt: Date,
  updatedAt: Date
}
```

---

## Scripts

Utility scripts located in `./scripts/`:

| Script              | Description                                  |
|--------------------|----------------------------------------------|
| `seedVerticals.js`  | Seeds the `verticals` collection in MongoDB  |

```bash
node scripts/seedVerticals.js
```

---

## Deployment (GCP)

The service is designed for Google App Engine (Standard / Flexible) or Cloud Run.

```bash
# Deploy to App Engine
gcloud app deploy

# Or build and deploy to Cloud Run
gcloud run deploy bq-listing-service \
  --source . \
  --region asia-south1 \
  --allow-unauthenticated
```

Refer to the `.agent/skills/gcp/SKILL.md` for full deployment instructions.

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/my-change`
3. Make changes and commit: `git commit -m "feat: describe change"`
4. Push and open a Pull Request

Please follow existing code style and document any new API endpoints in this README.

---

## License

MIT License — see [LICENSE](LICENSE) file.

**Maintainer:** [@ajmalkkt](https://github.com/ajmalkkt)
