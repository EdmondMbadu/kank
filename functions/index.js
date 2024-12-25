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


// function makeValidE164(num:any){}
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const twilio = require("twilio");

// Initialize Firebase Admin
admin.initializeApp();

// Retrieve Twilio credentials from environment variables
const accountSid = functions.config().twilio.sid;
const authToken = functions.config().twilio.token;
const twilioPhoneNumber = functions.config().twilio.phone_number;

// Initialize Twilio client
// eslint-disable-next-line new-cap
const twilioClient = new twilio(accountSid, authToken);


// eslint-disable-next-line require-jsdoc
function makeValidE164(number) {
  // Remove all non-numeric characters
  const cleaned = ("" + number).replace(/\D/g, "");

  // Basic validation for US numbers; adjust regex for other formats
  if (cleaned.length === 10) {
    return `+1${cleaned}`;
  } else if (cleaned.length === 11 && cleaned.startsWith("1")) {
    return `+${cleaned}`;
  } else {
    // Invalid format
    return null;
  }
}

/**
 * Helper function to get today's date in MM-DD-YYYY format
 * @return {string}
 */
function getTodayDateString() {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  const year = today.getFullYear();
  return `${month}-${day}-${year}`;
}

/**
 * Cloud Function to send SMS upon payment update
 */
exports.sendPaymentSMS = functions.firestore
    .document("users/{userId}/clients/{clientId}")
    .onUpdate(async (change, context) => {
      const beforeData = change.before.data();
      const afterData = change.after.data();

      // Check if the 'payments' field has changed
      const paymentsBefore = beforeData.payments || {};
      const paymentsAfter = afterData.payments || {};

      // If 'payments' hasn't changed, exit the function
      if (JSON.stringify(paymentsBefore) === JSON.stringify(paymentsAfter)) {
        console.log("'payments' field has not changed. Exiting function.");
        return null;
      }

      // Identify new payment entries
      const newPayments = Object.keys(paymentsAfter)
          .filter((key) => !(key in paymentsBefore));

      if (newPayments.length === 0) {
        console.log("No new payments detected.");
        return null;
      }

      // Get today's date string
      const todayStr = getTodayDateString();

      // Sum all payments made today
      let todaysPaymentTotal = 0;
      newPayments.forEach((paymentKey) => {
        if (paymentKey.startsWith(todayStr)) {
          const amount = parseFloat(paymentsAfter[paymentKey]);
          if (!isNaN(amount)) {
            todaysPaymentTotal += amount;
          }
        }
      });

      if (todaysPaymentTotal === 0) {
        console.log("No payments made today.");
        return null;
      }

      // Retrieve client details
      const client = afterData;
      const firstName = client.firstName || "Valued";
      const lastName = client.lastName || "Client";
      const phoneNumber = client.phoneNumber;

      if (!phoneNumber) {
        console.log("Client does not have a phone number.");
        return null;
      }

      const formattedNumber = makeValidE164(phoneNumber);
      if (!formattedNumber) {
        console.log(`Invalid phone number format: ${phoneNumber}`);
        return null;
      }

      // Retrieve total savings and amount remaining
      const totalSavings = parseFloat(client.savings) || 0;
      const amountRemaining = parseFloat(client.debtLeft) || 0;

      // Construct the SMS message
      const message = `Bonjour ${firstName} ${lastName},

      Paiement d'aujourd'hui : FC ${todaysPaymentTotal.toLocaleString()}
      Epargnes: FC ${totalSavings.toLocaleString()}
      Dette restant : FC ${amountRemaining.toLocaleString()}
      
      Merci pour votre confiance continue !`;

      try {
      // Send SMS via Twilio
        const twilioResponse = await twilioClient.messages.create({
          body: message,
          from: twilioPhoneNumber,
          to: formattedNumber,
        });

        const sid = twilioResponse.sid;
        console.log(`SMS sent to ${formattedNumber}: SID ${sid}`);
      } catch (error) {
        console.error("Error sending SMS via Twilio:", error);
      }

      return null;
    });

