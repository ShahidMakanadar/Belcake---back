require('dotenv').config()
const mongoose  = require("mongoose");

mongoose.connect(`mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.g6y6uc4.mongodb.net/BelCake?retryWrites=true&w=majority`)
