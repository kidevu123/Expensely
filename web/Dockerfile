FROM node:20-alpine
WORKDIR /app

# Accept a build-time version and surface it to Next.js
ARG APP_VERSION=dev
ARG GIT_SHA=""
ENV NEXT_PUBLIC_APP_VERSION=$APP_VERSION
ENV NEXT_PUBLIC_GIT_SHA=$GIT_SHA

COPY package.json package-lock.json* ./
RUN npm ci --silent
COPY . .
EXPOSE 3000
CMD ["npm","run","dev"]

