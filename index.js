const nodemailer = require('nodemailer');
require('dotenv').config();
const mongoose = require('mongoose');
const express = require('express');
const cors = require('cors');
const app = express();


// Middleware
app.use(cors());
app.use(express.json());
mongoose.set('debug', true);

// Define a Mongoose schema and model for email schedules
const emailScheduleSchema = new mongoose.Schema({
    to_email: { type: String, required: true },
    cc_emails: { type: [String], default: '' },
    bcc_emails: { type: [String], default: '' },
    subject: { type: String, required: true },
    body: { type: String, required: true },
    send_datetime: { type: Date, required: true },
}, { timestamps: true });

const EmailSchedule = mongoose.model('EmailSchedule', emailScheduleSchema);

async function sendEmail(toEmail, ccEmails, bccEmails, subject, body,messages) {


    const loginEmail = process.env.EMAIL;
    const password = process.env.PASSWORD;

    if(!loginEmail || !password){
        return;
    }

    const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false, // true for 465, false for other ports
        auth: {
            user: loginEmail,
            pass: password,
        },
    });

    const mailOptions = {
        from: loginEmail,
        to: toEmail,
        cc: ccEmails,
        bcc: bccEmails,
        subject: subject,
        text: body,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Mail sent to ${toEmail}`);
    } catch (error) {
    }
}

// Function to check and send emails
async function checkAndSendEmails(messages) {

    try {
            
        let currentTime = new Date();
        currentTime.setHours(currentTime.getHours() + 5); // Add 5 hours
        currentTime.setMinutes(currentTime.getMinutes() + 30); // Add 30 minutes

        // Fetch emails that need to be sent
        if(mongoose.connection.readyState === 1){
            const emailsToSend = await EmailSchedule.find({ send_datetime: { $lte: currentTime } });
            for (const email of emailsToSend) {
                await sendEmail(email.to_email, email.cc_emails, email.bcc_emails, email.subject, email.body,messages);
                // Remove the email from the database after sending
                await EmailSchedule.findByIdAndDelete(email._id);
            }
        }
        else if(mongoose.connection.readyState === 2){
        }
        else{
        }
    } catch (error) {
    }
}


async function handler(messages) {
    await checkAndSendEmails(messages);
}

app.get("*",async (req,res)=>{
    try{
        await handler();
        res.status(200).json({});
    }
    catch (error){
        res.status(500).json({message: "Failed to trigger handler",error : `${error}`});
    }
})


async function connectToMongoDB() {
    try {
        await mongoose.connect(process.env.URI, { serverSelectionTimeoutMS: 30000 });
        await handler();
    } catch (err) {
        console.error('MongoDB connection error:', err);
        setTimeout(connectToMongoDB, 15000); // Retry after 5 seconds
    }
}

async function runner() {
    await connectToMongoDB();
    setTimeout(runner,60000);
}

runner();



