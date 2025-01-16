const express = require('express')
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require("../models/userSchema");
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const bcrypt = require("bcrypt");

const authenticate = require("../middlewares/authenticate");


router.get('/api', (req, res)=>{
    res.send("Hello from router server home page");
});

const validateEmail = (email) => {
  const emailRegex = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
  return emailRegex.test(email);
};

/**
 * @swagger
 * /api/signup:
 *   post:
 *     summary: "Signup"
 *     description: "Register user through username, email and password. Password length should be equal to or greater than 8 characters."
 *     parameters:
 *       - name: "username"
 *         in: "body"
 *         required: true
 *         type: "string"
 *         description: "The username of the user"
 *       - name: "email"
 *         in: "body"
 *         required: true
 *         type: "string"
 *         description: "The email address of the user"
 *       - name: "password"
 *         in: "body"
 *         required: true
 *         type: "string"
 *         description: "The password for the user"
 *     responses:
 *       200:
 *         description: "Successfully registered."
 *       422:
 *         description: "Missing fields or invalid input."
 */

router.post('/api/signup', (req,res)=>{
    const {username, email, password} = req.body;
    if(!username || !email || !password){
        return res.status(422).json({error: "Plzz fill misisng fields"});
    }

    if (!validateEmail(email)) {
      return res
        .status(422)
        .json({ error: "Please enter a valid email address." });
    }

    if(password.length<8){
      return res.status(422).json({error: "Password length should be equal to 8 or greater!"});
    }

    User.findOne({email:email})
    .then((userExist)=>{
        if(userExist){
            return res.status(422).json({error: "Email already registered"});
        }

        bcrypt.hash(password, 10, (err, hashedPassword) => {
          if (err) {
            return res.status(500).json({ error: "Error in password hashing" });
          }
  
          // Create a new user with the hashed password
          const newUser = new User({ username, email, password: hashedPassword });
  
          newUser.save()
            .then(() => {
              res.status(201).json({ message: "Successfully registered" });
            })
            .catch((err) => {
              res.status(500).json({ error: "User not registered" });
            });
        });
    }).catch((err)=>{console.log(err);})
    console.log(req.body);
});

/**
 * @swagger
 * /api/login:
 *   get:
 *     summary: Login
 *     description: Login through email and password.
 *     responses:
 *       200:
 *         description: Successfully Logged In.
 */
router.post("/api/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(422).json({ error: "Please fill missing fields" });
  }

  User.findOne({ email: email })
    .then((checkUser) => {
      if (checkUser) {
        bcrypt.compare(password, checkUser.password, (err, isMatch) => {
          if (err) {
            return res.status(500).json({ error: "Error comparing passwords" });
          }

          if (isMatch) {
            checkUser.generateAuthToken()
              .then((token) => {
                res.cookie("authToken", token, {
                  httpOnly: true,
                  secure: true, 
                  sameSite: "none",
                  maxAge: 24 * 60 * 60 * 1000, 
                });
                res.status(200).json({ message: "Successfully logged in" });
              })
              .catch((err) => { console.log(err); });
          } else {
            res.status(401).json({ error: "Invalid Email or Password" });
          }
        });
      } else {
        res.status(400).json({ error: "User not found" });
      }
    })
    .catch((err) => {
      res.status(500).json({ error: "Server Side Error" });
    });
});

/**
 * @swagger
 * /api/logout:
 *   get:
 *     summary: Logout
 *     description: User can logout but you can't test this api because this api just clear cookie named as "authToken".
 *     responses:
 *       200:
 *         description: User Logged Out.
 */
router.get('/api/logout', (req, res)=>{
  console.log("Logging out user....");
  res.clearCookie("authToken", {
    path: "/",      
    httpOnly: true, 
    secure: true,  
    sameSite: "none" 
  });
  res.status(200).json({message:"User Logged Out"});
})

/**
 * @swagger
 * /users:
 *   get:
 *     summary: Get user data
 *     description: Retrieve a users data from the database. But there is middleware "authenticate" that checks authToken from cookies so here you got error
 *     responses:
 *       200:
 *         description: Successful response with a users data.
 */
router.get('/api/getData', authenticate, (req, res, next) => {
    res.send(req.currentUser);
  });

