# Smart Summary & Insight Service

An AI-powered backend service for **Central Park Puppies** that generates intelligent summaries, insights, and next actions from structured data and free-text notes.

## Features

* **AI-Powered Analysis**: Uses Claude LLM to generate summaries, insights, and actions.
* **RESTful API**: Clean, well-documented API endpoints.
* **Caching**: Redis-based caching for performance and cost optimization.
* **Async Processing**: Background job processing for long-running analyses.
* **Production-Ready**: Error handling, logging, monitoring, and health checks.
* **Extensible Design**: Pluggable LLM providers and modular architecture.
* **Comprehensive Testing**: Unit and integration tests included.

---

## Prerequisites

* Node.js 20+
* Redis 7+
* Claude API key

---

## Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/yourusername/smart-summary-service.git
cd smart-summary-service
cp .env.example .env
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

Edit `.env` with your Claude API key:

```bash
CLAUDE_API_KEY=your-claude-api-key-here
```

### 4. Start Redis

```bash
# Using Docker
docker run -p 6379:6379 redis:7-alpine

# Or using docker-compose
docker-compose up redis
```

### 5. Start the service

```bash
# Development mode
npm run dev

# Production mode
npm start
```

---

## Using Docker

```bash
# Build and run all services
docker-compose up --build

# Or build individual container
docker build -t smart-summary-service .
docker run -p 3000:3000 --env-file .env smart-summary-service
```

---

## API Documentation

The service exposes Swagger-based API documentation at:

```
http://localhost:3000/api/docs
```

This provides an interactive interface to explore all endpoints, request/response schemas, and try out API calls directly.

If you want to test using Postman, you can also import the collection:

* `postman_collection.json` which you can find in project root


## Testing

The service includes **integration tests covering all major API endpoints**:

```bash
# Run all tests
npm test
```

For Docker-based testing:

```bash
# Build and run test containers
npm run docker:test

# Tear down test containers
npm run docker:test:down
```

---

## Scripts

| Script                     | Description                                            |
| -------------------------- | ------------------------------------------------------ |
| `npm run dev`              | Start the service in development mode with hot reload. |
| `npm start`                | Start the service in production mode.                  |
| `npm run build`            | Compile TypeScript to JavaScript.                      |
| `npm test`                 | Run Jest tests.                                        |
| `npm run docker:build`     | Build Docker image.                                    |
| `npm run docker:run`       | Run Docker container.                                  |
| `npm run docker:up`        | Run services via docker-compose.                       |
| `npm run docker:up:build`  | Build and run services via docker-compose.             |
| `npm run docker:down`      | Stop docker-compose services.                          |
| `npm run docker:logs`      | View logs of docker-compose services.                  |
| `npm run docker:test`      | Run integration tests using Docker.                    |
| `npm run docker:test:down` | Tear down test Docker services.                        |


