import express from "express";

const routerfn = () => {
  var router = express.Router();

  /* GET home page. */
  router.get("/", function (req, res, next) {
    res.redirect("index.html");
    return;
  });

  router.get("/api/pixelData", function (req, res, next) {
    res.json(req.devices.visualiserListener.visualiserData);
  });

  router.ws("/api/pixelDataFeed", function (ws, req) {
    //data will be sent periodically from elsewhere.
    ws.on("message", function (msg) {
      console.log(msg);
    });
  });

  return router;
};

export default routerfn;
