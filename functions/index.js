/* eslint-disable valid-jsdoc */
/* eslint-disable max-len */
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const AfricasTalking = require("africastalking");

// Initialize Firebase Admin
admin.initializeApp();

// Retrieve Africa's Talking credentials from environment variables
const apiKey = functions.config().africastalking.api_key;
const username = functions.config().africastalking.username;

// Initialize Africa's Talking SDK
// eslint-disable-next-line new-cap
const africastalking = AfricasTalking({
  apiKey,
  username,
});

// Get the SMS service
const sms = africastalking.SMS;

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
// function getTodayDateString() {
//   const today = new Date();
//   const month = today.getMonth() + 1; // Months are zero-based
//   const day = today.getDate();
//   const year = today.getFullYear();
//   return `${month}-${day}-${year}`;
// }
// eslint-disable-next-line require-jsdoc
// function getTodayDateStringFormatted() {
//   const today = new Date();
//   const month = String(today.getMonth() + 1).padStart(2, "0");
//   const day = String(today.getDate()).padStart(2, "0");
//   const year = today.getFullYear();
//   return `${day}/${month}/${year}`;
// }

/**
 * Cloud Function to send SMS upon payment update or daily summary
 */
// exports.sendPaymentSMS = functions.firestore
//     .document("users/{userId}/clients/{clientId}")
//     .onUpdate(async (change, context) => {
//       console.log("Function execution started");

//       const beforeData = change.before.data();
//       const afterData = change.after.data();

//       const paymentsBefore = beforeData.payments || {};
//       const paymentsAfter = afterData.payments || {};

//       // **Removed Early Exit** (always send SMS regardless of whether payments changed)

//       // Identify new payment entries
//       const newPayments = Object.keys(paymentsAfter).filter(
//           (key) => !(key in paymentsBefore),
//       );
//       console.log(`New payments detected: ${newPayments.length}`);

//       // Sum today's payments
//       const todayStr = getTodayDateString();
//       console.log(`Today's date string: ${todayStr}`);

//       let todaysPaymentTotal = 0;
//       newPayments.forEach((paymentKey) => {
//         if (paymentKey.startsWith(todayStr)) {
//           const amount = parseFloat(paymentsAfter[paymentKey]);
//           if (!isNaN(amount)) {
//             todaysPaymentTotal += amount;
//           } else {
//             console.log(
//                 `Invalid payment amount for key ${paymentKey}: ${paymentsAfter[paymentKey]}`,
//             );
//           }
//         }
//       });

//       console.log(`Today's payment total: ${todaysPaymentTotal}`);

//       // Retrieve client details
//       const client = afterData;
//       const firstName = client.firstName || "Valued";
//       const lastName = client.lastName || "Client";
//       const phoneNumber = client.phoneNumber;

//       if (!phoneNumber) {
//         console.log("Client does not have a phone number.");
//         return null;
//       }

//       const formattedNumber = makeValidE164(phoneNumber);
//       if (!formattedNumber) {
//         console.log(`Invalid phone number format: ${phoneNumber}`);
//         return null;
//       }

//       console.log(`Formatted phone number: ${formattedNumber}`);

//       // Retrieve savings and debt
//       const totalSavings = parseFloat(client.savings) || 0;
//       const amountRemaining = parseFloat(client.debtLeft) || 0;

//       const todayFormatted = getTodayDateStringFormatted();

//       // Construct message
//       let message = `${firstName} ${lastName},\n`;

//       if (todaysPaymentTotal > 0) {
//         message += `Paiement du ${todayFormatted} : FC ${todaysPaymentTotal.toLocaleString()}\n`;
//       } else {
//       // Optionally mention no payment made today
//       // message += `Aucun paiement effectué aujourd'hui le ${todayFormatted}.\n`;
//       }

//       message += `Dette: FC ${amountRemaining.toLocaleString()}\nEpargnes : FC ${totalSavings.toLocaleString()}\n\nMerci pour votre confiance continue à la Fondation Gervais!`.trim();

//       console.log(`Constructed message: ${message}`);

//       try {
//       // **Send SMS via Africa's Talking**
//         const response = await sms.send({
//           to: [formattedNumber],
//           message: message,
//         // from: 'YourSenderIdOrShortCodeIfApplicable' // Optional
//         });
//         console.log(`SMS sent to ${formattedNumber}:`, response);
//       } catch (error) {
//         console.error("Error sending SMS via Africa's Talking:", error);
//       }

//       console.log("Function execution completed");
//       return null;
//     });

/**
 * Helper function to format a date string to DD/MM/YYYY
 */
