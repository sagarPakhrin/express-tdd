const express = require('express');
const bcrypt = require('bcrypt');
const UserService = require('../user/UserService');
const router = express.Router();
const AuthException = require('./AuthException');
const TokenService = require('./TokenService');
const ForbiddenException = require('../error/ForbiddenException');
const { check, validationResult } = require('express-validator');

router.post('/api/1.0/auth', check('email').isEmail(), async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new AuthException());
  }
  const { email, password } = req.body;
  const user = await UserService.findByEmail(email);
  if (!user) {
    return next(new AuthException());
  }
  const match = await bcrypt.compare(password, user.password);

  if (!match) {
    return next(new AuthException());
  }
  if (user.inactive) {
    return next(new ForbiddenException());
  }

  const token = TokenService.createToken(user);
  res.send({ id: user.id, username: user.username, token: token });
});

module.exports = router;
