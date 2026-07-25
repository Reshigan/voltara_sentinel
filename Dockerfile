FROM node:22-alpine
WORKDIR /app
COPY package.json .
COPY tsconfig.json .
COPY src ./src
COPY migrations ./migrations
COPY tools ./tools
RUN npm install --omit=dev && npm install typescript@5.5.0 && npx tsc -p tsconfig.json && npm uninstall typescript
EXPOSE 8080
CMD ["node", "dist/index.js"]
