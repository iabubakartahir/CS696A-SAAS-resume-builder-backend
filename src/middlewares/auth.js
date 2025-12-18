import jwt from "jsonwebtoken";
import ApiError from "../utils/ApiError.js";
import User from "../models/User.js";

export const protect = async (req, res, next) => {
  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.split(" ")[1] : null;
    if (!token) throw new ApiError(401, "Not authenticated");

    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    const user = await User.findById(decoded.id).select("+password");
    if (!user) throw new ApiError(401, "User no longer exists");
    if (user.isDeleted) {
      throw new ApiError(401, "Account has been deleted");
    }
    if (user.changedPasswordAfter(decoded.iat)) {
      throw new ApiError(401, "Password changed, please login again");
    }
    req.user = user;
    next();
  } catch (err) {
    if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
      return next(new ApiError(401, "Invalid token"));
    }
    next(err);
  }
};
