const fs = require("fs");

const HttpError = require("../models/http-error");
const getCoordsForAddress = require("../util/location");
const Place = require("../models/place");
const User = require("../models/user");

const { validationResult } = require("express-validator");
const mongoose = require("mongoose");

const getPlaceById = async (req, res, next) => {
  const placeId = req.params.pid;

  let place;

  try {
    place = await Place.findById(placeId);
  } catch (err) {
    return next(
      new HttpError("Something went wrong, could not find a place.", 500)
    );
  }

  if (!place) {
    //have to use next in an async middleware
    //if in sync middleware, we can use throw

    // const error = new Error("Could not find a place for the provided id.");

    // error.code = 404;
    // throw error;

    return next(
      new HttpError("Could not find a place for the provided id.", 404)
    );
  }

  res.json({ place: place.toObject({ getters: true }) }); //turns palce into a javascript object and returns "id" without the underscore
};

const getPlacesByUserId = async (req, res, next) => {
  const userId = req.params.uid;

  //let places;

  let userWithPlaces;

  try {
    //places = await Place.find({creator: userId})
    userWithPlaces = await User.findById(userId).populate("places");
  } catch (err) {
    return next(
      new HttpError("Fetching places failed, please try again later", 500)
    );
  }

  //if(!places || places.length === 0)
  if (!userWithPlaces || userWithPlaces.places.length === 0) {
    //have to use next in an async middleware
    //if in sync middleware, we can use throw

    return next(
      new HttpError("Could not find a place for the provided user id.", 404)
    );
  }

  res.json({
    places: userWithPlaces.places.map((place) =>
      place.toObject({ getters: true })
    ),
  });
};

const createPlace = async (req, res, next) => {
  const errors = validationResult(req); //will check if there are any validation error based on the vaildation we did in the route

  if (!errors.isEmpty()) {
    return next(new HttpError("Invalid Input", 422));
  }

  const { title, description, address } = req.body;

  let coordinates;
  try {
    coordinates = await getCoordsForAddress(address);
  } catch (error) {
    return next(error);
  }

  const createdPlace = new Place({
    title,
    description,
    address,
    location: coordinates,
    image: req.file.path,
    creator: req.userData.userId,
  });

  let user;

  try {
    user = await User.findById(req.userData.userId);
  } catch (err) {
    return next(new HttpError("Creating place failed, please try again", 500));
  }

  if (!user) {
    return next(new HttpError("Coud not find user for provided id", 404));
  }

  try {
    const sess = await mongoose.startSession();
    sess.startTransaction();
    await createdPlace.save({ session: sess });
    user.places.push(createdPlace);
    await user.save({ session: sess });
    await sess.commitTransaction();
  } catch (err) {
    const error = new HttpError("Creating place failed, please try again", 500);
    return next(error);
  }
  res.status(201).json({ place: createdPlace });
};

const updatePlace = async (req, res, next) => {
  const errors = validationResult(req); //will check if there are any validation error based on the vaildation we did in the route

  if (!errors.isEmpty()) {
    return next(new HttpError("Invalid Input", 422));
  }

  const { title, description } = req.body;

  const placeId = req.params.pid;

  let place;

  try {
    place = await Place.findById(placeId);
  } catch (err) {
    return next(
      new HttpError("Something went wrong, could not update place.", 500)
    );
  }

  //authorization
  if (place.creator.toString() !== req.userData.userId) {
    //check if user is the creator or not
    return next(new HttpError("You are not allowed to edit this place.", 401));
  }

  place.title = title;
  place.description = description;

  try {
    await place.save();
  } catch (err) {
    return next(
      new HttpError("Something went wrong, could not update place.", 500)
    );
  }

  res.status(200).json({ place: place.toObject({ getters: true }) });
};

const deletePlace = async (req, res, next) => {
  const placeId = req.params.pid;

  let place;

  try {
    place = await Place.findById(placeId).populate("creator");
  } catch (err) {
    return next(
      new HttpError("Something went wrong, could not delete place.", 500)
    );
  }

  if (!place) {
    return next(new HttpError("Could not find place for this id", 404));
  }

  //authorization
  //creator here holds user object since we use populate
  if (place.creator.id !== req.userData.userId) {
    return next(
      new HttpError("You are not allowed to delete this place.", 401)
    );
  }

  const imagePath = place.image;
  try {
    const sess = await mongoose.startSession();
    sess.startTransaction();
    await place.deleteOne({ session: sess });
    await place.creator.places.pull(place);
    await place.creator.save({ session: sess });
    await sess.commitTransaction();
  } catch (err) {
    return next(
      new HttpError("Something went wrong, could not delete place.", 500)
    );
  }

  fs.unlink(imagePath, (err) => {
    console.log(err);
  }); //delete image on delete for a place

  res.status(200).json({ message: "Deleted place" });
};

exports.getPlaceByID = getPlaceById;
exports.getPlacesByUserId = getPlacesByUserId;
exports.createPlace = createPlace;
exports.updatePlace = updatePlace;
exports.deletePlace = deletePlace;
