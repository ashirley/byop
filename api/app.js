import createError from "http-errors";
import express from "express";
import cookieParser from "cookie-parser";
import logger from "morgan";
import multer from "multer";
import expressWsFn from "express-ws";

import enrollmentRouter from "./routes/enrollment.js";
import visualiserRouterFn from "./routes/visualiser.js";

import { DeviceStore } from "./devices/DeviceStore.js";
import { DeviceScanner } from "./devices/DeviceScanner.js";
import { loadDemoData, targetFps as demoTargetFps } from "./demoData.js";

const devices = new DeviceStore();
await devices.init();

// const targetFps = 30;
const targetFps = demoTargetFps;
if (devices.isEmpty()) {
  loadDemoData(devices);
}

const deviceScanner = new DeviceScanner(devices);

const expressWs = expressWsFn(express());
const app = expressWs.app;

const visualiserRouter = visualiserRouterFn();

// view engine setup
import { engine } from "./handlebarsEngine.js";
app.engine("handlebars", engine());
app.set("views", "./views");
app.set("view engine", "handlebars");

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static("./public"));
app.use(multer().none());

// expose devices to the routers
app.use(function (req, res, next) {
  req.devices = devices;
  req.deviceScanner = deviceScanner;
  next();
});

app.use("/", enrollmentRouter);
app.use("/visualiser", visualiserRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render("error");
});

setInterval(() => {
  devices.updatePixelColors();
  for (const c of expressWs.getWss().clients) {
    c.send(JSON.stringify(devices.visualiserData));
  }
}, 1000 / targetFps);

console.log("Started");

export { app, devices, deviceScanner };
