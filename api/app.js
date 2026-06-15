import createError from "http-errors";
import express from "express";
import logger from "morgan";
import multer from "multer";
import expressWsFn from "express-ws";
import promClient from "prom-client";
import session from 'express-session';
import { randomBytes } from 'crypto';


import enrollmentRouter from "./routes/enrollment.js";
import visualiserRouterFn from "./routes/visualiser.js";
import { userAuthenticatedRouterFn, userUnauthenticatedRouterFn } from "./routes/user.js";

import { SqliteDao } from "./dao/SqliteDao.js";
import { DeviceStore } from "./devices/DeviceStore.js";
import { DeviceScanner } from "./devices/DeviceScanner.js";
import { loadDemoData, targetFps as demoTargetFps } from "./demoData.js";
import { UserService } from "./users/UserService.js";

const SESSION_COOKIE_NAME = "byopSession"

const generateSecret = () => {
  // Secret must be at least 32 bytes
  const buf = randomBytes(32);
  const secret = buf.toString('base64')

  console.warn("Using generated session secret of '" + secret + "'.")

  return secret;
};

const dao = await (async () => {
  if ("SQLITE_FILE" in process.env) {
    const dbFile = process.env["SQLITE_FILE"]
    console.log("Initialising db from " + dbFile)
    const dao = new SqliteDao();
    await dao.init(dbFile);
    return dao;
  } else {
    // create an in-memory dao
    // TODO
    console.warn("No database specified");
    return null;
  }
})();

const devices = new DeviceStore();
await devices.init(dao);

const users = new UserService(dao);

// const targetFps = 30;
const targetFps = demoTargetFps;
if (devices.isEmpty() && process.env.LOAD_DEMO_DATA === 'true') {
  loadDemoData(devices);
}

const deviceScanner = new DeviceScanner(devices);

const expressWs = expressWsFn(express());
const app = expressWs.app;

const visualiserRouter = visualiserRouterFn();
const userAuthenticatedRouter = userAuthenticatedRouterFn();
const userUnauthenticatedRouter = userUnauthenticatedRouterFn();

// view engine setup
import { engine } from "./handlebarsEngine.js";
app.engine("handlebars", engine());
app.set("views", "./views");
app.set("view engine", "handlebars");

app.use(logger("dev"));

app.use(
  session({
    name: SESSION_COOKIE_NAME,
    resave: false,
    saveUninitialized: false,
    secret: [
      'SESSION_SECRET' in process.env ? process.env.SESSION_SECRET : generateSecret(),
      process.env['OLD_SESSION_SECRET']
    ],
    // TODO: use this if "SQLITE_FILE" in process.env
    // store: new SqliteStore({
    //   client: db, 
    //   expired: {
    //     clear: true,
    //     intervalMs: 900000 //ms = 15min
    //   }
    // }),
  }))
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static("./public"));
app.use(multer().none());

// expose devices and users to the routers
app.use(function (req, res, next) {
  req.devices = devices;
  req.users = users;
  next();
});

function isAuthenticatedWrap(router) {
  return (req, res, next) => {
    if (req.session.user) {
      router(req, res, next)
    }
    else {
      next();
    }
  }
}

app.use("/", isAuthenticatedWrap(enrollmentRouter));
app.use("/visualiser", isAuthenticatedWrap(visualiserRouter));
app.use("/user", isAuthenticatedWrap(userAuthenticatedRouter));
app.use("/user", userUnauthenticatedRouter);

app.get("/metrics", (req, res) => {
  res.set("Content-Type", promClient.register.contentType);
  promClient.register.metrics().then((metrics) => res.end(metrics));
});

// redirect to login
app.get("/", (req, res) => {
  res.redirect("/user/login");
});

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handlers
app.use(function (err, req, res, next) {
  if (err instanceof TypeError && err.message == "Secret key must be provided.") {
    res.clearCookie(SESSION_COOKIE_NAME);
    res.redirect("/user/login");
  }
  next();
});

app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};
  res.locals.status = err.status || 500

  // render the error page
  res.status(res.locals.status);
  res.render("error");
});

setInterval(() => {
  devices.updatePixelColors();
  for (const c of expressWs.getWss().clients) {
    c.send(JSON.stringify(devices.visualiserListener.visualiserData));
  }
}, 1000 / targetFps);

promClient.collectDefaultMetrics();

console.log("Started");

export { app, devices, deviceScanner };
