# Documenso Deployment

This directory contains the necessary files for deploying Documenso using Docker and Docker Compose.

## Structure

- `Dockerfile`: The multi-stage Dockerfile for building the Documenso application image.
- `start.sh`: The entrypoint script used by the Docker image.
- `compose/compose.yml`: A unified Docker Compose file for deploying the application. It relies entirely on environment variables for configuration.
- `compose/testing/`: Configuration for the testing environment.

## Deployment

The deployment process is designed to be environment-agnostic, controlled via environment variables.

### Prerequisites

- Docker
- Docker Compose

### Using Docker Compose

To deploy Documenso, you need to provide an environment file (e.g., `.env.production`, `.env.staging`) and run the compose command pointing to the unified configuration.

1.  **Prepare your environment file:**
    Create a `.env` file (or use a specific one like `.env.production`) with the required variables. Refer to the main `.env.example` in the project root or the table below for required variables.

    Key variables include:
    - `DOCKER_TAG`: The tag of the image to deploy (defaults to `latest`).
    - `PORT`: Port to expose (default `4000`).
    - Database credentials (`NEXT_PRIVATE_DATABASE_URL`, etc.).
    - SMTP configuration.
    - Encryption keys.

2.  **Run the application:**

    ```bash
    # Example for production
    docker compose -f deployment/compose/compose.yml --env-file .env.production up -d
    ```

### Jenkins Pipeline

A `Jenkinsfile` is provided in the `deployment/` directory to automate the build and deployment process.

- **Build Stage:** Builds the Docker image from `deployment/Dockerfile`.
- **Deploy Stage:** Detects the branch (`development`, `staging`, `main`) and deploys using the corresponding environment file (`.env.development`, `.env.staging`, `.env.production`).

## Environment Variables

Ensure the following environment variables are set in your `.env` file:

| Variable                                | Description                                                                     |
| :-------------------------------------- | :------------------------------------------------------------------------------ |
| `DOCKER_TAG`                            | The image tag to deploy (e.g., `latest`, `main-a1b2c3d`).                       |
| `PORT`                                  | Application port (default: 4000).                                               |
| `NEXTAUTH_SECRET`                       | Secret for NextAuth.                                                            |
| `NEXT_PRIVATE_ENCRYPTION_KEY`           | Primary encryption key (32 chars).                                              |
| `NEXT_PRIVATE_ENCRYPTION_SECONDARY_KEY` | Secondary encryption key (32 chars).                                            |
| `NEXT_PUBLIC_WEBAPP_URL`                | Public URL of the app.                                                          |
| `NEXT_PRIVATE_DATABASE_URL`             | Database connection string.                                                     |
| `NEXT_PRIVATE_NOTIFY_ENDPOINT`          | Base URL of the Notify service (e.g. `https://notify-it.com/notify/services/`). |
| `NEXT_PRIVATE_NOTIFY_EMAIL`             | Notify service authentication email / username.                                 |
| `NEXT_PRIVATE_NOTIFY_PASSWORD`          | Notify service authentication password / token.                                 |

_Refer to the project's `.env.example` for a complete list of supported variables._
