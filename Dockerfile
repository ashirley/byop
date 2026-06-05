FROM node:25

EXPOSE 3000 5568
# By default, keep the database in the container. Mount a volume and change this to persist the database.
ENV SQLITE_FILE=/byop.db
# By default don't load demo data, start with no devices registered.
ENV LOAD_DEMO_DATA=false

RUN mkdir /app
WORKDIR /app

#COPY ./package.json ./*/package.json ./package-lock.json /app
#RUN npm install

COPY . /app
# I must be doing something wrong with npm workspaces but I want to build a dependency before installing it which doesn't seem unreasonable!
RUN npm install && npm run build --workspace=visualiser && npm install

WORKDIR /app/api
CMD ["node","./bin/www"]
