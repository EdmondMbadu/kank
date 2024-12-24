/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */
// const functions = require("firebase-functions");
// const admin = require("firebase-admin");

// const twilio = require("twilio");
// admin.initializeApp();
// const accountSid = functions.config().twilio.sid;
// const authToken = functions.config().twilio.token;

// eslint-disable-next-line new-cap
// const client = new twilio(accountSid, authToken);

const {onRequest} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

exports.helloWorld = onRequest((request, response) => {
  logger.info("Hello logs!", {structuredData: true});
  response.send("Hello from Firebase!");
});
// function makeValidE164(num:any){}
