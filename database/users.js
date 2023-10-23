const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({

    userName: String,
    mobileNum: Number || String,
    email: String,
    password: String,
    profileImage: String,
    savedProducts: [{
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        public_id: String,
        url: String,
        cakeName: String,
        price: String
    }],
    orderProducts: [{
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        url: String,
        cakeName: String,
        photoOnCake_URL: String,
        photoOnCake_Id: String,
        nameOnCake: String,
        flavour: String,
        purpose: String,
        quantity: Number || String,
        TotalePrice: Number || String,
        addressDetailes: {
            fullName: String,
            phoneNumber: String,
            address: String,
            city: String,
            zipCode: String
        },
        DateTime:String,
        orderStatus:String,
        paymentDetailes :{
            razorpay_order_id:String,
            razorpay_payment_id:String

        }
    }], 
    viewAllOrders:[{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'users' },
        orderId:  { type: mongoose.Schema.Types.ObjectId, ref: 'orderProducts' },
        url: String,
        cakeName: String,
        photoOnCake_URL: String,
        photoOnCake_Id: String,
        nameOnCake: String,
        flavour: String,
        purpose: String,
        quantity: Number || String, 
        TotalePrice: Number || String,
        fullName: String,
        phoneNumber: String,
        address: String,
        city: String,
        zipCode: String,
        DateTime:String,
        orderStatus:String,
        paymentDetailes :{
            razorpay_order_id:String,
            razorpay_payment_id:String

        }
    }]
})

module.exports = mongoose.model("users", userSchema);