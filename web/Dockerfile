FROM node:22-alpine

WORKDIR /app

RUN npm install -g pnpm@10.11.0

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile || pnpm install

COPY . .

EXPOSE 5173
CMD ["pnpm", "dev"]
