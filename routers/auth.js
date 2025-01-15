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
                res.cookie("authToken", token);
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


router.get('/api/logout', (req, res)=>{
  console.log("Logging out user....");
  res.clearCookie("authToken", {path:'/'});
  res.status(200).json({message:"User Logged Out"});
})


router.get('/api/getData', authenticate, (req, res, next) => {
    res.send(req.currentUser);
  });

function generateRandomPassword(length = 8) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=';
    let password = '';
    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        password += characters[randomIndex];
    }
    return password;
}


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