function formatDate(dateInput) {
  const date = new Date(dateInput);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Cloud Function to send SMS when a client's loan is activated.
 */
exports.sendClientCompletionSMS = functions.firestore
    .document("users/{userId}/clients/{clientId}")
    .onUpdate(async (change, context) => {
      console.log("sendClientCompletionSMS function execution started");

      const beforeData = change.before.data();
      const afterData = change.after.data();

      // Check if 'debtCycleStartDate' was just set (loan activated)
      const wasDebtCycleStartedBefore = !!beforeData.debtCycleStartDate;
      const isDebtCycleStartedNow = !!afterData.debtCycleStartDate;

      if (!wasDebtCycleStartedBefore && isDebtCycleStartedNow) {
        console.log("Debt cycle started. Proceeding to send SMS.");

        // Retrieve necessary fields
        const montant = afterData.loanAmount || "N/A";
        // const dateDebut = afterData.debtCycleStartDate ?
        // formatDate(afterData.debtCycleStartDate) :
        // "N/A";
        const dateFin = afterData.debtCycleEndDate ?
        formatDate(afterData.debtCycleEndDate) :
        "N/A";
        const nombrePaiements = afterData.paymentPeriodRange || "N/A";

        // Use paymentPeriodRange directly as duration in weeks
        const duree = afterData.paymentPeriodRange ?
        `${afterData.paymentPeriodRange} semaines` :
        "N/A";

        // Compute minimum payment
        let montantMinimum = "N/A";
        const amountToPay = parseFloat(afterData.amountToPay);
        const paymentPeriodRange = parseInt(afterData.paymentPeriodRange, 10);
        if (!isNaN(amountToPay) && !isNaN(paymentPeriodRange) && paymentPeriodRange > 0) {
          montantMinimum = (amountToPay / paymentPeriodRange).toFixed(2);
        }

        // Retrieve client details
        const firstName = afterData.firstName || "";
        const lastName = afterData.lastName || "";
        const fullName = `${firstName} ${lastName}`.trim() || "Valued Client";
        const phoneNumber = afterData.phoneNumber;

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

        // Construct the message
        const message = `Bonjour ${fullName},
Ozui lelo Niongo ya ${montant} FC. Efuteli ekosila le ${dateFin}. Okosala ${nombrePaiements} paiements na ${duree}, okofuta ${montantMinimum} FC semaine nionso. Merci pona confiance na Fondation Gervais`;

        console.log(`Constructed message: ${message}`);

        try {
        // Send SMS via Africa's Talking
          const response = await sms.send({
            to: [formattedNumber],
            message: message,
          // from: 'YourSenderIdOrShortCodeIfApplicable'
          });

          console.log(`SMS sent to ${formattedNumber}:`, response);
        } catch (error) {
          console.error("Error sending SMS via Africa's Talking:", error);
        }
      } else {
        console.log("Debt cycle was not just started. Exiting function.");
      }

      console.log("sendClientCompletionSMS function execution completed");
      return null;
    });


/**
 * Cloud Function to send reminders to all clients passed in from the front end.
 *
 * Triggered via HTTPS Callable:
 *   const callable = this.fns.httpsCallable('sendPaymentReminders');
 *   callable({ clients: [...] });
 */
exports.sendPaymentReminders = functions.https.onCall(async (data, context) => {
  const {clients} = data;

  if (!clients || !Array.isArray(clients)) {
    console.error("No client array provided");
    throw new functions.https.HttpsError(
        "invalid-argument",
        "Expected clients array",
    );
  }

  // Optionally, you can check if the caller is authenticated:
  // if (!context.auth) {
  //   throw new functions.https.HttpsError(
  //     'unauthenticated',
  //     'Only authenticated users can invoke this function.'
  //   );
  // }

  let successCount = 0;
  let failCount = 0;

  // Iterate through each client, format phone, build message, and send
  for (const client of clients) {
    const {firstName, lastName, phoneNumber, minPayment} = client;
    if (!phoneNumber) {
      console.log("Skipping client with no phone number:", client);
      failCount++;
      continue;
    }

    const formattedNumber = makeValidE164(phoneNumber);
    if (!formattedNumber) {
      console.log(`Invalid phone number: ${phoneNumber}`);
      failCount++;
      continue;
    }

    // Construct your reminder message
    // You can adjust the wording as you wish
    const message = `Bonjour ${firstName || "Valued"} ${
      lastName || "Client"
    },\n` +
    `Ozali programmer lelo pona kofuta  FC ${minPayment}.\n` +
    `Merci pona confiance na Fondation Gervais.`;

    try {
      // Send SMS via Africa's Talking
      const response = await sms.send({
        to: [formattedNumber],
        message,
      });
      console.log(`SMS sent to ${formattedNumber} ->`, response);
      successCount++;
    } catch (error) {
      console.error("Error sending SMS:", error);
      failCount++;
    }
  }

  // Return an object so the client knows how many succeeded/failed
  return {
    message: `Reminders sent. Success: ${successCount}, Failed: ${failCount}`,
  };
});
