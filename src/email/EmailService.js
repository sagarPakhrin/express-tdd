const transporter = require('../config/emailTranspoter');

const sendAccountActivation = async (email, token) => {
  await transporter.sendMail({
    from: 'My App<info@myapp.com>',
    to: email,
    subject: 'Account Activation',
    html: `Token is ${token}`,
  });
};

module.exports = { sendAccountActivation };
