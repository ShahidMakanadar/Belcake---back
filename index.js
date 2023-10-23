require('dotenv').config()
const express = require("express");
require("./database/config");
const users = require("./database/users");
const products = require("./database/products")
const InquiryEmails = require("./database/inquiryEmails");
const cors = require("cors")
const cloudinaryModule = require("cloudinary")
// Use at least Nodemailer v4.1.0
const nodemailer = require('nodemailer');
//JWT Authentication
const Jwt = require('jsonwebtoken');
//razorpay integration 
const Razorpay =  require('razorpay');
const crypto = require('crypto');


//express runnig setUp or intigration
const app = express();
app.use(express.json());
// app.use(express.urlencoded({extended: true}))

app.use(cors(
    { origin: 'https://belcake.vercel.app'}
 ))

//cloudinary setUp
const cloudinary = cloudinaryModule.v2;
cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.API_KEY,
    api_secret: process.env.API_SECRET
});

//JWT token verification 
const jwtKey = process.env.JWT_KEY;

function verifyToken(req, res, next) {
    let token = req.headers['authorization'];
    if (token) {
        token = token.split(' ')[1];
        Jwt.verify(token, jwtKey, (err, valid) => {
            if (err) {
                res.status(401).send({ JWT_Err: "invalid token" })
            }
            else {
                next();
            }
        })
    }
    else {
        res.status(403).send({ JWT_Err: "please provide token " })
    }
}

//razorpay instans
const instance = new Razorpay({
    key_id: process.env.ROZORPAY_API_KEY_ID,
    key_secret: process.env.ROZORPAY_API_KEY_SECRET,
  });


  
// API start
app.get('/', async (req, res) => {
    
    res.send({ result: "Successfull..!" })

})

//login and signup 
app.post('/register', async (req, res) => {
    try {
        let result = new users(req.body)
        let search = await users.findOne({ email: result.email });
        if (search) {
            res.send({ result: "this emial already registered" })
        }
        else {

            Number(result.mobileNum)
            let data = await result.save()

            data = data.toObject();
            delete data.password;

            //jwt token generate
            const result2 = {
                id: data._id,
                email: data.email
            };
            Jwt.sign({ result2 }, jwtKey, { expiresIn: '24h' }, (err, token) => {
                if (err) {
                    res.send({ result: "somthing went wrong .... please try again later" })
                    console.log("JWT Register errore...")
                }
                else if (data) {
                    res.send({ data, auth: token })
                    console.log("Register successfull")
                }
                else {
                    res.send({ result: "data not found....!" })
                }
            })
        }
    }
    catch (error) {
        console.log(error)
    }
})


app.post('/login', async (req, res) => {
    try {   
        if (req.body.email && req.body.password) {
            const user = await users.findOne(req.body).select("-password");

            if (user) {
                //jwt token generate
                const result2 = {
                    id: user._id,
                    email: user.email
                };
                Jwt.sign({ result2 }, jwtKey, { expiresIn: '24h' }, (err, token) => {
                    if (err) {
                        res.send({ result: "somthing went wrong .... please try again later" })
                        console.log("JWT Register errore...")
                    }
                    else {
                        res.send({ user, auth: token })
                        console.log("Login successfull")
                    }
                })
            }
            else {
                res.send({ result: "User Not Found..!" })
            }
        }
        else {
            res.send({ result: "Email or Password Are missing..!" })
        }
    }
    catch (error) {
        console.log(error)
    }

})


// profile Update 
app.put('/profileUpdate/:id', verifyToken, async (req, res) => {
    try {
        await users.updateOne(
            { _id: req.params.id },
            {
                $set: req.body
                // $set:{profileImage: req.body}
            }
        )
        const UpdatedData = await users.findOne({ _id: req.params.id }).select("-password");
        if (UpdatedData) {
            res.send({ UpdatedData })
        };

    }
    catch (error) {
        console.log(error)
    }

})


// products Api starts (cloudinary)========================>>>>>

