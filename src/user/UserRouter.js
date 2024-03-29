const express = require('express');
const { check, validationResult } = require('express-validator');
const ValidationException = require('../error/ValidationException');
const UserService = require('./UserService');
const { pagination } = require('../middlewares/pagination');
const ForbiddenException = require('../error/ForbiddenException');
const tokenAuthentication = require('../middlewares/tokenAuthentication');

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
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new ValidationException(errors.array()));
    }

    try {
      await UserService.save(req.body);
      return res.send({ message: req.t('user_created') });
    } catch (err) {
      // return res.status(502).send({ message: req.t(error.message) });
      next(err);
    }
  }
);

router.post('/api/1.0/users/token/:token', async (req, res, next) => {
  const token = req.params.token;
  try {
    await UserService.activate(token);
    return res.send({ message: req.t('account_activation_successful') });
  } catch (err) {
    next(err);
  }
});

router.get('/api/1.0/users', tokenAuthentication, pagination, async (req, res) => {
  const { page, size } = req.pagination;
  const authUser = req.authenticatedUser;
  const users = await UserService.getUsers(page, size, authUser);
  res.send(users);
});

router.get('/api/1.0/users/:id', async (req, res, next) => {
  try {
    const user = await UserService.getUser(req.params.id);
    res.send(user);
  } catch (err) {
    next(err);
  }
});
router.put('/api/1.0/users/:id', tokenAuthentication, async (req, res, next) => {
  const authUser = req.authenticatedUser;

  // eslint-disable-next-line eqeqeq
  if (!authUser || authUser.id != req.params.id) {
    return next(new ForbiddenException('unauthorized_user_update'));
  }
  await UserService.updateUser(req.params.id, req.body);
  return res.send();
});

module.exports = router;