router.get('/api/allUsers', authenticate, async (req, res, next) => {
  try{
    const users = await User.find({}, '-password -tokenms');
    res.status(200).json(users);
  } catch(error){
    console.error(error);
    res.status(500).json({error: "Error while fetching users from database"})
  }
})

function generateRandomPassword(length = 8) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=';
    let password = '';
    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        password += characters[randomIndex];
    }
    return password;
}

/**
 * @swagger
 * /api/forget:
 *   get:
 *     summary: Forget Password
 *     description: This api will send mail to entered email if exists in database and that mail consists of new password that is randomly generated of 8 characters. You can then login by new password
 *     responses:
 *       200:
 *         description: Check your email and try with new password!.
 */
router.post('/api/forget', async (req, res)=>{
  try {
    const {email} = req.body;
    console.log(email);
    if (!email) {
      return res.status(422).json({ error: 'Email is required' });
    }
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    let transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: 'sabbas486249@gmail.com', 
        pass: process.env.GMAIL_PASS, 
      },
    });
    console.log(email);
    const randomPassword = generateRandomPassword(8);
    const hashedPassword = await bcrypt.hash(randomPassword, 10);

    
    console.log(randomPassword);
        let info = await transporter.sendMail({
          from: `"mimAR Studio" <sabbas486249@gmail.com>`, 
          to: email, 
          subject: 'RECOVER PASSWORD', 
          html: `<h1>Get your new password!</h1><p>Here is your new password <strong>${randomPassword}</strong>. Stay informed and protected from misinformation with our service.</p>`
        });
        user.password = hashedPassword;
        await user.save();

        console.log('Message sent: %s', info.messageId);
        res.status(200).json({ message: 'Check your email and try with new password!' });
    
  } catch (error) {
    console.log(error);
    res.status(500).json({error:"Internal Server Error"})
  }
});

/**
 * @swagger
 * /api/update:
 *   post:
 *     parameters: email, username, password
 *     summary: Update Profile
 *     description: This api will update profile. You can update any of user data i.e email, username, password.
 *     responses:
 *       200:
 *         description: User updated successfully!.
 */
router.post('/api/update', async (req, res) => {
  const { email, username, password } = req.body;

  if (!email || (!username && !password)) {
      return res.status(422).json({ error: "Please provide email and at least one field to update" });
  }

  if (!validateEmail(email)) {
      return res.status(422).json({ error: "Please enter a valid email address." });
  }

  try {
      const updateData = { ...(username && { username }) };
      if (password && password.length >= 8) {
          updateData.password = password;
      } else if (password) {
          return res.status(422).json({ error: "Password length should be 8 or greater" });
      }

      const updatedUser = await User.findOneAndUpdate({ email }, updateData, { new: true });

      if (!updatedUser) {
          return res.status(404).json({ error: "User not found" });
      }

      res.status(200).json({ message: "User updated successfully", user: updatedUser });
  } catch (error) {
      console.log(error);
      res.status(500).json({ error: "Server error while updating user" });
  }
});


/**
 * @swagger
 * /api/auth/github/callback:
 *   get:
 *     summary: Github Callback
 *     description: This is github callback url and from this api you can get accessToken of user and then from accessToken you can fetch user details but you must need to input correct code of user generated by github itself.
 *     responses:
 *       200:
 *         description: User data fetched from github account.
 */
router.post('/api/auth/github/callback', async (req, res) => {
  const { code } = req.body;

  // Exchange code for access token
  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
      },
      body: JSON.stringify({
          client_id: process.env.GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
          code,
      }),
  });

  const tokenData = await tokenResponse.json();
  const accessToken = tokenData.access_token;
  console.log(tokenData);
  if (accessToken) {
    try {
      const response = await fetch('https://api.github.com/user', {
        method:"GET",
          headers: {
              Authorization: `Bearer ${accessToken}`,
          },
      });
      const data = await response.json();
      console.log(data);
      res.status(200).json(data);
  } catch (error) {
      res.status(500).json({ message: 'Error fetching user data', error: error.message });
  }
  } else {
    return res.status(400).json({ error: 'Access token is required' });
  }
});

module.exports = router;