//Add products
app.post('/addCake', verifyToken, async (req, res) => {
    try {
        const { cakeImage, cakeName, price, photoCake } = req.body;

        if (cakeImage) {
            const cloudUploadRes = await cloudinary.uploader.upload(cakeImage, {
                upload_preset: "cake-images"
            });

            if (cloudUploadRes) {
                const adProduct = new products(
                    {
                        cakeImage: {
                            public_id: cloudUploadRes.public_id,
                            url: cloudUploadRes.secure_url
                        },
                        cakeName,
                        price,
                        photoCake
                    });

                const savedProduct = await adProduct.save();
                res.status(200).send(savedProduct)
            };

        }
    }
    catch (error) {
        console.log(error)
        res.status(500).send(error)
    }

})

// get cakes show cake list on order page
app.get('/cakeList', async (req, res) => {
    try {
        const cakeList = await products.find()
        if (cakeList.length > 0) {
            res.send(cakeList)
        }
        else {
            res.send({ result: "data not found....!" })
        }
    }
    catch (error) {
        console.log(error)
        res.status(500).send(error)
    }
})


//delete cakes
app.delete('/deleteCake/:id', verifyToken, async (req, res) => {
    try {
        const result = await products.findOne({ _id: req.params.id })

        //deleting the image from the cloudinary
        const imgId = result.cakeImage.public_id;
        await cloudinary.uploader.destroy(imgId);

        //deleting the cake from the database
        await products.findByIdAndDelete({ _id: req.params.id })
        res.send(result)
    }
    catch (error) {
        console.log(error)
        res.status(500).send(error)
    }

})

//CONTACT FORM EMAIL API WITH NODEMAILER
app.post('/sendEmail', async (req, res) => {
    try {
        const { contactUserId, contactName, contactEmail, quiry, message } = req.body

        // connect with the smtp Transport
        const transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: process.env.EMAIL_PORT,
            secure: process.env.EMAIL_SECURE,
            auth: {
                user: process.env.USER_EMAIL,
                pass: process.env.USER_PASS,
            }
        });
        // send mail with defined transport object
        let detailes = {
            from: process.env.EMAIL_FROM,// sender address
            to: process.env.EMAIL_FROM, // list of receivers
            subject: `${quiry}`, // Subject line
            text: `${message}`, // plain text body
            // html: "<b>Hello world?</b>", // html body
        };
        transporter.sendMail(detailes, async (err) => {
            if (err) {
                console.log("errore is occure", err)
            }
            else {
                console.log("successfulli send")
                const addEmail = new InquiryEmails({
                    userDetailes: {
                        contactUserId: contactUserId,
                        contactName: contactName,
                        contactEmail: contactEmail
                    },
                    quiry,
                    message
                });

                const result = await addEmail.save()
                res.status(200).send(result)
            }
        })
    }
    catch (error) {
        console.log(error)
        res.status(500).send(error)
    }

})


