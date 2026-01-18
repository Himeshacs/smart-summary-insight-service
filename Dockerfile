# Use Node.js 20 Alpine image
FROM node:20-alpine

# Set working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json first
COPY package*.json ./

# Set npm registry (helps with network issues)
RUN npm config set registry https://registry.npmjs.org/ \
    && npm ci --ignore-scripts --verbose || npm install --frozen-lockfile

# Copy the rest of the app
COPY . .

# Expose port (change if your app uses a different port)
EXPOSE 3000

# Default command
CMD ["npm", "run", "start:dev"]
