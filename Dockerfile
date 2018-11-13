# Credits: https://nodejs.org/en/docs/guides/nodejs-docker-webapp/
FROM node:8.12.0-alpine

# Credits: https://github.com/nodejs/docker-node/issues/282#issuecomment-358907790
RUN apk --no-cache --virtual build-dependencies add \
    python \
    make \
    g++

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./

# If you are building your code for production
RUN npm install --only=production

# Credits: https://github.com/nodejs/docker-node/issues/282#issuecomment-358907790
RUN apk del build-dependencies

COPY . .

COPY .homebase.yml /root/.homebase.yml

# From Node's Best Practices
# See: https://github.com/nodejs/docker-node/blob/master/docs/BestPractices.md#environment-variables
# Note: Only this is applied from the practices.
ENV NODE_ENV production

# Note: you still need to supply -p 80:80 -p 443:443 -p 3282:3282 -p 8089:8089
# If you have Beaker opened, you may want to change the 3282 port. E.g., to run with -p 9999:3282
EXPOSE 80 443 3282 8089

CMD [ "npm", "start" ]