// save and remove products     
app.put('/saveProduct/:productId/:userId', verifyToken, async (req, res) => {
    const { productId, userId } = req.params;

    try {
        // Find product details using productId and select the desired fields
        const findProductId = await products.findOne({ _id: productId }).select('');
        // Find user details using userId
        const findUserID = await users.findOne({ _id: userId }).select('');
        const userProductId = findUserID.savedProducts; // public_id of image in user

        if (findProductId) {
            //finding public_id of user image and product img
            const productImgId = findProductId.cakeImage.public_id; // public_id of image in products
            const userProductImgId = findUserID.savedProducts; // public_id of image in user

            const isProductAlreadySaved = userProductImgId.some(
                (e) => e.public_id === productImgId
            );

            if (!isProductAlreadySaved) {
                // If the product is not already saved, add it to the user's savedProducts array
                findUserID.savedProducts.push({
                    productId,
                    public_id: findProductId.cakeImage.public_id,
                    url: findProductId.cakeImage.url,
                    cakeName: findProductId.cakeName,
                    price: findProductId.price
                });

                await findUserID.save();
                // Retrieve the updated user data (excluding the password)
                const result = await users.findOne({ _id: userId }).select('-password');
                res.status(200).send(result);
                console.log("Product saved successfully");
            }
            else {
                // Find the index of the saved product in the array
                const indexToRemove = userProductImgId.findIndex(
                    (e) => e.public_id === productImgId
                );

                // If the product is not found, indexToRemove will be -1.
                if (indexToRemove !== -1) {
                    // Remove the product at the specified index
                    userProductImgId.splice(indexToRemove, 1);//, we want to remove only one element, so we pass 1 as the second argument to splice.

                    // Save the updated user data
                    await findUserID.save();

                    // Retrieve the updated user data (excluding the password)
                    const result = await users.findOne({ _id: userId }).select('-password');
                    res.status(200).send({ removed: result });
                    console.log("Product removed successfully");
                }
                else {
                    res.status(404).send("Product not found in the user's saved products.");
                }
            }
        }
        else {
            // Find the index of the saved product in the array
            const indexToRemove = userProductId.findIndex(
                (en) => en.productId == productId
            )

            // If the product is not found, indexToRemove will be -1.
            if (indexToRemove !== -1) {
                // Remove the product at the specified index
                userProductId.splice(indexToRemove, 1);//, we want to remove only one element, so we pass 1 as the second argument to splice.

                // Save the updated user data
                await findUserID.save();

                // Retrieve the updated user data (excluding the password)
                const result = await users.findOne({ _id: userId }).select('-password');
                res.status(200).send({ removed: result });
                console.log("Product removed successfully");
            }
            else {
                console.log("saved cake deleted by owner . sor u cannot remove it from saved items", error)
            }
        }
    }
    catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});


//forgot passsword email check and send url of new password
app.post('/forgotPassword', async (req, res) => {
    try {
        const forgotEmail = req.body.forgotEmail
        forgotEmail.toString()
        const user = await users.findOne({ email: forgotEmail }).select("-password")
        if (!user) {
            console.log("This email is not existed")
            res.send({ status: "This email is not existed" })

        }
        else {
            const key = process.env.JWT_PASSWORD_KEY;
            const token = Jwt.sign({ _id: user._id }, key, { expiresIn: "10m" })

            // connect with the smtp Transport
            const transporter = nodemailer.createTransport({
                host: process.env.EMAIL_HOST,
                port: process.env.EMAIL_PORT,
                secure: process.env.EMAIL_SECURE,
                auth: {
                    user: process.env.USER_EMAIL,
                    pass: process.env.USER_PASS,
                }
            });

            //  datailes to send 
            let detailese = {
                from: process.env.EMAIL_FROM,// sender address
                to: `${user.email}`, // receivers address
                subject: "Belcake Terdal", // Subject line
                text: `https://belcake.vercel.app/forgot-password/${user._id}/${token}`, // plain text body
                // html: "<h4>Open above link and set your new password....!</h4>", // html body
            };

            // send email with defined transport object
            transporter.sendMail(detailese, (err) => {
                if (err) {
                    res.send({ status: "invalidEmail" })
                    console.log("somthing is wrong...!")
                }
                else {
                    res.send({ status: "Success" })
                }
            })

        }
    }
    catch {
        console.log("errore occure ....!")
        res.status(400).status("errore occure ....!")
    }
})


//forgot passsword update new password
app.post('/newPassword/:id/:token', async (req, res) => {
    const { id, token } = req.params;

    try {
        const key = process.env.JWT_PASSWORD_KEY;

        Jwt.verify(token, key, async (err) => {
            if (err) {
                console.log("tokenExpired");
                res.send({ status: "tokenExpired" });
            } else {
                await users.updateOne(
                    { _id: id },
                    {
                        $set: { password: req.body.newPassword } // Set the password field to the new value
                    }
                );

                console.log("updated successfully");
                res.send({ status: "updated successfully" });
            }
        });
    } catch (error) {
        console.log("error occurred ", error);
        res.status(500).send("An error occurred");
    }
});


