const express = require('express');
const { check, validationResult } = require('express-validator');
const UserService = require('./UserService');

const router = express.Router();

router.post(
  '/api/1.0/users',
  check('username')
    .notEmpty()
    .withMessage('Username cannot be null')
    .bail()
    .isLength({ min: 4 })
    .withMessage('Must have min 4 and max 32 characters')
    .bail()
    .isLength({ max: 32 })
    .withMessage('Must have min 4 and max 32 characters'),
  check('password')
    .notEmpty()
    .withMessage('Password cannot be null')
    .bail()
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
    .bail()
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).*$/)
    .withMessage('Password must have at least 1 upsercase, 1 losercase and 1 number'),
  check('email').notEmpty().withMessage('E-mail cannot be null').bail().isEmail().withMessage('E-mail is not valid'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const validationErrors = {};
      errors.array().forEach((error) => {
        validationErrors[error.param] = error.msg;
      });

      return res.status(400).send({ validationErrors: validationErrors });
    }

    await UserService.save(req.body);
    return res.send({ message: 'User Created' });
  }
);

module.exports = router;
