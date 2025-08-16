/* eslint-disable brace-style */
/* eslint-disable require-jsdoc */
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
const db = admin.firestore();

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
 * Callable: send a custom SMS to a single client.
 * Payload: { phoneNumber: string, message: string, metadata?: {...} }
 */
exports.sendCustomSMS = functions.https.onCall(async (data, context) => {
  // OPTIONAL: lock to signed-in users (and optionally admin role)
  // if (!context.auth) {
  //   throw new functions.https.HttpsError('unauthenticated','Sign in required');
  // }
  // const isAdmin = context.auth.token?.admin === true;
  // if (!isAdmin) throw new functions.https.HttpsError('permission-denied','Admin only');

  const {phoneNumber, message, metadata = {}} = data || {};
  if (!phoneNumber || !message) {
    throw new functions.https.HttpsError("invalid-argument", "phoneNumber and message are required");
  }

  const to = makeValidE164(phoneNumber);
  if (!to) {
    throw new functions.https.HttpsError("invalid-argument", "Invalid phone number");
  }

  try {
    const resp = await sms.send({to: [to], message});
    // Optional audit trail
    // await admin.firestore().collection('sms_outbox').add({
    //   to, message, metadata,
    //   createdAt: admin.firestore.FieldValue.serverTimestamp(),
    //   byUid: context.auth?.uid || null
    // });
    console.log("SMS medata:", metadata);
    console.log("SMS sent successfully:", resp || "No response received ");
    return {ok: true, providerResponse: resp};
  } catch (err) {
    console.error("sendCustomSMS failed:", err);
    throw new functions.https.HttpsError("internal", "SMS send failed");
  }
});

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

      const oldCycleStart = beforeData.debtCycleStartDate;
      const newCycleStart = afterData.debtCycleStartDate;

      console.log("Old cycle start date:", oldCycleStart);
      console.log("New cycle start date:", newCycleStart);

      // Only proceed if the debtCycleStartDate actually changed
      if (oldCycleStart !== newCycleStart) {
        console.log("Debt cycle start date changed. Proceeding to send SMS.");

        // Retrieve necessary fields
        const montant = afterData.loanAmount || "N/A";

        // For safety, always handle possibility of a missing date
        const dateDebut = newCycleStart ? formatDate(newCycleStart) : "N/A";
        const dateFin = afterData.debtCycleEndDate ?
        formatDate(afterData.debtCycleEndDate) :
        "N/A";
        const nombrePaiements = afterData.paymentPeriodRange || "N/A";

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

        // Construct your message
        const message = `${fullName},
Ozui Niongo ya ${montant} FC. Efuteli Ekobanda le ${dateDebut} pe ekosila le ${dateFin}. Okosala ${nombrePaiements} paiements na ${duree}, okofuta ${montantMinimum} FC semaine nionso. En cas de probleme ou d'erreurs benga 0825333567. Merci pona confiance na Fondation Gervais`;

        console.log(`Constructed message: ${message}`);

        try {
          const response = await sms.send({
            to: [formattedNumber],
            message: message,
          });
          console.log(`SMS sent to ${formattedNumber}:`, response);
        } catch (error) {
          console.error("Error sending SMS via Africa's Talking:", error);
        }
      } else {
        console.log("Debt cycle start date did NOT change. Exiting function.");
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
    const {firstName, lastName, phoneNumber, minPayment, debtLeft, savings} = client;
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
    `Ozali programmer lelo pona kofuta  FC ${minPayment}. Otikali na niongo ya FC ${debtLeft}. Epargnes na yo ezali: FC ${savings}.\n` +
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


function generate4DigitCode() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

/**
 * Cloud Function (callable) that:
 * 1) Receives { phoneNumber, name? } from client
 * 2) Generates a 4-digit code
 * 3) Sends the code via SMS ("<code> ezali code na yo")
 * 4) Optionally returns (or stores) the code for verification
 */
exports.sendVerificationCode = functions.https.onCall(async (data, context) => {
  const phoneNumber = data.phoneNumber;
  // const name = data.name || "Cher Client";

  if (!phoneNumber) {
    throw new functions.https.HttpsError(
        "invalid-argument",
        "phoneNumber is required",
    );
  }

  // Format phone number
  const formattedPhone = makeValidE164(phoneNumber);
  if (!formattedPhone) {
    throw new functions.https.HttpsError(
        "invalid-argument",
        "Could not format phone number",
    );
  }

  // Generate the 4-digit code
  const code = generate4DigitCode();

  // Construct your message in Lingala or French as you prefer
  const message = `${code} ezali code na yo - Fondation Gervais.`;

  console.log(`Sending code '${code}' to phone: ${formattedPhone}`);

  // Send SMS
  try {
    const response = await sms.send({
      to: [formattedPhone],
      message: message,
    });
    console.log("SMS send response:", response);
  } catch (error) {
    console.error("Error sending SMS via Africa's Talking:", error);
    throw new functions.https.HttpsError(
        "internal",
        "Failed to send SMS. " + error.message,
    );
  }

  // Optionally store the code in Firestore (if you want verification)
  // Example: store in a subcollection "otpCodes" under the user's doc
  /*
  await admin.firestore().collection("otpCodes").add({
    phoneNumber: formattedPhone,
    code: code,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  */

  // Return the code if you need it client-side or for debugging
  return {
    message: `Verification code sent to ${formattedPhone}`,
    code: code,
  };
});


exports.sendClientRegistrationSMS = functions.firestore
    .document("users/{userId}/clients/{clientId}")
    .onWrite(async (change, context) => {
    // Exit if the document is deleted
      if (!change.after.exists) {
        console.log("Document was deleted. Exiting...");
        return null;
      }
      const beforeData = change.before.data() || {};
      const afterData = change.after.data() || {};

      // Check if we have *transitioned* to the register state
      const wasRegister = isRegisterState(beforeData);
      const isRegister = isRegisterState(afterData);

      if (!isRegister) {
        // Not in registration state after the update => do nothing
        console.log("Not a registration state. Exiting...");
        return null;
      }

      if (wasRegister && isRegister) {
        // Already was in registration state => no change => do nothing
        console.log("Already in registration state, no change. Exiting...");
        return null;
      }

      // ---- If we reach here, we *just* transitioned to 'register' state ----
      console.log("Client transitioned to registration state. Proceeding with SMS...");


      // ---- Gather necessary fields ----
      const firstName = afterData.firstName || "";
      const lastName = afterData.lastName || "";
      const fullName = `${firstName} ${lastName}`.trim() || "Valued Client";

      const phoneNumber = afterData.phoneNumber;
      if (!phoneNumber) {
        console.log("No phone number found for this client. Skipping SMS...");
        return null;
      }

      // Validate or convert phone number to E.164 (if needed)
      const formattedNumber = makeValidE164(phoneNumber);
      if (!formattedNumber) {
        console.log(`Invalid phone number format: ${phoneNumber}`);
        return null;
      }

      // Summation of fees: membership + application
      const membershipFee = Number(afterData.membershipFee || 0);
      const applicationFee = Number(afterData.applicationFee || 0);
      const frais = membershipFee + applicationFee;

      // The total loan amount
      const montant = afterData.loanAmount || "N/A";

      // Savings (already updated in your app when they register)
      const savings = afterData.savings || 0;

      // requestDate is stored in MM-DD-YYYY, but you want DD/MM/YYYY
      const requestDateRaw = afterData.requestDate; // e.g. "3-18-2025"
      const requestDate = formatDate(requestDateRaw);

      // ---- Construct your SMS message ----
      // Example in Lingala (based on your snippet):
      const message = `${fullName},
Osengi niongo ya ${montant} FC. Niongo okozua yango le ${requestDate}.
Ofuti mobongo ya frais nionso ${frais} FC. Epargnes na yo otie ezali ${savings} FC.
En cas de probleme ou d'erreurs benga 0825333567.
Merci pona confiance na Fondation Gervais`;

      console.log("Registration SMS message:", message);
      console.log("Sending to:", formattedNumber);

      // ---- Send the SMS using your Africa's Talking (or other) SDK ----
      try {
        const response = await sms.send({
          to: [formattedNumber],
          message: message,
        });
        console.log(`SMS sent to ${formattedNumber}:`, response);
      } catch (error) {
        console.error("Error sending registration SMS:", error);
      }

      // -----------------------------------------------------------------
      //   PART 2: Assign the client to an auditor & send the auditor SMS
      // -----------------------------------------------------------------

      try {
      // 1) Fetch the user doc to get the user’s firstName as "clientLocation"
        const userDocSnapshot = await db
            .collection("users")
            .doc(context.params.userId)
            .get();
        const userData = userDocSnapshot.data() || {};
        const clientLocation = userData.firstName || "Unknown";

        if (userData.mode==="testing") {
          console.log("User is in testing mode. Skipping auditor assignment...");
          return null;
        }
        // 2) Fetch all audit documents
        const auditsSnapshot = await db.collection("audit").get();
        if (auditsSnapshot.empty) {
          console.log("No auditors found. Skipping assignment...");
          return null;
        }

        // 3) Find the auditor with the fewest pendingClients
        let chosenAudit = null;
        let minClients = Infinity;
        let backupAudits = []; // In case multiple have the same #, we can pick randomly

        auditsSnapshot.forEach((doc) => {
          const data = doc.data();
          const pendingClients = data.pendingClients || [];
          const size = pendingClients.length;

          if (size < minClients) {
            chosenAudit = {id: doc.id, ...data};
            minClients = size;
            backupAudits = [chosenAudit];
          } else if (size === minClients) {
          // track multiple if needed
            backupAudits.push({id: doc.id, ...data});
          }
        });

        // If we have multiple audits tied, pick randomly from backupAudits
        if (backupAudits.length > 1) {
          const idx = Math.floor(Math.random() * backupAudits.length);
          chosenAudit = backupAudits[idx];
        }

        if (!chosenAudit) {
          console.log("No suitable auditor found. Skipping assignment...");
          return null;
        }

        console.log("Chosen auditor:", chosenAudit.name);

        // 4) Add this client to the chosen auditor's pendingClients array
        await db
            .collection("audit")
            .doc(chosenAudit.id)
            .update({
              pendingClients: admin.firestore.FieldValue.arrayUnion({
                clientName: fullName,
                clientLocation: clientLocation,
                clientPhoneNumber: phoneNumber,
                clientId: context.params.clientId,
                clientProfilePicture: afterData.profilePicture.downloadURL || "",
              }),
            });

        // 5) Send SMS to the chosen auditor
        const auditorNumber = makeValidE164(chosenAudit.phoneNumber);
        if (!auditorNumber) {
          console.log(`Invalid phone number for auditor: ${chosenAudit.phoneNumber}`);
        } else {
        // Construct the auditor SMS
          const auditorMessage = `${chosenAudit.name},
Oponami pona ko verifier ba information ya client ${fullName} ya location ${clientLocation}. Numero na ye ezali ${phoneNumber}. Benga ye pe verifier ba information na ye. Merci pona mosala malamu na Fondation Gervais`;

          try {
            const response = await sms.send({
              to: [auditorNumber],
              message: auditorMessage,
            });
            console.log(`SMS sent to auditor ${auditorNumber}:`, response);
          } catch (error) {
            console.error("Error sending auditor SMS:", error);
          }
        }
      } catch (error) {
        console.error("Error during auditor assignment:", error);
      }

      return null;
    });

function isRegisterState(data) {
  return (
    data.type === "register" &&
        data.requestStatus === "pending" &&
        data.requestType === "lending"
  );
}


// Utility: convert "MM-DD-YYYY" to "YYYY/MM/DD" for JS Date()
function convertToDateCompatibleFormat(dateStr) {
  const [month, day, year] = dateStr.split("-");
  return `${year}/${month}/${day}`;
}

/**
 * didClientStartThisWeek(client)
 * Returns false if client started their debt cycle in the last 6 days
 * (meaning 'debtCycleStartDate' is > oneWeekAgo).
 */
function didClientStartThisWeek(client) {
  if (!client.debtCycleStartDate) {
    // If missing, decide your default. We'll assume "true" so they won't be filtered out.
    return true;
  }

  const oneWeekAgo = new Date();
  // Subtract 6 days
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 6);

  const formatted = convertToDateCompatibleFormat(client.debtCycleStartDate);
  const debtCycleStartDate = new Date(formatted);

  // If they started more recently than oneWeekAgo => false
  if (debtCycleStartDate > oneWeekAgo) {
    return false;
  }
  return true;
}

