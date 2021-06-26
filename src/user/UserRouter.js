const express = require('express');
const { check, validationResult } = require('express-validator');
const UserService = require('./UserService');

const router = express.Router();

router.post(
  '/api/1.0/users',
  check('username')
    .notEmpty()
    .withMessage('username_null')
    .bail()
    .isLength({ min: 4 })
    .withMessage('username_size')
    .bail()
    .isLength({ max: 32 })
    .withMessage('username_size'),
  check('email')
    .notEmpty()
    .withMessage('email_null')
    .bail()
    .isEmail()
    .withMessage('email_invalid')
    .custom(async (email) => {
      const user = await UserService.findByEmail(email);
      if (user) {
        throw new Error('email_inuse');
      }
    }),
  check('password')
    .notEmpty()
    .withMessage('password_null')
    .bail()
    .isLength({ min: 6 })
    .withMessage('password_size')
    .bail()
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).*$/)
    .withMessage('password_pattern'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const validationErrors = {};
      errors.array().forEach((error) => (validationErrors[error.param] = req.t(error.msg)));
      return res.status(400).send({ validationErrors: validationErrors });
    }

    try {
      await UserService.save(req.body);
      return res.send({ message: req.t('user_created') });
    } catch (error) {
      return res.status(502).send({ message: req.t(error.message) });
    }
  }
);

router.post('/api/1.0/users/token/:token', async (req, res) => {
  const token = req.params.token;
  try {
    await UserService.activate(token);
  } catch (error) {
    return res.status(400).send({ message: req.t(error.message) });
  }
  return res.send({ message: req.t('account_activation_successful') });
});

module.exports = router;
