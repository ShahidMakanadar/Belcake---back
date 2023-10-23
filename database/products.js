const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({

    cakeImage:{
        public_id:String,
        url:String
    },
    cakeName:String,
    price:String,
    photoCake:String
})

module.exports = mongoose.model("products",productSchema);