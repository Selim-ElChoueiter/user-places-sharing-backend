const HttpError = require("../models/http-error");
const User = require("../models/user");

const jwt = require("jsonwebtoken");

const bcrypt = require("bcryptjs");

const { validationResult } = require("express-validator");

const getUsers = async (req, res, next) => {
  let users;

  try {
    users = await User.find({}, "-password"); //get only email and name we use 'email name', we can also use '-password' to exclude password instead
  } catch (err) {
    return next(
      new HttpError("Fetching users failed, please try again later.", 500)
    );
  }

  res.json({ users: users.map((user) => user.toObject({ getters: true })) });
};

const signup = async (req, res, next) => {
  const errors = validationResult(req); //will check if there are any validation error based on the vaildation we did in the route

  if (!errors.isEmpty()) {
    return next(new HttpError("Invalid Input", 422));
  }

  const { name, email, password } = req.body;

  let existingUser;
  try {
    existingUser = await User.findOne({ email: email });
  } catch (err) {
    return next(
      new HttpError("Signing up failed, please try again later.", 500)
    );
  }

  if (existingUser) {
    return next(
      new HttpError("User exists already, please login instead", 422)
    );
  }

  let hashedPassword;

  try {
    hashedPassword = await bcrypt.hash(password, 12); //12 references the difficulty of the password
  } catch (err) {
    return next(new HttpError("Could not create user, please try again.", 500));
  }

  const createdUser = new User({
    name,
    email,
    image: req.file.path, //multer adds fie property
    password: hashedPassword,
    places: [],
  });

  try {
    await createdUser.save();
  } catch (err) {
    return next(new HttpError("Signing up failed, please try again.", 500));
  }

  let token;

  try {
    token = jwt.sign(
      { userId: createdUser.id, email: createdUser.email }, //what we want to encode
      process.env.JWT_KEY, //the secret key
      { expiresIn: "1h" } //additional config options
    ); //returns the token
  } catch (err) {
    return next(new HttpError("Signing up failed, please try again.", 500));
  }

  res
    .status(201)
    .json({ userId: createdUser.id, email: createdUser.email, token: token });
};

const login = async (req, res, next) => {
  const { email, password } = req.body;

  let existingUser;
  try {
    existingUser = await User.findOne({ email: email });
  } catch (err) {
    return next(
      new HttpError("Logging in failed, please try again later.", 500)
    );
  }

  if (!existingUser) {
    return next(
      new HttpError("Invalid credentials, could not log you in", 403)
    );
  }

  let isValidPassword = false;
  try {
    isValidPassword = await bcrypt.compare(password, existingUser.password);
  } catch (err) {
    return next(
      new HttpError(
        "Could not log you in please check your credentials and try again.",
        500
      )
    );
  }

  if (!isValidPassword) {
    return next(
      new HttpError("Invalid credentials, could not log you in", 403)
    );
  }

  let token;

  try {
    token = jwt.sign(
      { userId: existingUser.id, email: existingUser.email }, //what we want to encode
      process.env.JWT_KEY, //the secret key
      { expiresIn: "1h" } //additional config options
    ); //returns the token
  } catch (err) {
    return next(new HttpError("Logging in failed, please try again.", 500));
  }

  res.json({
    userId: existingUser.id,
    email: existingUser.email,
    token: token,
    // user: existingUser.toObject({ getters: true }),
  });
};

exports.getUsers = getUsers;
exports.signup = signup;
exports.login = login;