//search cakes API
app.get('/searchCakes/:key', async (req, res) => {
    try {

        let result = await products.find({
            $or: [
                { cakeName: { $regex: new RegExp(req.params.key, 'i') } },
                //Here, 'i' is used as a flag to make the search case-insensitive.
                { price: { $regex: new RegExp(req.params.key, 'i') } },
            ],
        });

        if (result === null || result.length === 0) {
            // No results found or search key is empty, send all data
            const cakeList = await products.find();
            res.send(cakeList);
        }
        else {
            // Send the search results
            res.send(result);
        }
    }
    catch (error) {
        console.error(error);
        res.status(500).send('An error occurred while searching for cakes.');
    }
})

//get key of razorepay 
app.get('/getKey',async(req,res)=>{
    res.status(200).send({key: process.env.ROZORPAY_API_KEY_ID })
})

//RrazorPay Checkout order Api
app.post('/checkout/:productId', verifyToken, async(req,res)=>{

    const { productId } = req.params
    const selectedQuantity = req.body.selectedQuantity
    try{
        // Find product details using productId and select the desire d fields
        const findProductId = await products.findOne({ _id: productId }).select('');
        const totalAmount = (findProductId.price * selectedQuantity) + 30 ;
        const options = {
            amount : Number(totalAmount * 100),
            currency : "INR"
        }
        const order = await instance.orders.create(options)
        console.log("RrazorPay Checkout order created" , order)
        res.status(200).send(order)
    }
    catch{
        console.log("error : RrazorPay Checkout order")
    }
})
// payment verification call back api from razorpay
app.post('/Verification', async(req,res)=>{
    try{
        const {razorpay_order_id, razorpay_payment_id, razorpay_signature} = req.body

        const body = razorpay_order_id + "|" + razorpay_payment_id;

        const expectedSigniture = crypto
            .createHmac("sha256", process.env.ROZORPAY_API_KEY_SECRET)
            .update(body.toString())
            .digest("hex");
        
        const isAuthentic = expectedSigniture === razorpay_signature;
        if(isAuthentic){
            console.log("isAuthentic = " , isAuthentic)
            res.status(200).send({success : "verified successfully"})
        }
        else{
            console.log("errore..: Authentication false in RazorPay")
            res.status(405).send({Errore : false})
        }
    }
    catch{
        console.log("errore............: RazorPay")
        res.status(405).send({Errore : false})
    }

})


