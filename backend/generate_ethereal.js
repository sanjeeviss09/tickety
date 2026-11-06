const nodemailer = require('nodemailer');
const fs = require('fs');

async function createEtherealAccount() {
  try {
    const account = await nodemailer.createTestAccount();
    const envString = `
SMTP_HOST=${account.smtp.host}
SMTP_PORT=${account.smtp.port}
SMTP_USER=${account.user}
SMTP_PASS=${account.pass}
`;
    fs.appendFileSync('.env', envString);
    console.log('Ethereal credentials added to .env');
    console.log('User:', account.user);
    console.log('Pass:', account.pass);
  } catch (err) {
    console.error(err);
  }
}

createEtherealAccount();