/**
 * findClientsWithDebtsIncludingThoseWhoLeft
 * Returns only clients where debtLeft > 0
 */
function findClientsWithDebtsIncludingThoseWhoLeft(clients) {
  if (!Array.isArray(clients)) return [];
  return clients.filter((c) => Number(c.debtLeft) > 0);
}

/**
 * minimumPayment(client)
 * If the remaining debt (debtLeft) is less than the "standard" min payment,
 * we only ask for the remaining debt. Otherwise, ask for pay = amountToPay / paymentPeriodRange.
 */
function minimumPayment(client) {
  const pay = Number(client.amountToPay) / Number(client.paymentPeriodRange);

  if (
    client.debtLeft &&
    Number(client.debtLeft) > 0 &&
    Number(client.debtLeft) < pay
  ) {
    // Use the leftover debt as the min payment
    return Number(client.debtLeft);
  }

  // Otherwise, the normal min
  return pay; // can return as number or string, but let's keep it numeric for clarity
}


/**
 * SCHEDULED FUNCTION:
 * Runs daily at 08:00 Africa/Kinshasa Time
 * Fetches all users except mode="testing", collects clients,
 * filters them, calculates minPayment, and sends SMS reminders
 */
exports.scheduledSendReminders = functions.pubsub
    .schedule("0 8 * * *")
    .timeZone("Africa/Kinshasa")
    .onRun(async (context) => {
      console.log("===> Starting scheduledSendReminders at 8AM Kinshasa time...");

      try {
      // 1. Identify today's weekday => "Monday", "Tuesday", etc.
        const theDay = new Date().toLocaleString("en-US", {weekday: "long"});
        console.log("===> Today is:", theDay);

        // 2. Fetch all users except those with mode="testing"
        const usersSnapshot = await admin
            .firestore()
            .collection("users")
            .where("mode", "!=", "testing")
            .get();

        if (usersSnapshot.empty) {
          console.log("No users found (excl. mode='testing'). Exiting...");
          return null;
        }

        // 3. For each user, get sub-collection "clients"
        const allClients = [];
        for (const userDoc of usersSnapshot.docs) {
          const userId = userDoc.id;

          const clientSnapshot = await admin
              .firestore()
              .collection("users")
              .doc(userId)
              .collection("clients")
              .get();

          if (!clientSnapshot.empty) {
            clientSnapshot.forEach((cDoc) => {
            // Add doc data to allClients array
              allClients.push({
                ...cDoc.data(),
                docId: cDoc.id,
                userId,
              });
            });
          }
        }

        if (allClients.length === 0) {
          console.log("No clients found across all non-testing users. Exiting...");
          return null;
        }

        // 4. Filter to only those with debts
        const clientsWithDebts = findClientsWithDebtsIncludingThoseWhoLeft(allClients);

        // 5. Filter by paymentDay, isPhoneCorrect, and didClientStartThisWeek
        const clientsToRemind = clientsWithDebts.filter((client) => {
          return (
            client.paymentDay === theDay &&
          client.isPhoneCorrect !== "false" &&
          didClientStartThisWeek(client)
          );
        });

        if (clientsToRemind.length === 0) {
          console.log("No clients need reminders today after filtering. Exiting...");
          return null;
        }

        // 6. Send SMS to each valid client
        let successCount = 0;
        let failCount = 0;

        for (const client of clientsToRemind) {
          const {
            firstName,
            lastName,
            phoneNumber,
            debtLeft,
            savings,
          } = client;

          // Calculate minPayment with your logic
          //   amountToPay / paymentPeriodRange
          //   or leftover debt if smaller
          const minPay = minimumPayment(client);

          // Format phone
          if (!phoneNumber) {
            console.log("Skipping client with no phone number:", client);
            failCount++;
            continue;
          }
          const formattedNumber = makeValidE164(phoneNumber);
          if (!formattedNumber) {
            console.log(`Skipping invalid phone number: ${phoneNumber}`);
            failCount++;
            continue;
          }

          // Construct your reminder message
          const message = `Bonjour ${firstName || "Valued"} ${
            lastName || "Client"
          },\n` +
          `Ozali programmer lelo pona kofuta ${minPay} FC. ` +
          `Otikali na niongo ya ${debtLeft} FC. ` +
          `Epargnes na yo ezali: ${savings}FC.\n` +
          `En cas de probleme ou d'erreurs benga 0825333567.`+
          `Merci pona confiance na Fondation Gervais.`;

          try {
          // Send SMS via Africa's Talking
            const response = await sms.send({
              to: [formattedNumber],
              message,
            });
            // console.log(`SMS sent to ${formattedNumber} =>`, message);
            console.log(`SMS sent to ${formattedNumber} =>`, response);
            successCount++;
          } catch (error) {
            console.error(`Error sending SMS to ${formattedNumber}:`, error);
            failCount++;
          }
        }

        console.log(
            `===> Reminders done. Success: ${successCount}, Failed: ${failCount}`,
        );
        return null;
      } catch (error) {
        console.error("Error in scheduledSendReminders:", error);
        throw error; // Let Firebase log it as a function error
      }
    });


