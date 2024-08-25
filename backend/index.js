const express = require("express");
const app = express();
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const cors = require("cors");
const { desEncrypt, desDecrypt } = require("./des.js");
const port = process.env.PORT || 4000;

const encryptionKey = "mysecretkey"; // Define your constant key here

app.use(express.json());
app.use(cors());

// Database Connection With MongoDB
const mongoURI =
  "mongodb+srv://jeevancs22:h0VfYnDH3gxD8SE3@cluster0.etjnscc.mongodb.net/e-commerce?retryWrites=true&w=majority";
mongoose
  .connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("MongoDB connected successfully.");
  })
  .catch((error) => {
    console.error("MongoDB connection error:", error);
  });

// Image Storage Engine
const storage = multer.diskStorage({
  destination: "./upload/images",
  filename: (req, file, cb) => {
    return cb(
      null,
      `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`
    );
  },
});
const upload = multer({ storage: storage });
app.post("/upload", upload.single("product"), (req, res) => {
  res.json({
    success: 1,
    image_url: `/images/${req.file.filename}`,
  });
});

// Route for Images folder
app.use("/images", express.static("upload/images"));

// Middleware to fetch user from token
const fetchuser = async (req, res, next) => {
  const token = req.header("auth-token");
  if (!token) {
    return res
      .status(401)
      .send({ errors: "Please authenticate using a valid token" });
  }
  try {
    const data = jwt.verify(token, "secret_ecom");
    req.user = data.user;
    next();
  } catch (error) {
    return res
      .status(401)
      .send({ errors: "Please authenticate using a valid token" });
  }
};

// Schema for creating user model
const Users = mongoose.model("Users", {
  name: { type: String },
  email: { type: String, unique: true },
  password: { type: String },
  cartData: { type: Object },
  date: { type: Date, default: Date.now() },
});

// Schema for creating Product
const Product = mongoose.model("Product", {
  id: { type: Number, required: true },
  name: { type: String, required: true },
  description: { type: String, required: true },
  image: { type: String, required: true },
  category: { type: String, required: true },
  new_price: { type: Number },
  old_price: { type: Number },
  date: { type: Date, default: Date.now },
  available: { type: Boolean, default: true },
});

// Convert password to binary
function stringToBinary(str) {
  return str
    .split("")
    .map((char) => char.charCodeAt(0).toString(2).padStart(8, "0"))
    .join("");
}

// // Convert binary to string
// function binaryToString(binary) {
//   return binary
//     .match(/.{1,8}/g)
//     .map((byte) => String.fromCharCode(parseInt(byte, 2)))
//     .join("");
// }
// Convert binary to string and remove null characters
function binaryToString(binary) {
  return binary
    .match(/.{1,8}/g)
    .map((byte) => String.fromCharCode(parseInt(byte, 2)))
    .join("")
    .replace(/\0+$/, ""); // Remove trailing null characters
}

// Decrypt password function
function decryptPassword(encryptedPassword) {
  const key = stringToBinary(encryptionKey).split("").map(Number);
  const decryptedPasswordBinary = desDecrypt(
    encryptedPassword.split("").map(Number),
    key
  );
  const decryptedPassword = binaryToString(decryptedPasswordBinary.join(""));
  return decryptedPassword;
}

// ROOT API Route For Testing
app.get("/", (req, res) => {
  res.send("Root");
});

// Create an endpoint at ip/login for login the user and giving auth-token
app.post("/login", async (req, res) => {
  console.log("Login");
  let success = false;
  let user = await Users.findOne({ email: req.body.email });
  if (user) {
    const decryptedPassword = decryptPassword(user.password); // Decrypt the password
    console.log("Encrypted Password from DB:", user.password);
    console.log("Decrypted Password:", decryptedPassword); // Debugging line

    const inputPasswordTrimmed = req.body.password.trim();
    const decryptedPasswordTrimmed = decryptedPassword.trim();

    console.log("Input Password (trimmed):", inputPasswordTrimmed);
    console.log("Decrypted Password (trimmed):", decryptedPasswordTrimmed);

    console.log(
      "Input Password (char codes):",
      inputPasswordTrimmed.split("").map((char) => char.charCodeAt(0))
    );
    console.log(
      "Decrypted Password (char codes):",
      decryptedPasswordTrimmed.split("").map((char) => char.charCodeAt(0))
    );

    if (inputPasswordTrimmed === decryptedPasswordTrimmed) {
      const data = {
        user: {
          id: user.id,
        },
      };
      success = true;
      console.log(user.id);
      const token = jwt.sign(data, "secret_ecom");
      res.json({ success, token });
    } else {
      console.log("Password comparison failed");
      return res.status(400).json({
        success: success,
        errors: "Please try with correct email/password",
      });
    }
  } else {
    console.log("User not found");
    return res.status(400).json({
      success: success,
      errors: "Please try with correct email/password",
    });
  }
});

