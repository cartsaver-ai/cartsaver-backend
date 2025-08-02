# Use Node.js LTS image
FROM node:18

# Create app directory
WORKDIR /app

# Copy package files and install deps
COPY package*.json ./
RUN npm install

# Copy the rest of the code
COPY . .

# Expose the port the app runs on
EXPOSE 8080

# Start the app
CMD [ "node", "server.js" ] 