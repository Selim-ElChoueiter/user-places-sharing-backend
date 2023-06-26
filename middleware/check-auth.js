const HttpError = require("../models/http-error");

const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
  if (req.method === "OPTIONS") {
    return next(); //browser sends options method for every request that is not a get request to see if server will accept
  }

  try {
    const token = req.headers.authorization.split(" ")[1]; //Authorization: 'Bearer TOKEN'

    if (!token) {
      throw new Error("Authentication failed!");
    }

    const decodedToken = jwt.verify(token, process.env.JWT_KEY); //to verify token validity

    req.userData = { userId: decodedToken.userId };
    next();
  } catch (err) {
    return next(new HttpError("Authentication failed!", 403));
  }
};
