# Use Node.js official image
FROM node:22-alpine

# Install OpenSSL dependencies
RUN apk update && apk add --no-cache openssl

# Set working directory
WORKDIR /app

# Copy dependencies files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the app
COPY . .

# Prisma setup
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Use build arg & ENV
ARG PORT=7000
ENV PORT=${PORT}

# Expose the port
EXPOSE ${PORT}

# Start the app from the compiled JavaScript in dist/ folder
CMD ["npm", "run", "start"]
