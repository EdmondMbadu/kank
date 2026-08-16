const test = require("node:test");
const assert = require("node:assert/strict");
const {
  BRAND_LINE,
  SUPPORT_NUMBERS,
  buildEmployeeSummaryMessage,
  buildLoanActivationMessage,
  buildPaymentUpdateMessage,
  buildRegistrationMessage,
  buildReminderMessage,
  buildSmsDeliveryId,
  extractProviderCost,
  measureSms,
  toGsmSafe,
} = require("../sms-utils");

test("delivery IDs block the same recipient and day only", () => {
  const input = {
    messageType: "payment-reminder",
    dateKey: "2026-08-16",
    recipientKey: "owner/client",
  };
  const first = buildSmsDeliveryId(input);

  assert.equal(buildSmsDeliveryId({...input}), first);
  assert.notEqual(
      buildSmsDeliveryId({...input, dateKey: "2026-08-17"}),
      first,
  );
  assert.notEqual(
      buildSmsDeliveryId({...input, messageType: "payment-confirmation"}),
      first,
  );
});

test("approved reminder remains one GSM segment with all support " +
  "numbers", () => {
  const result = buildReminderMessage({
    firstName: "Elysée",
    lastName: "Ntumba",
    minPayment: 70000,
    debtLeft: 340000,
    savings: 194000,
  });

  assert.equal(result.message,
      "Elysée Ntumba: Lelo futa FC70000. Niongo etikali FC340000; " +
      "epargne FC194000. Tel 0825333567/0899401993/0975849850. " +
      "Fondation Gervais.");
  assert.equal(result.measurement.encoding, "GSM-7");
  assert.equal(result.measurement.segments, 1);
  assert.equal(result.measurement.characters, 133);
});

test("late reminder remains one segment", () => {
  const result = buildReminderMessage({
    firstName: "Elysée",
    lastName: "Ntumba",
    minPayment: 70000,
    debtLeft: 340000,
    savings: 194000,
    isLate: true,
  });

  assert.equal(result.measurement.segments, 1);
  assert.match(result.message, /Ozali na retard/);
});

test("payment and savings withdrawal remains one segment", () => {
  const result = buildPaymentUpdateMessage({
    firstName: "Viviane",
    lastName: "Phemba",
    paymentAmount: 10000,
    debtLeft: 390000,
    savingsAfter: 60000,
    savingsDifference: -10000,
    paymentsChanged: true,
    savingsChanged: true,
  });

  assert.equal(result.measurement.segments, 1);
  assert.ok(result.measurement.septets <= 150);
  assert.match(result.message, /Fondation Gervais\.$/);
});

test("payment-only confirmation remains one segment", () => {
  const result = buildPaymentUpdateMessage({
    firstName: "Bernadette",
    lastName: "Ntelo",
    paymentAmount: 5000,
    debtLeft: 120000,
    savingsAfter: 0,
    savingsDifference: 0,
    paymentsChanged: true,
    savingsChanged: false,
  });

  assert.equal(result.measurement.segments, 1);
  assert.match(result.message, /Ofuti FC5000/);
});

test("long personalized values use a compact fallback instead of " +
  "disappearing", () => {
  const result = buildPaymentUpdateMessage({
    firstName: "Marie-Christine-Extraordinairement-Longue",
    lastName: "Phemba-Ntumba-Makengo",
    paymentAmount: 1000000000,
    debtLeft: 39000000000,
    savingsAfter: 6000000000,
    savingsDifference: -1000000000,
    paymentsChanged: true,
    savingsChanged: true,
  });

  assert.equal(result.usedCompactFallback, true);
  assert.ok(result.message.length > 0);
  assert.ok(result.measurement.septets <= 150);
});

test("customer templates retain the full brand and three numbers", () => {
  const builders = [
    buildRegistrationMessage({
      firstName: "Jean",
      lastName: "Client",
      loanAmount: 100000,
      requestDate: "20/08/2026",
      fees: 5000,
      savings: 10000,
    }),
    buildLoanActivationMessage({
      firstName: "Jean",
      lastName: "Client",
      loanAmount: 100000,
      startDate: "20/08/2026",
      endDate: "20/10/2026",
      paymentCount: 8,
      minimumPayment: 12500,
    }),
  ];

  for (const result of builders) {
    const brandPattern = new RegExp(`${BRAND_LINE.replace(".", "\\.")}$`);
    assert.match(result.message, brandPattern);
    for (const number of SUPPORT_NUMBERS) {
      assert.match(result.message, new RegExp(number));
    }
    assert.equal(result.measurement.encoding, "GSM-7");
    assert.equal(result.measurement.segments, 1);
  }
});

