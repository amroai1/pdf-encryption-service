FROM node:18-alpine

# Install qpdf and tini
RUN apk add --no-cache qpdf tini

# Create app directory
WORKDIR /app

# Copy everything to the container
COPY . .

# Create data directory for temp files
RUN mkdir -p /app/data

# Install dependencies
RUN npm install --omit=dev

# Expose port
EXPOSE 3000

# Use tini as entrypoint for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Start the server
CMD ["npm", "start"]