//Order placing API
app.post('/OrderPlace/:userId/:productId', verifyToken, async (req, res) => {
    try {
        const { userId, productId } = req.params
        let { selectedQuantity, photoOnCake, flavour, purpose, nameOnCake, fullName, phoneNmuber, address, city, zip , razorpay_order_id, razorpay_payment_id} = req.body

        if(!razorpay_payment_id){
            razorpay_payment_id = "Cash On Delivery";
            razorpay_order_id = "Cash On Delivery";
        }

        // Find product details using productId and select the desire d fields
        const findProductId = await products.findOne({ _id: productId }).select('');
        // Find user details using userId
        const findUserID = await users.findOne({ _id: userId }).select('');
        const noPhotoOnCake = "Plain-cake";
        // Get the current date and time
        const currentDate = new Date();

        if (photoOnCake) {
            const cloudUploadRes = await cloudinary.uploader.upload(photoOnCake, {
                upload_preset: 'Photo-On-Cake'
            });

            var photo = cloudUploadRes.secure_url;
            //adding details in user 
            findUserID.orderProducts.push({
                productId,
                url: findProductId.cakeImage.url,
                cakeName: findProductId.cakeName,
                photoOnCake_URL: cloudUploadRes.secure_url,
                photoOnCake_Id: cloudUploadRes.public_id,
                nameOnCake,
                flavour,
                purpose,
                quantity: selectedQuantity,
                TotalePrice: (findProductId.price * selectedQuantity) + 30,
                addressDetailes: {
                    fullName,
                    phoneNumber: phoneNmuber,
                    address,
                    city,
                    zipCode: zip
                },
                DateTime: currentDate,
                orderStatus: "",
                paymentDetailes :{
                    razorpay_order_id,
                    razorpay_payment_id
                }
            });
        }
        else {
            //adding details in user 
            findUserID.orderProducts.push({
                productId,
                url: findProductId.cakeImage.url,
                cakeName: findProductId.cakeName,
                photoOnCake_URL: noPhotoOnCake,
                photoOnCake_Id: null,
                nameOnCake,
                flavour,
                purpose,
                quantity: selectedQuantity,
                TotalePrice: (findProductId.price * selectedQuantity) + 30,
                addressDetailes: {
                    fullName,
                    phoneNumber: phoneNmuber,
                    address,
                    city,
                    zipCode: zip
                },
                DateTime: currentDate,
                orderStatus: "",
                paymentDetailes :{
                    razorpay_order_id,
                    razorpay_payment_id
                }
            });
        }

        //save the updated data 
        await findUserID.save();
        // Retrieve the updated user data (excluding the password)
        const result = await users.findOne({ _id: userId }).select('-password');
        res.status(200).send(result);
        console.log("order placed successfully");


        const photoCake = photoOnCake ? photo : noPhotoOnCake
        //sanding  EMAIL  to SHAKUR
        //connect with the smtp Transport
        const transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: process.env.EMAIL_PORT,
            secure: process.env.EMAIL_SECURE,
            auth: {
                user: process.env.USER_EMAIL,
                pass: process.env.USER_PASS,
            }
        });

        //  datailes to send 
        const EmailmessageText = `**. . . . . . . . . .NEW-ORDER. . . . . . . . . . .**
            \n*Cake-Photo : ${findProductId.cakeImage.url} \n*Cake-Name : ${findProductId.cakeName} \n*photoOnCake : ${photoCake} \n*messageOnCake : ${nameOnCake} \n*flavour : ${flavour} \n*purpose : ${purpose} \n*Quantity : ${selectedQuantity}kg \n*Total_Amount :${findProductId.price * selectedQuantity + 30}
            \n*Name : ${fullName}\n*Address : ${address} , ${city} , ${zip} 
            \nPlease contact for more details.... \n*Phone-Num : ${phoneNmuber} `;

        let detailese = {
            from: process.env.EMAIL_FROM,// sender address
            to: process.env.EMAIL_FROM, // receivers address 
            subject: "NEW ORDER PLACED", // Subject line
            text: EmailmessageText, // plain text body
            // html: "<h4>Open above link and set your new password....!</h4>", // html body
        };

        // send email with defined transport object
        transporter.sendMail(detailese, () => {
            console.log("email sent SHAKUR successfully......1")
        })

        //sanding  EMAIL  to USER
        //connect with the smtp Transport
        const transporterUser = nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: process.env.EMAIL_PORT,
            secure: process.env.EMAIL_SECURE,
            auth: {
                user: process.env.USER_EMAIL,
                pass: process.env.USER_PASS,
            }
        });

        //  datailes to send 
        const EmailmessageTextUser = `**. . . . . . . . . .NEW-ORDER. . . . . . . . . . .**
        \n*Cake-Photo : ${findProductId.cakeImage.url} \n*Cake-Name : ${findProductId.cakeName} \n*photoOnCake : ${photoCake} \n*messageOnCake : ${nameOnCake} \n*flavour : ${flavour} \n*purpose : ${purpose} \n*Quantity : ${selectedQuantity}kg \n*Total_Amount :${findProductId.price * selectedQuantity + 30}
        \n*Name : ${fullName}\n*Address : ${address} , ${city} , ${zip} 
        \nPlease contact for more details.... \n*Phone-Num : ${process.env.SHAKUR_NUM} `;

        let detaileseUser = {
            from: process.env.EMAIL_FROM,// sender address
            to: result.email, // receivers address 
            subject: "ORDER PLACED Successfull (Belcake Terdal)", // Subject line
            text: EmailmessageTextUser, // plain text body
            // html: "<h4>Open above link and set your new password....!</h4>", // html body
        };

        // send email with defined transport object
        transporterUser.sendMail(detaileseUser, () => {
            console.log("email sent USER successfully......1")
        })

    }
    catch {
        console.log("somthing wrong in order placing")
    }
})
//order recalling to save last order detailes in shakur viewOrder list 
app.get('/OrderPlaceOwner/:userId/:orderId', async (req, res) => {
    const { userId, orderId } = req.params
    try {
        const findUserID = await users.findOne({ _id: userId }).select('');
        const findOrderCakeId = findUserID.orderProducts;

        const findOrder = findOrderCakeId.filter((e) => e.id === orderId);
        const matchingOrder = findOrder[0];

        //adding order product in shakures ViewOrder List
        //finding shakurs emailId
        const ShakurEmaliId = process.env.SHAKUR_EMAIL
        const result2 = await users.findOne({ email: ShakurEmaliId }).select('-password');
        if (result2) {
            result2.viewAllOrders.push({
                userId: userId,
                orderId: matchingOrder.id,
                url: matchingOrder.url,
                cakeName: matchingOrder.cakeName,
                photoOnCake_URL: matchingOrder.photoOnCake_URL,
                nameOnCake: matchingOrder.nameOnCake,
                flavour: matchingOrder.flavour,
                purpose: matchingOrder.purpose,
                quantity: matchingOrder.quantity,
                TotalePrice: matchingOrder.TotalePrice,
                fullName: matchingOrder.addressDetailes.fullName,
                phoneNumber: matchingOrder.addressDetailes.phoneNumber,
                address: matchingOrder.addressDetailes.address,
                city: matchingOrder.addressDetailes.city,
                zipCode: matchingOrder.addressDetailes.zipCode,
                DateTime: matchingOrder.DateTime,
                orderStatus: "",
                paymentDetailes :{
                    razorpay_order_id: matchingOrder.paymentDetailes.razorpay_order_id,
                    razorpay_payment_id: matchingOrder.paymentDetailes.razorpay_payment_id
                }
            })
            //save the updated data  in shakure 
            await result2.save();
            res.send({ finalResult: "done" })
            console.log("order saved in shakur ViewAllOrders ");

        }
    }
    catch {
        console.log("errore shakur ViewAllOrders not save")
    }
})



