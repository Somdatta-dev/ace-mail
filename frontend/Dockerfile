# Stage 1: Build the React application
FROM node:18-alpine AS build

WORKDIR /app

# Copy package.json and package-lock.json (or yarn.lock)
COPY package.json ./
COPY package-lock.json ./
# If you were using yarn, you'd copy yarn.lock and use yarn install

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the application for production
RUN npm run build

# Stage 2: Serve the application using a lightweight server
FROM node:18-alpine

WORKDIR /app

# Install 'serve' to serve static files
RUN npm install -g serve

# Copy the build output from the build stage
COPY --from=build /app/build ./build

# Expose port 3000 (or the port your app runs on)
EXPOSE 3000

# Command to serve the build folder
CMD ["serve", "-s", "build", "-l", "3000"]