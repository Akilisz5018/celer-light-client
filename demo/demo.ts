import { ethers, Wallet } from 'ethers';
import { Any } from 'google-protobuf/google/protobuf/any_pb';

import { Celer, PaymentStatus, TokenType } from '../src/index';
import { Invoice } from '../src/protobufs/invoice_pb';
import config from './ropsten_config.json';
import contractsInfo from './ropsten_contracts.json';

declare global {
  interface Window {
    ethereum: { enable: Function; autoRefreshOnNetworkChange: boolean };
    web3: { currentProvider: object };
    client: Celer;
    channelId: string;
    redirectUrl: string;
    connect: Function;
    openChannel: Function;
    deposit: Function;
    sendPayment: Function;
    updateBalance: Function;
  }
}

function updateBalance(): void {
  if (window.channelId) {
    window.client
      .getPaymentChannelInfo(window.channelId)
      .then(
        info =>
          (document.getElementById('balance').textContent = JSON.stringify(
            info.balance
          ))
      )
      .catch();
  }
}

function openChannel(): void {
  window.client
    .openPaymentChannel(
      TokenType.ETH,
      ethers.constants.AddressZero,
      '50000000000000000',
      '50000000000000000'
    )
    .then(channelId => {
      document.getElementById(
        'channel'
      ).textContent = `Channel ${channelId} opened`;
      window.channelId = channelId;
    });
}

function deposit(): void {
  window.client.deposit(window.channelId, TokenType.ETH, '100').then(_ => {
    document.getElementById('deposit').textContent = `Deposited 100 wei`;
    updateBalance();
  });
}

function sendPayment(): void {
  const client = window.client;
  updateBalance();
  const amount = (document.getElementById('amount') as HTMLInputElement).value;
  const note = new Any();
  const invoice = new Invoice();
  invoice.setMemo(
    (document.getElementById('invoice') as HTMLInputElement).value
  );
  note.pack(invoice.serializeBinary(), 'invoice.Invoice');
  let paymentId: string;
  client
    .sendPayment(
      TokenType.ETH,
      ethers.constants.AddressZero,
      (document.getElementById('recipient') as HTMLInputElement).value,
      amount,
      note
    )
    .then(id => {
      paymentId = id;
      document.getElementById(
        'payment'
      ).textContent = `Payment ${paymentId} sent`;
      const check = setInterval(async () => {
        const paymentInfo = await client.getPaymentInfo(paymentId);
        if (paymentInfo.status === PaymentStatus.CO_SIGNED_SETTLED) {
          clearInterval(check);
          if (window.redirectUrl) {
            window.location.href = window.redirectUrl;
          }
        }
      }, 1000);
    });
}

async function connect() {
  if (
    typeof window.ethereum === 'undefined' &&
    typeof window.web3 === 'undefined'
  ) {
    return;
  }
  if (window.ethereum) {
    window.ethereum.autoRefreshOnNetworkChange = false;
    await window.ethereum.enable();
  }
  const provider = new ethers.providers.Web3Provider(
    window['ethereum'] || window.web3.currentProvider
  );
  const client = await Celer.create(
    provider,
    provider.getSigner(),
    contractsInfo,
    config
  );

  setInterval(() => {
    updateBalance();
  }, 1000);

  window.client = client;
}

(async () => {
  const href = window.location.href;
  const url = new URL(href);
  const invoice = url.searchParams.get('invoice');
  const recipient = url.searchParams.get('recipient');
  const amount = url.searchParams.get('amount');
  const redirectUrl = url.searchParams.get('redirect');
  window.redirectUrl = redirectUrl;

  window.onload = () => {
    (document.getElementById(
      'recipient'
    ) as HTMLInputElement).value = recipient;
    (document.getElementById('amount') as HTMLInputElement).value = amount;
    (document.getElementById('invoice') as HTMLInputElement).value = invoice;
  };
})();

window.connect = connect;
window.openChannel = openChannel;
window.deposit = deposit;
window.sendPayment = sendPayment;
window.updateBalance = updateBalance;