//Removing Ordered cakes 
app.delete('/RemoveOrderCake/:OrderCakeId/:userId/', verifyToken, async (req, res) => {

    const { OrderCakeId, userId } = req.params;
    const { photoOnCake_Id, url, titl, photoOnCake, flavour, purpose, nameOnCake, quantity, amount, fullName, city, phoneNum } = req.body

    try {

        const findUserID = await users.findOne({ _id: userId }).select('');
        const findOrderCakeId = findUserID.orderProducts;

        // Find the index of the Ordered cakes in the array
        const indexToRemove = findOrderCakeId.findIndex(
            (e) => e.id === OrderCakeId
        );

        // If the product is not found, indexToRemove will be -1.
        if (indexToRemove !== -1) {
            //deleting photo from cloudinary first
            if (photoOnCake_Id) {
                await cloudinary.uploader.destroy(photoOnCake_Id);
            }

            // Remove the product at the specified index
            findOrderCakeId.splice(indexToRemove, 1);//, we want to remove only one element, so we pass 1 as the second argument to splice.
            // Save the updated user data
            await findUserID.save();

            // Retrieve the updated user data (excluding the password)
            const result = await users.findOne({ _id: userId }).select('-password');
            res.status(200).send(result);
            console.log("Product removed successfully");


            //Removing  product from shakures ViewOrder List
            const ShakurEmaliId2 = process.env.SHAKUR_EMAIL;
            const result2 = await users.findOne({ email: ShakurEmaliId2 }).select('');
            const findProductCakeId = result2.viewAllOrders;
            const findIndex2 = findProductCakeId.findIndex(
                (e) => e.orderId == OrderCakeId

            );
            if (findIndex2 !== -1) {
                // Remove the product at the specified index
                findProductCakeId.splice(findIndex2, 1);
                await result2.save();
                console.log("successfully : product removed from shakures ViewOrder List");

            }
            else {
                console.log("index not find in shakur view order list")
            }

            //sanding  EMAIL sms to SHAKUR
            //connect with the smtp Transport
            const transporter = nodemailer.createTransport({
                host: process.env.EMAIL_HOST,
                port: process.env.EMAIL_PORT,
                secure: process.env.EMAIL_SECURE,
                auth: {
                    user: process.env.USER_EMAIL,
                    pass: process.env.USER_PASS,
                }
            });
            //  datailes to send 
            const EmailmessageText = `**. . . . . . . . . .ORDER-CANCELLED (Belcake-Terdal). . . . . . . . . . .**
            \n*Cake-Photo : ${url} \n*Cake-Name : ${titl} \n*photoOnCake : ${photoOnCake} \n*messageOnCake : ${nameOnCake} \n*flavour : ${flavour} \n*purpose : ${purpose} *Quantity : ${quantity}kg \n*Total_Amount :${amount}
            \n*Name : ${fullName}\n*Address : ${city}  
            \nPlease contact for more details...... \n*Belcake-Terdal : ${phoneNum}`;

            let detailese = {
                from: process.env.EMAIL_FROM,// sender address
                to: process.env.EMAIL_FROM, // receivers address
                subject: "ORDER CANCELLED", // Subject line
                text: EmailmessageText, // plain text body
                // html: "<h4>Open above link and set your new password....!</h4>", // html body
            };
            // send email with defined transport object
            transporter.sendMail(detailese, () => {
                console.log("email sent USER successfully......1")
            })


            //sanding  EMAIL sms to USER
            //connect with the smtp Transport
            const transporterUser = nodemailer.createTransport({
                host: process.env.EMAIL_HOST,
                port: process.env.EMAIL_PORT,
                secure: process.env.EMAIL_SECURE,
                auth: {
                    user: process.env.USER_EMAIL,
                    pass: process.env.USER_PASS,
                }
            });
            //  datailes to send 
            const EmailmessageTextUser = `**. . . . . . . . . .ORDER-CANCELLED (Belcake-Terdal). . . . . . . . . . .**
            \n*Cake-Photo : ${url} \n*Cake-Name : ${titl} \n*Quantity : ${quantity}kg \n*Total_Amount :${amount}
            \n*Name : ${fullName}\n*Address : ${city}  
            \nPlease contact for more details...... \n*Belcake-Terdal : ${process.env.SHAKUR_NUM}`;

            let detaileseUser = {
                from: process.env.EMAIL_FROM,// sender address
                to: result.email, // receivers address
                subject: "ORDER CANCELLED (Belcake Terdal)", // Subject line
                text: EmailmessageTextUser, // plain text body
                // html: "<h4>Open above link and set your new password....!</h4>", // html body
            };
            // send email with defined transport object
            transporterUser.sendMail(detaileseUser, () => {
                console.log("email sent USER successfully......1")
            })

        }
        else {
            console.log("order cake not found")
        }
    }
    catch {
        console.log("somthing wrong in ordered cake removing ")
    }
})


