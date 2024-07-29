export class Management {
  moneyInHands?: string;
  expenses?: { [key: string]: string } = {};
  reserve?: { [key: string]: string } = {};
  moneyGiven?: { [key: string]: string } = {};
  exchangeLoss?: { [key: string]: string } = {};
  dollarTransferLoss?: { [key: string]: string } = {};
  bankDepositDollars?: { [key: string]: string } = {};
  bankDepositFrancs?: { [key: string]: string } = {};
}
