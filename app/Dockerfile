FROM node:20-alpine AS build

WORKDIR /app

COPY app/package*.json ./
RUN npm ci

COPY app/ .

ARG REACT_APP_API_URL=http://localhost:3001
ENV REACT_APP_API_URL=$REACT_APP_API_URL

RUN npm run build

FROM nginx:alpine

COPY --from=build /app/build /usr/share/nginx/html
COPY landing/index.html /usr/share/nginx/html/landing.html
COPY landing/docs.html /usr/share/nginx/html/docs.html
COPY app/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