//Get user Ordered List for evry refresh
app.post('/getOrderedList/:Id', async (req, res) => {
    const userId = req.params.Id
    try {
        //find user first 
        const result = await users.findOne({ _id : userId }).select('-password');
        if (result) {
            res.send({ user: result })
            console.log(" Successfull : View All Ordered List for evry refresh")
        }
        else {
            console.log("email id not match to find the user....View All Ordered List ")
        }
    }
    catch {
        console.log("ERRORE  :   View All Ordered List for evry refresh")
    }
})


//Get owner View All Ordered List for evry refresh
app.post('/getViewAllOrders/:Id', async (req, res) => {
    const emailId = req.params.Id
    try {
        //find user first 
        const result = await users.findOne({ email: emailId }).select('-password');
        if (result) {
            res.send({ user: result })
            console.log(" Successfull : View All Ordered List for evry refresh")
        }
        else {
            console.log("email id not match to find the user....View All Ordered List ")
        }
    }
    catch {
        console.log("ERRORE  :   View All Ordered List for evry refresh")
    }
})


//Removing View All Ordered List item
app.delete('/RemoveViewAllOrder/:OrderCakeId/:userId', verifyToken, async (req, res) => {
    const { OrderCakeId, userId } = req.params;
    try {

        const findUserID = await users.findOne({ _id: userId }).select('');
        const findOrderCakeId = findUserID.viewAllOrders;

        // Find the index of the Ordered cakes in the array
        const indexToRemove = findOrderCakeId.findIndex(
            (e) => e.id === OrderCakeId
        );

        // If the product is not found, indexToRemove will be -1.
        if (indexToRemove !== -1) {
            // Remove the product at the specified index
            findOrderCakeId.splice(indexToRemove, 1);//, we want to remove only one element, so we pass 1 as the second argument to splice.
            // Save the updated user data
            await findUserID.save();

            const result = await users.findOne({ _id: userId }).select('-password');
            res.status(200).send(result);
            console.log("View All Ordered List item removed successfully");

        }
        else {
            console.log(" View All Ordered List item not found")
        }
    }
    catch {
        console.log("somthing wrong in Removing View All Ordered List item")
    }
})


