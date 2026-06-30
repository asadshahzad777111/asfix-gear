# AsFix & Gear

**Mobile Repair + Accessories Shop** by Asad.

A full-stack website with a modern React frontend and Node.js/Express backend with SQLite database.

## Features

- **Home** — Hero, services overview, featured products
- **Shop** — Browse accessories with category filters and search
- **Repair** — View repair services and book appointments
- **Contact** — Send messages to the shop
- **Admin** — Manage repair bookings and products

## Tech Stack

| Layer    | Technology              |
|----------|-------------------------|
| Frontend | React 19 + Vite         |
| Backend  | Node.js + Express       |
| Database | SQLite (better-sqlite3) |

## Setup

```bash
# Install all dependencies
npm run install:all

# Seed sample products & repair services
npm run seed

# Run frontend + backend together
npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:5000

## API Endpoints

| Method | Endpoint                        | Description           |
|--------|---------------------------------|-----------------------|
| GET    | `/api/products`                 | List products         |
| GET    | `/api/products/:id`             | Product detail        |
| POST   | `/api/products`                 | Add product (admin)   |
| GET    | `/api/repairs/services`         | Repair services       |
| POST   | `/api/repairs/book`             | Book repair           |
| GET    | `/api/repairs/bookings`         | All bookings (admin)  |
| POST   | `/api/contact`                  | Send contact message  |

## Customize

Update your shop details in `frontend/src/pages/Contact.jsx`:
- Shop address
- Phone / WhatsApp number
- Email
- Opening hours