/**
 * Parse the custom "MM-DD-YYYY-HH-mm-SS" key into a real Date object.
 * Returns an invalid Date if parsing fails, so handle with caution.
 */
function parsePaymentKey(key) {
  // e.g. "3-20-2025-14-57-2"
  const [M, D, Y, h, m, s] = key.split("-");
  return new Date(Number(Y), Number(M) - 1, Number(D), Number(h), Number(m), Number(s));
}

/**
 * Finds the most recent payment entry in the 'payments' object by parsing the keys as dates.
 * Returns { key, amount } of the latest or null if no valid entries.
 */
function findLatestPayment(payments) {
  const keys = Object.keys(payments);
  if (keys.length === 0) return null;

  let latestKey = null;
  let latestDate = null;

  for (const k of keys) {
    const dateObj = parsePaymentKey(k); // attempt to parse
    if (!latestDate || dateObj > latestDate) {
      latestDate = dateObj;
      latestKey = k;
    }
  }

  if (!latestKey) return null;
  return {key: latestKey, amount: payments[latestKey]};
}

/**
 * Cloud Function: send SMS on payment or savings changes
 *  - If type === "register", do nothing (already handled elsewhere).
 *  - Trigger only if payments or savings changed.
 */
exports.sendPaymentOrSavingsUpdateSMS = functions.firestore
    .document("users/{userId}/clients/{clientId}")
    .onUpdate(async (change, context) => {
      const beforeData = change.before.data() || {};
      const afterData = change.after.data() || {};

      // 1) Skip if type is "register"
      if (afterData.type === "register") {
        console.log("Type is 'register'. Skipping...");
        return null;
      }

      // 2) Determine if 'payments' changed
      const paymentsBefore = beforeData.payments || {};
      const paymentsAfter = afterData.payments || {};
      const paymentsChanged =
      JSON.stringify(paymentsBefore) !== JSON.stringify(paymentsAfter);

      // 3) Determine if 'savings' changed
      const savingsBefore = Number(beforeData.savings) || 0;
      const savingsAfter = Number(afterData.savings) || 0;
      const savingsChanged = savingsBefore !== savingsAfter;

      // If neither changed, skip
      if (!paymentsChanged && !savingsChanged) {
        console.log("Neither payments nor savings changed. Skipping...");
        return null;
      }

      // Gather client info
      const firstName = afterData.firstName || "";
      const lastName = afterData.lastName || "";
      const fullName = `${firstName} ${lastName}`.trim();
      const phoneNumber = afterData.phoneNumber;
      const debtLeft = Number(afterData.debtLeft) || 0;

      if (!phoneNumber) {
        console.log("Client has no phone number. Skipping SMS...");
        return null;
      }
      const formattedNumber = makeValidE164(phoneNumber);
      if (!formattedNumber) {
        console.log(`Invalid phone number: ${phoneNumber}`);
        return null;
      }

      // We'll need the latest payment if 'payments' changed
      let paymentJustPaid = null;
      let latestPaymentKey = null;
      if (paymentsChanged) {
        const latest = findLatestPayment(paymentsAfter);
        if (latest) {
          paymentJustPaid = Number(latest.amount) || 0;
          latestPaymentKey = latest.key;
        }
      }

      // For the savings difference
      const savingsDiff = savingsAfter - savingsBefore;
      // Example:
      //   if > 0, "Obakisi epargnes na yo ya XXX FC"
      //   if < 0, "Olongoli epargnes na yo ya XXX FC"
      const absoluteSavingsDiff = Math.abs(savingsDiff);

      // Build the final message (4 main cases + optional nuance if both changed but savings decreased)
      let message = "";

      // CASE 1: Only payments changed
      if (paymentsChanged && !savingsChanged) {
      // {firstname}{lastname}, Ofuti mombongo ya {paymentJustpaid} FC
      // Otikali na Niongo ya {debtLeft} FC. Epargnes na yo ezali {savings}.
      // Merci pona confiance na Fondation Gervais.
        message = `${fullName}, Ofuti mombongo ya ${paymentJustPaid} FC.
Otikali na Niongo ya ${debtLeft} FC. Epargnes na yo ezali ${savingsAfter} FC.
En cas de probleme ou d'erreurs benga 0825333567.
Merci pona confiance na Fondation Gervais.`;
      }

      // CASE 2 or 3: Only savings changed
      else if (!paymentsChanged && savingsChanged) {
        if (savingsDiff > 0) {
        // CASE 2: savings added
        // {firstname}{lastname}, Obakisi epargnes na yo ya {savingsAdded} FC
          message = `${fullName}, Obakisi epargnes na yo ya ${absoluteSavingsDiff} FC.
Otikali na Niongo ya ${debtLeft} FC. Epargnes na yo ezali ${savingsAfter} FC.
En cas de probleme ou d'erreurs benga 0825333567.
Merci pona confiance na Fondation Gervais.`;
        } else {
        // CASE 3: savings removed
        // {firstname}{lastname}, Olongoli epargnes na yo ya {savingsRemoved} FC
          message = `${fullName}, Olongoli epargnes na yo ya ${absoluteSavingsDiff} FC.
Otikali na Niongo ya ${debtLeft} FC. Epargnes na yo ezali ${savingsAfter} FC.
En cas de probleme ou d'erreurs benga 0825333567.
Merci pona confiance na Fondation Gervais.`;
        }
      }

      // CASE 4: Both payments and savings changed
      else if (paymentsChanged && savingsChanged) {
      // The user only explicitly provided a message for "added" savings,
      // but let's handle removal similarly if that case can happen.

        if (savingsDiff > 0) {
        // "Ofuti mombongo ya {paymentJustpaid} FC. Obakisi epargnes na yo ya {savingsAdded} FC"
          message = `${fullName}, Ofuti mombongo ya ${paymentJustPaid} FC. Obakisi epargnes na yo ya ${absoluteSavingsDiff} FC.
Otikali na Niongo ya ${debtLeft} FC. Epargnes na yo ezali ${savingsAfter} FC.
En cas de probleme ou d'erreurs benga 0825333567.
Merci pona confiance na Fondation Gervais.`;
        } else {
        // If you need a "removal" version, do:
        // "Ofuti mombongo ya {paymentJustPaid} FC. Olongoli epargnes na yo ya {savingsRemoved} FC"
          message = `${fullName}, Ofuti mombongo ya ${paymentJustPaid} FC. Olongoli epargnes na yo ya ${absoluteSavingsDiff} FC.
Otikali na Niongo ya ${debtLeft} FC. Epargnes na yo ezali ${savingsAfter} FC.
En cas de probleme ou d'erreurs benga 0825333567. 
Merci pona confiance na Fondation Gervais.`;
        }
      }

      console.log("Constructed message:", message);

      // Send the SMS
      try {
        const response = await sms.send({
          to: [formattedNumber],
          message,
        });
        console.log(`SMS sent to ${formattedNumber} =>`, response);
      } catch (error) {
        console.error("Error sending SMS:", error);
      }


      // ─────────────────────────────────────────────────────────────
      // NEW: Detect "just finished" transition (after a payment)
      //      Only when debtLeft went from > 0 to <= 0 AND payments changed.
      // ─────────────────────────────────────────────────────────────
      const debtBefore = Number(beforeData.debtLeft) || 0;
      const debtAfter = Number(afterData.debtLeft) || 0;

      const finishedNow =
      paymentsChanged &&
      debtBefore > 0 &&
      debtAfter <= 0;


      if (finishedNow) {
        console.log("🎉 Client just finished their debt. latestPaymentKey:", latestPaymentKey);

        const creditScore = Number(afterData.creditScore) || 0;

        let congratsMessage = "";
        if (creditScore < 20) {
        // Short congrats only
          congratsMessage =
`${fullName},
🎉 Félicitations ${fullName}! Osilisi niongo (solde: 0 FC).
Merci pona confiance na Fondation Gervais.`;
        } else {
        // Short invite to come back + perks summary
          congratsMessage =
`${fullName},
🎉 Félicitations ${fullName}! Osilisi niongo (solde: 0 FC). Score Crédit: ${creditScore}.
Okoki kozwa lisusu niongo epayi na biso. 70+: prêt à tout moment; 90+: +5% épargne; 100: tombola. Rappel: 30% épargne.
Merci pona confiance na Fondation Gervais.`;
        }

        try {
          const resp2 = await sms.send({
            to: [formattedNumber],
            message: congratsMessage,
          });
          console.log(`Congrats SMS sent to ${formattedNumber} =>`, resp2);
        } catch (err) {
          console.error("Error sending Congrats SMS:", err);
        }
      } else {
        console.log("No 'finished debt' transition detected for this update.");
      }


      return null;
    });


exports.sendEmployeePayRemindersSMS = functions.https.onCall(async (data, ctx)=>{
  // if (!ctx.auth || !ctx.auth.token.admin)
  // {throw new functions.https.HttpsError("permission-denied", "Admin only");}

  const {type, employees=[]} = data;
  if (!["bonus", "paiement"].includes(type) || !Array.isArray(employees))
  {throw new functions.https.HttpsError("invalid-argument", "Bad payload");}

  let sent=0; let failed=0;
  for (const e of employees) {
    const to = makeValidE164(e.phoneNumber||"");
    if (!to) {failed++; continue;}

    const msg =
  `Fondation Gervais : ${e.firstName} ${e.lastName}, ` +
  `votre ${type} est disponible. ` +
  `Allez le SIGNER dans l’appli pour déclencher le virement. ` +
  `Montant incorrect? Contactez +1 2156877614.`;

    try {
      await sms.send({to: [to], message: msg});
      sent++;
    } catch (err) {console.error(err); failed++;}
  }
  return {sent, failed};
});
