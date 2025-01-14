const express = require('express')
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const cors = require('cors');

app.use(cors({
  origin: ["http://45.133.178.107:3000/"],
  methods: ["POST", "GET"],
  credentials: true
}));

const app = express();
app.use(cookieParser());
app.use(express.json());

const dotenv  = require('dotenv')
dotenv.config({path:'./config.env'});

require('./db/conn');

app.use(require('./routers/auth'));

const PORT = process.env.PORT;
const User = require("./models/userSchema");
const mongoose = require("mongoose");

const middleware = (req, res, next)=>{
  console.log("Hello Middleware")
  next();
}

app.get('/', (req, res) => {
  res.send('GET request to the homepage')
});

app.get('/about', middleware, (req, res) => {
  res.send('GET request to the aboutpage')
})

app.listen(PORT, ()=>{
    console.log("Server is running on port no.", PORT);
})


