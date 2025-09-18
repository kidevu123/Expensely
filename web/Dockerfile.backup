FROM node:20-alpine
WORKDIR /app

ARG APP_VERSION=dev
ARG GIT_SHA=""
ENV NEXT_PUBLIC_APP_VERSION=$APP_VERSION
ENV NEXT_PUBLIC_GIT_SHA=$GIT_SHA
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

ARG NEXT_DISABLE_TYPECHECK
ENV NEXT_DISABLE_TYPECHECK=$NEXT_DISABLE_TYPECHECK

RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json* ./
RUN npm ci --silent
COPY . .

# Inject a tsconfig so Next's TS check doesn’t choke on matchAll()
RUN cat > tsconfig.json <<'JSON'
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["dom", "dom.iterable", "es2020"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": false,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "downlevelIteration": true,
    "incremental": true,
    "baseUrl": "."
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
JSON

RUN npm run build
RUN npm ci --silent --omit=dev
EXPOSE 3000
CMD ["npm","run","start"]
