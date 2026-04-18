# BDU Muslims Academic Bot

A Telegram bot for the **Bahir Dar University Muslim Academics Jemea (BDUMAJ)** built with Node.js, [Telegraf](https://telegraf.js.org/), and [Prisma ORM](https://www.prisma.io/) backed by PostgreSQL.

## Features

- 🕌 Welcome message and persistent custom keyboard on `/start`
- 🏫 Department selection (Software Engineering, Computer Science, Cyber Security)
- 📂 Inline keyboard to browse **Exams**, **Handouts**, and **Reference Books** per department
- 📄 Materials are stored in PostgreSQL (title, Telegram `file_id`, category, department)

## Project Structure

```
├── index.js              # Entry point — launches the bot
├── src/
│   ├── bot.js            # Telegraf bot logic (handlers, keyboards)
│   └── prismaClient.js   # Prisma client singleton
├── prisma/
│   ├── schema.prisma     # Prisma schema (Department & Material models)
│   └── seed.js           # Seed script to populate initial departments
├── .env.example          # Example environment variables
└── package.json
```

## Prerequisites

- Node.js ≥ 18
- PostgreSQL database
- A Telegram Bot token (from [@BotFather](https://t.me/BotFather))

## Setup

1. **Clone the repository and install dependencies:**

   ```bash
   npm install
   ```

2. **Configure environment variables:**

   ```bash
   cp .env.example .env
   ```

   Edit `.env` and fill in your values:

   ```env
   BOT_TOKEN=your_telegram_bot_token_here
   DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE
   ```

3. **Run database migrations:**

   ```bash
   npm run db:migrate
   ```

4. **Generate Prisma client:**

   ```bash
   npm run db:generate
   ```

5. **Seed initial departments:**

   ```bash
   npm run db:seed
   ```

6. **Start the bot:**

   ```bash
   npm start
   ```

   For development with auto-restart:

   ```bash
   npm run dev
   ```

## Database Schema

### Department

| Field       | Type     | Description                |
|-------------|----------|----------------------------|
| `id`        | Int      | Primary key (auto)         |
| `name`      | String   | Display name (unique)      |
| `slug`      | String   | URL-safe identifier (unique) |
| `createdAt` | DateTime | Timestamp                  |

### Material

| Field          | Type     | Description                              |
|----------------|----------|------------------------------------------|
| `id`           | Int      | Primary key (auto)                       |
| `title`        | String   | Display title                            |
| `fileId`       | String   | Telegram `file_id` for the document      |
| `category`     | Category | `EXAMS`, `HANDOUTS`, or `REFERENCE_BOOKS`|
| `departmentId` | Int      | Foreign key → Department                 |
| `createdAt`    | DateTime | Timestamp                                |

## Available Scripts

| Script           | Description                              |
|------------------|------------------------------------------|
| `npm start`      | Start the bot                            |
| `npm run dev`    | Start with auto-restart (Node.js watch)  |
| `npm run db:generate` | Regenerate Prisma client            |
| `npm run db:migrate`  | Run database migrations             |
| `npm run db:seed`     | Seed initial departments            |
| `npm run db:studio`   | Open Prisma Studio                  |
