const mongoose = require("mongoose");

const inquiryEmailsSchema = new mongoose.Schema({

    userDetailes:{
        contactUserId: String,
        contactName: String,
        contactEmail: String,
    },
    quiry: String,
    message: String
})

module.exports = mongoose.model("messages",inquiryEmailsSchema);