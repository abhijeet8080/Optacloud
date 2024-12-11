const express = require('express');
const app = express();
const cors = require("cors");
const bodyparser = require("body-parser");
const cookieParser = require("cookie-parser");

const allowedOrigins = [
    process.env.FRONTEND_URL,
  ];

  const corsOptions = {
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        console.log("Blocked origin:", origin);
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 600 
  };

  // Apply CORS middleware
app.use(cors(corsOptions));

app.use(express.json());
app.use(cookieParser());
app.use(bodyparser.urlencoded({ extended: true }));

const user = require('./routes/userRoutes');
app.use("/api/v1", user);


module.exports = app;