const fs = require("fs");
const path = require("path");

const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");

const placesRoutes = require("./routes/places-routes");
const usersRoutes = require("./routes/users-routes");
const HttpError = require("./models/http-error");

const app = express();

app.use(bodyParser.json()); //will parse any request's body that comes in form of json

app.use("/uploads/images", express.static(path.join("uploads", "images"))); //any file in the uplaods/images will be returned

app.use((req, res, next) => {
  //to solve CORS error

  res.setHeader("Access-Control-Allow-Origin", "*"); //allows which domains should have access

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  ); //controls which headers incoming requests may have

  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE"); //allowed methods

  next();
});

app.use("/api/places", placesRoutes);

app.use("/api/users", usersRoutes);

app.use((req, res, next) => {
  const error = new HttpError("Could not find this route.", 404);

  throw error;
}); //if we don't send a response from our prevous middlewares, this middleware is reached

app.use((error, req, res, next) => {
  if (req.file) {
    fs.unlink(req.file.path, (err) => {
      console.log(err);
    }); //to rollback file creation in case of error
  }

  if (res.headerSent) {
    return next(error); //if response has already been sent, we just let it pass through
  }

  res.status(error.code || 500);
  res.json({ message: error.message || "An unknown error occured!" });
});

//user should have read and write permissions
mongoose
  .connect(
    `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.kfijlcd.mongodb.net/${process.env.DB_NAME}?retryWrites=true&w=majority`
  )
  .then(() => {
    app.listen(5000);
  })
  .catch((err) => {
    console.log(err);
  });
