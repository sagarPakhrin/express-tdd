const express = require('express');
const UserRouter = require('./user/UserRouter');
const AuthRouter = require('./auth/AuthRouter');
const i18next = require('i18next');
const Backend = require('i18next-fs-backend');
var middleware = require('i18next-http-middleware');
const ErrorHandler = require('./error/ErrorHandler');

i18next
  .use(Backend)
  .use(middleware.LanguageDetector)
  .init({
    fallbackLng: 'en',
    lng: 'en',
    ns: ['translation'],
    defaultNS: 'translation',
    preload: ['en'],
    backend: {
      loadPath: 'locales/{{lng}}/{{ns}}.json',
    },
    detection: {
      lookupHeader: 'accept-language',
    },
  });

const app = express();

app.use(middleware.handle(i18next));

app.use(express.json());

app.use(UserRouter);
app.use(AuthRouter);

app.use(ErrorHandler);

module.exports = app;