// Create an endpoint at ip/auth for registering the user & sending auth-token
app.post("/signup", async (req, res) => {
  console.log("Sign Up");
  let success = false;
  let check = await Users.findOne({ email: req.body.email });
  if (check) {
    return res.status(400).json({
      success: success,
      errors: "existing user found with this email",
    });
  }
  let cart = {};
  for (let i = 0; i < 300; i++) {
    cart[i] = 0;
  }
  const key = stringToBinary(encryptionKey).split("").map(Number); // Use the constant key here
  const encryptedPassword = desEncrypt(
    stringToBinary(req.body.password).split("").map(Number),
    key
  ).join("");
  const user = new Users({
    name: req.body.username,
    email: req.body.email,
    password: encryptedPassword,
    cartData: cart,
  });
  await user.save();
  const data = {
    user: {
      id: user.id,
    },
  };

  const token = jwt.sign(data, "secret_ecom");
  success = true;
  res.json({ success, token });
});

// Endpoint for getting all products data
app.get("/allproducts", async (req, res) => {
  let products = await Product.find({});
  console.log("All Products");
  res.send(products);
});

// Endpoint for getting latest products data
app.get("/newcollections", async (req, res) => {
  let products = await Product.find({});
  let arr = products.slice(0).slice(-8);
  console.log("New Collections");
  res.send(arr);
});

// Endpoint for getting womens products data
app.get("/popularinwomen", async (req, res) => {
  let products = await Product.find({ category: "women" });
  let arr = products.splice(0, 4);
  console.log("Popular In Women");
  res.send(arr);
});

// Endpoint for getting womens products data
app.post("/relatedproducts", async (req, res) => {
  console.log("Related Products");
  const { category } = req.body;
  const products = await Product.find({ category });
  const arr = products.slice(0, 4);
  res.send(arr);
});

// Create an endpoint for saving the product in cart
app.post("/addtocart", fetchuser, async (req, res) => {
  console.log("Add Cart");
  let userData = await Users.findOne({ _id: req.user.id });
  userData.cartData[req.body.itemId] += 1;
  await Users.findOneAndUpdate(
    { _id: req.user.id },
    { cartData: userData.cartData }
  );
  res.send("Added");
});

// Create an endpoint for removing the product in cart
app.post("/removefromcart", fetchuser, async (req, res) => {
  console.log("Remove Cart");
  let userData = await Users.findOne({ _id: req.user.id });
  if (userData.cartData[req.body.itemId] != 0) {
    userData.cartData[req.body.itemId] -= 1;
  }
  await Users.findOneAndUpdate(
    { _id: req.user.id },
    { cartData: userData.cartData }
  );
  res.send("Removed");
});

// Create an endpoint for getting cartdata of user
app.post("/getcart", fetchuser, async (req, res) => {
  console.log("Get Cart");
  let userData = await Users.findOne({ _id: req.user.id });
  res.json(userData.cartData);
});

// Create an endpoint for adding products using admin panel
app.post("/addproduct", async (req, res) => {
  let products = await Product.find({});
  let id;
  if (products.length > 0) {
    let last_product_array = products.slice(-1);
    let last_product = last_product_array[0];
    id = last_product.id + 1;
  } else {
    id = 1;
  }
  const product = new Product({
    id: id,
    name: req.body.name,
    description: req.body.description,
    image: req.body.image,
    category: req.body.category,
    new_price: req.body.new_price,
    old_price: req.body.old_price,
  });
  await product.save();
  res.send("Product Added");
});

app.listen(port, () => {
  console.log(`Server listening at port ${port}`);
});