//updating order status in viewAllOrdes page
app.put('/updateOrderStatus/:userId/:orderId/:OrderedCakeId', verifyToken, async (req, res) => {
    const { userId, orderId ,OrderedCakeId } = req.params;
    const  selectedStatus = req.body.selectedStatus;
    try {
        // Finding user order details 
        const finduser = await users.findOne({ _id: userId }).select('');
        const findOrder = finduser.orderProducts;
        const findOrderIndex = findOrder.findIndex((e) => e.id === orderId);

        if (findOrderIndex !== -1) {
            // Update the 'orderStatus' in user
            const matchingOrderUser = findOrder[findOrderIndex];
            matchingOrderUser.orderStatus = selectedStatus;
            console.log("Status updated in user");

            // Finding Owner Order details
            const ShakurEmaliId = process.env.SHAKUR_EMAIL;
            const findOwner = await users.findOne({ email: ShakurEmaliId }).select('');
            const findOwnerOrder = findOwner.viewAllOrders;
            const findOwnerOrderIndex = findOwnerOrder.findIndex((e) => e.id === OrderedCakeId);

            if (findOwnerOrderIndex !== -1) {
                // Update the 'orderStatus' in owner
                const matchingOrderOwner = findOwnerOrder[findOwnerOrderIndex];
                matchingOrderOwner.orderStatus = selectedStatus;
                console.log("Status updated in owner");

                await finduser.save();
                await findOwner.save();

                res.status(200).send({ result: "Successfully updated" });
            } else {
                console.log("Updating order status: Index not found in owner");
            }
        }
         else {
            console.log("Updating order status: Index not found in user");
        }
    }
     catch (error) {
        console.log("Error: Updating order status", error);
    }
});

//search ViewOrder page API
app.get('/searchViewOrder/:key', async (req, res) => {
    try {
        // Finding Owner Order details
        const ShakurEmaliId = process.env.SHAKUR_EMAIL;
        const findOwner = await users.findOne({ email: ShakurEmaliId }).select('');
        const findOwnerOrder = findOwner.viewAllOrders;

        const searchKey = req.params.key;

        const result = findOwnerOrder.filter((order) => {
            return (
                order.city.match(new RegExp(searchKey, 'i')) ||
                order.fullName.match(new RegExp(searchKey, 'i')) ||
                order.nameOnCake.match(new RegExp(searchKey, 'i')) ||
                order.phoneNumber.match(new RegExp(searchKey, 'i')) ||
                order.DateTime.match(new RegExp(searchKey, 'i')) ||
                order.paymentDetailes.razorpay_payment_id.match(new RegExp(searchKey, 'i')) 
            );
        });

        if (result.length === 0) {
            const OrdersList = await users.findOne({ email: ShakurEmaliId }).select('-password');
            res.send(OrdersList);
        } 
        else {
            // Send the search results
            res.send(result);
        }
    }
    catch (error) {
        console.error('An error occurred while searching for cakes.');
    }
})



app.listen(process.env.PORT || 10000) 