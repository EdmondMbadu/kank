/* eslint-disable max-len */
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
const twilioClient = twilio(accountSid, authToken);


/**
 * Formats a phone number to E.164 standard based on its origin.
 * - If the number starts with '0', it's treated as a DRC number.
 *   - Removes the leading '0' and adds '+243'.
 * - Otherwise, it's treated as a US number.
 *   - If 10 digits, adds '+1'.
 *   - If 11 digits starting with '1', adds '+' without altering digits.
 * - Returns null for invalid formats.
 *
 * @param {string} number - The raw phone number input.
 * @return {string|null} - The formatted E.164 phone number or null if invalid.
 */
function makeValidE164(number) {
  // Remove all non-digit characters
  const cleaned = ("" + number).replace(/\D/g, "");

  // Check if the number starts with '0' (DRC)
  if (cleaned.startsWith("0")) {
    const withoutZero = cleaned.slice(1); // Remove the leading '0'

    // Optional: Validate DRC number length (typically 9 digits after '0')
    // Uncomment the following lines if you want to enforce length
    // if (withoutZero.length !== 9) {
    //   console.log(`Invalid DRC number length: ${number}`);
    //   return null;
    // }

    return `+243${withoutZero}`;
  }

  // Check for US numbers with 10 digits
  if (cleaned.length === 10) {
    return `+1${cleaned}`;
  }

  // Check for US numbers with 11 digits starting with '1'
  if (cleaned.length === 11 && cleaned.startsWith("1")) {
    return `+${cleaned}`;
  }

  // If none of the above conditions are met, return null
  console.log(`Invalid phone number format: ${number}`);
  return null;
}

// eslint-disable-next-line valid-jsdoc
/**
 * Helper function to get today's date in MM-DD-YYYY format
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
      console.log("Function execution started");

      const beforeData = change.before.data();
      const afterData = change.after.data();

      const paymentsBefore = beforeData.payments || {};
      const paymentsAfter = afterData.payments || {};

      // Check if 'payments' field has changed
      if (JSON.stringify(paymentsBefore) === JSON.stringify(paymentsAfter)) {
        console.log("'payments' field has not changed. Exiting function.");
        return null;
      }

      // Identify new payment entries
      const newPayments = Object.keys(paymentsAfter).filter((key) => !(key in paymentsBefore));
      if (newPayments.length === 0) {
        console.log("No new payments detected.");
        return null;
      }

      // Get today's date
      const todayStr = getTodayDateString();
      console.log(`Today's date string: ${todayStr}`);

      // Sum today's payments
      let todaysPaymentTotal = 0;
      newPayments.forEach((paymentKey) => {
        if (paymentKey.startsWith(todayStr)) {
          const amount = parseFloat(paymentsAfter[paymentKey]);
          if (!isNaN(amount)) {
            todaysPaymentTotal += amount;
          } else {
            console.log(`Invalid payment amount for key ${paymentKey}: ${paymentsAfter[paymentKey]}`);
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

      console.log(`Formatted phone number: ${formattedNumber}`);

      // Retrieve savings and debt
      const totalSavings = parseFloat(client.savings) || 0;
      const amountRemaining = parseFloat(client.debtLeft) || 0;

      // Construct message
      const message = `
      Bonjour ${firstName} ${lastName},
      Paiement d'aujourd'hui : FC ${todaysPaymentTotal.toLocaleString()}
      Montant restant : FC ${amountRemaining.toLocaleString()}
      Epargnes : FC ${totalSavings.toLocaleString()}
      
      Merci pour votre confiance continue à la Fondation Gervais!
      `.trim();

      console.log(`Constructed message: ${message}`);


      try {
      // Send SMS
        const twilioResponse = await twilioClient.messages.create({
          body: message,
          from: twilioPhoneNumber,
          to: formattedNumber,
        });

        console.log(`SMS sent to ${formattedNumber}: SID ${twilioResponse.sid}`);
        console.log(`Twilio Response:`, twilioResponse);
      } catch (error) {
        console.error("Error sending SMS via Twilio:", error);
      }

      console.log("Function execution completed");
      return null;
    });