test("employee follow-up keeps the offline list and debt when compact", () => {
  const result = buildEmployeeSummaryMessage({
    firstName: "Gaston",
    lastName: "Mazenzi",
    clients: [
      {
        firstName: "Mado",
        lastName: "Kanku",
        phoneNumber: "0812345678",
        minPayment: 10000,
        debtLeft: 250000,
      },
      {
        firstName: "Paul",
        lastName: "Lelo",
        phoneNumber: "0823456789",
        minPayment: 15000,
        debtLeft: 180000,
      },
      {
        firstName: "Aline",
        lastName: "Mputu",
        phoneNumber: "0894567890",
        minPayment: 5000,
        debtLeft: 95000,
      },
    ],
  });

  assert.equal(result.includedDebt, true);
  assert.equal(result.measurement.encoding, "GSM-7");
  assert.ok(result.measurement.segments <= 3);
  assert.match(result.message, /Mado Kanku 0812345678 min FC10000 n FC250000/);
  assert.match(result.message, /Fondation Gervais\.$/);
});

test("employee follow-up drops debt before omitting required clients", () => {
  const clients = Array.from({length: 9}, (_, index) => ({
    firstName: `Client${index + 1}`,
    lastName: "Makengo",
    phoneNumber: `08123456${String(index).padStart(2, "0")}`,
    minPayment: 10000 + index,
    debtLeft: 250000 + index,
  }));
  const result = buildEmployeeSummaryMessage({
    firstName: "Gaston",
    lastName: "Mazenzi",
    clients,
  });

  assert.equal(result.includedDebt, false);
  assert.ok(result.measurement.segments <= 3);
  clients.forEach((client) => {
    assert.match(result.message, new RegExp(client.phoneNumber));
    assert.match(result.message, new RegExp(`min FC${client.minPayment}`));
  });
});

test("employee follow-up never removes clients to meet its target", () => {
  const clients = Array.from({length: 20}, (_, index) => ({
    firstName: `Client${index + 1}`,
    lastName: "Makengo",
    phoneNumber: `08123456${String(index).padStart(2, "0")}`,
    minPayment: 10000 + index,
    debtLeft: 250000 + index,
  }));
  const result = buildEmployeeSummaryMessage({
    firstName: "Gaston",
    lastName: "Mazenzi",
    clients,
  });

  clients.forEach((client) => {
    assert.match(result.message, new RegExp(client.phoneNumber));
    assert.match(result.message, new RegExp(`min FC${client.minPayment}`));
  });
});

test("employee no-client message remains useful and one segment", () => {
  const result = buildEmployeeSummaryMessage({
    firstName: "Gaston",
    lastName: "Mazenzi",
    clients: [],
  });

  assert.equal(result.measurement.encoding, "GSM-7");
  assert.equal(result.measurement.segments, 1);
  assert.equal(
      result.message,
      "Gaston Mazenzi: Client programme te lelo. Luka clients ya sika pe " +
      "landela oyo bafutaki te lobi. Fondation Gervais.",
  );
});

test("unicode punctuation is normalized without forcing UCS-2", () => {
  const safe = toGsmSafe("⚠️ Client • dette — l’appli");
  assert.equal(measureSms(safe).encoding, "GSM-7");
  assert.equal(safe.includes("⚠"), false);
  assert.equal(safe.includes("•"), false);
  assert.equal(safe.includes("—"), false);
  assert.equal(safe.includes("’"), false);
});

test("provider cost is extracted from Africa's Talking response", () => {
  const result = extractProviderCost({
    SMSMessageData: {
      Message: "Sent to 1/1 Total Cost: CDF 57.2867",
      Recipients: [{
        cost: "CDF 57.2867",
        messageId: "abc123",
        status: "Success",
        statusCode: 101,
      }],
    },
  });

  assert.deepEqual(result, {
    amount: 57.2867,
    currency: "CDF",
    messageId: "abc123",
    status: "Success",
    statusCode: 101,
  });
});

test("USD provider costs keep the precision shown by Africa's Talking", () => {
  const result = extractProviderCost({
    SMSMessageData: {
      Recipients: [{cost: "USD 0.0750", status: "Success", statusCode: 101}],
    },
  });

  assert.equal(result.amount, 0.075);
  assert.equal(result.currency, "USD");
});
